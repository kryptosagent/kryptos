use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};

use crate::state::DcaVault;
use crate::errors::KryptosError;
use crate::events::{DcaExecuted, DcaCompleted};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ExecuteDcaParams {
    /// Amount being swapped (with variance applied by keeper)
    pub swap_amount: u64,
    /// Amount received from Jupiter swap
    pub received_amount: u64,
}

#[derive(Accounts)]
pub struct ExecuteDca<'info> {
    /// Keeper/crank that triggers execution
    #[account(mut)]
    pub keeper: Signer<'info>,

    /// DCA vault to execute
    #[account(
        mut,
        constraint = dca_vault.is_active @ KryptosError::DcaNotActive,
        constraint = !dca_vault.is_completed() @ KryptosError::DcaCompleted,
    )]
    pub dca_vault: Account<'info, DcaVault>,

    /// Vault's input token account (USDC etc)
    #[account(
        mut,
        constraint = vault_input_token.key() == dca_vault.input_vault @ KryptosError::TokenAccountMismatch,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// Vault's output token account (SOL wrapped, etc)
    #[account(
        mut,
        constraint = vault_output_token.key() == dca_vault.output_vault @ KryptosError::TokenAccountMismatch,
    )]
    pub vault_output_token: Account<'info, TokenAccount>,

    /// Keeper's input token account (receives from vault for swap)
    #[account(
        mut,
        constraint = keeper_input_token.owner == keeper.key() @ KryptosError::Unauthorized,
    )]
    pub keeper_input_token: Account<'info, TokenAccount>,

    /// Keeper's output token account (sends swap result to vault)
    #[account(
        mut,
        constraint = keeper_output_token.owner == keeper.key() @ KryptosError::Unauthorized,
    )]
    pub keeper_output_token: Account<'info, TokenAccount>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ExecuteDca>, params: ExecuteDcaParams) -> Result<()> {
    let dca_vault = &mut ctx.accounts.dca_vault;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Check if execution is allowed (time-based)
    require!(
        dca_vault.can_execute(current_time),
        KryptosError::DcaExecutionNotAllowed
    );

    // Validate swap amount
    let remaining = dca_vault.total_amount.saturating_sub(dca_vault.total_spent);
    require!(params.swap_amount > 0, KryptosError::InvalidAmount);
    require!(params.swap_amount <= remaining, KryptosError::InvalidAmount);
    require!(params.received_amount > 0, KryptosError::InvalidAmount);

    // Validate vault has enough funds
    require!(
        ctx.accounts.vault_input_token.amount >= params.swap_amount,
        KryptosError::InsufficientFunds
    );

    // Validate keeper has the output tokens ready
    require!(
        ctx.accounts.keeper_output_token.amount >= params.received_amount,
        KryptosError::InsufficientFunds
    );

    // Prepare PDA signer seeds
    let authority_key = dca_vault.authority;
    let input_mint = dca_vault.input_mint;
    let output_mint = dca_vault.output_mint;
    let bump = dca_vault.bump;

    let seeds = &[
        DcaVault::SEED_PREFIX,
        authority_key.as_ref(),
        input_mint.as_ref(),
        output_mint.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // 1. Transfer input tokens from vault to keeper
    let transfer_to_keeper = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_input_token.to_account_info(),
            to: ctx.accounts.keeper_input_token.to_account_info(),
            authority: dca_vault.to_account_info(),
        },
        signer_seeds,
    );
    transfer(transfer_to_keeper, params.swap_amount)?;

    // 2. Transfer output tokens from keeper to vault
    let transfer_to_vault = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.keeper_output_token.to_account_info(),
            to: ctx.accounts.vault_output_token.to_account_info(),
            authority: ctx.accounts.keeper.to_account_info(),
        },
    );
    transfer(transfer_to_vault, params.received_amount)?;

    // Update vault state
    dca_vault.total_spent = dca_vault
        .total_spent
        .checked_add(params.swap_amount)
        .ok_or(KryptosError::MathOverflow)?;
    
    dca_vault.total_received = dca_vault
        .total_received
        .checked_add(params.received_amount)
        .ok_or(KryptosError::MathOverflow)?;
    
    dca_vault.execution_count = dca_vault
        .execution_count
        .checked_add(1)
        .ok_or(KryptosError::MathOverflow)?;
    
    dca_vault.last_execution = current_time;

    // Calculate next execution time (randomized)
    let avg_executions = (dca_vault.min_executions + dca_vault.max_executions) / 2;
    let base_interval = 604800i64 / (avg_executions as i64).max(1); // seconds in week / executions
    
    // Add randomness based on timestamp
    let random_offset = ((current_time % 1000) * base_interval / 4000) as i64;
    let next_interval = if current_time % 2 == 0 {
        base_interval + random_offset
    } else {
        base_interval - random_offset
    };
    
    dca_vault.next_execution = current_time + next_interval.max(3600); // minimum 1 hour

    // Check if DCA is completed
    let is_completed = dca_vault.is_completed();
    if is_completed {
        dca_vault.is_active = false;
        
        emit!(DcaCompleted {
            vault: dca_vault.key(),
            authority: dca_vault.authority,
            total_spent: dca_vault.total_spent,
            total_received: dca_vault.total_received,
            execution_count: dca_vault.execution_count,
            completed_at: current_time,
        });

        msg!("DCA completed!");
    }

    // Emit execution event
    emit!(DcaExecuted {
        vault: dca_vault.key(),
        authority: dca_vault.authority,
        amount_spent: params.swap_amount,
        amount_received: params.received_amount,
        execution_count: dca_vault.execution_count,
        next_execution: dca_vault.next_execution,
        executed_at: current_time,
    });

    msg!("DCA executed successfully");
    msg!("Spent: {} | Received: {}", params.swap_amount, params.received_amount);
    msg!("Execution #{} | Next: {}", dca_vault.execution_count, dca_vault.next_execution);

    Ok(())
}
