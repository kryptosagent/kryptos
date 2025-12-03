use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};

use crate::state::{IntentVault, IntentStatus, ExecutionStyle};
use crate::errors::KryptosError;
use crate::events::{IntentTriggered, IntentExecuted};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ExecuteIntentParams {
    /// Current price from oracle (6 decimals USD)
    pub current_price: u64,
    /// Amount to swap this execution
    pub swap_amount: u64,
    /// Amount received from swap
    pub received_amount: u64,
}

#[derive(Accounts)]
pub struct ExecuteIntent<'info> {
    /// Keeper/crank that triggers execution
    #[account(mut)]
    pub keeper: Signer<'info>,

    /// Intent vault to execute
    #[account(
        mut,
        constraint = intent_vault.status == IntentStatus::Monitoring 
            || intent_vault.status == IntentStatus::Triggered 
            || intent_vault.status == IntentStatus::Executing 
            @ KryptosError::IntentNotMonitoring,
    )]
    pub intent_vault: Account<'info, IntentVault>,

    /// Vault's input token account
    #[account(
        mut,
        constraint = vault_input_token.key() == intent_vault.input_vault @ KryptosError::TokenAccountMismatch,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// Keeper's input token account
    #[account(
        mut,
        constraint = keeper_input_token.owner == keeper.key() @ KryptosError::Unauthorized,
    )]
    pub keeper_input_token: Account<'info, TokenAccount>,

    /// Keeper's output token account
    #[account(
        mut,
        constraint = keeper_output_token.owner == keeper.key() @ KryptosError::Unauthorized,
    )]
    pub keeper_output_token: Account<'info, TokenAccount>,

    /// Vault's output token account (user's ATA for output token)
    /// For intents, we send directly to user
    #[account(mut)]
    pub user_output_token: Account<'info, TokenAccount>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ExecuteIntent>, params: ExecuteIntentParams) -> Result<()> {
    let intent_vault = &mut ctx.accounts.intent_vault;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Check if expired
    require!(
        !intent_vault.is_expired(current_time),
        KryptosError::IntentExpired
    );

    // Check if already fully executed
    require!(
        intent_vault.status != IntentStatus::Executed,
        KryptosError::IntentAlreadyExecuted
    );

    // Check if cancelled
    require!(
        intent_vault.status != IntentStatus::Cancelled,
        KryptosError::IntentAlreadyCancelled
    );

    // If still monitoring, check trigger condition
    if intent_vault.status == IntentStatus::Monitoring {
        let trigger_met = intent_vault.check_trigger(params.current_price);
        
        require!(trigger_met, KryptosError::TriggerConditionNotMet);

        // Update status to triggered
        intent_vault.status = IntentStatus::Triggered;
        intent_vault.triggered_at = current_time;

        emit!(IntentTriggered {
            vault: intent_vault.key(),
            authority: intent_vault.authority,
            trigger_price: intent_vault.trigger_price,
            current_price: params.current_price,
            triggered_at: current_time,
        });

        msg!("Intent triggered at price: {}", params.current_price);
    }

    // Validate amounts
    require!(params.swap_amount > 0, KryptosError::InvalidAmount);
    require!(params.received_amount > 0, KryptosError::InvalidAmount);

    // Validate vault has enough funds
    require!(
        ctx.accounts.vault_input_token.amount >= params.swap_amount,
        KryptosError::InsufficientFunds
    );

    // Validate keeper has output tokens ready
    require!(
        ctx.accounts.keeper_output_token.amount >= params.received_amount,
        KryptosError::InsufficientFunds
    );

    // Prepare PDA signer seeds
    let authority_key = intent_vault.authority;
    let input_mint = intent_vault.input_mint;
    let nonce_bytes = intent_vault.nonce.to_le_bytes();
    let bump = intent_vault.bump;

    let seeds = &[
        IntentVault::SEED_PREFIX,
        authority_key.as_ref(),
        input_mint.as_ref(),
        &nonce_bytes,
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Update status to executing
    intent_vault.status = IntentStatus::Executing;

    // 1. Transfer input tokens from vault to keeper
    let transfer_to_keeper = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_input_token.to_account_info(),
            to: ctx.accounts.keeper_input_token.to_account_info(),
            authority: intent_vault.to_account_info(),
        },
        signer_seeds,
    );
    transfer(transfer_to_keeper, params.swap_amount)?;

    // 2. Transfer output tokens from keeper directly to user
    let transfer_to_user = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.keeper_output_token.to_account_info(),
            to: ctx.accounts.user_output_token.to_account_info(),
            authority: ctx.accounts.keeper.to_account_info(),
        },
    );
    transfer(transfer_to_user, params.received_amount)?;

    // Update totals
    intent_vault.total_spent = intent_vault
        .total_spent
        .checked_add(params.swap_amount)
        .ok_or(KryptosError::MathOverflow)?;

    intent_vault.total_received = intent_vault
        .total_received
        .checked_add(params.received_amount)
        .ok_or(KryptosError::MathOverflow)?;

    intent_vault.chunks_executed += 1;

    // Check if all chunks executed
    if intent_vault.chunks_executed >= intent_vault.num_chunks {
        intent_vault.status = IntentStatus::Executed;
        intent_vault.executed_at = current_time;
        msg!("Intent fully executed!");
    }

    // Emit execution event
    emit!(IntentExecuted {
        vault: intent_vault.key(),
        authority: intent_vault.authority,
        amount_spent: params.swap_amount,
        amount_received: params.received_amount,
        executed_at: current_time,
    });

    msg!("Intent execution successful");
    msg!("Chunk {}/{}", intent_vault.chunks_executed, intent_vault.num_chunks);

    Ok(())
}
