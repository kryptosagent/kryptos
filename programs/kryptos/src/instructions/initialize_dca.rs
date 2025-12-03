use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint, Transfer, transfer};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::DcaVault;
use crate::errors::KryptosError;
use crate::events::DcaCreated;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeDcaParams {
    /// Total amount to DCA (in smallest unit)
    pub total_amount: u64,
    /// Amount per execution (base amount)
    pub amount_per_trade: u64,
    /// Variance in basis points (e.g., 2000 = 20%, max 5000 = 50%)
    pub variance_bps: u16,
    /// Minimum executions per week
    pub min_executions: u8,
    /// Maximum executions per week
    pub max_executions: u8,
    /// Execution window start hour (UTC, 0-23)
    pub window_start_hour: u8,
    /// Execution window end hour (UTC, 0-23)
    pub window_end_hour: u8,
}

#[derive(Accounts)]
#[instruction(params: InitializeDcaParams)]
pub struct InitializeDca<'info> {
    /// User creating the DCA
    #[account(mut)]
    pub authority: Signer<'info>,

    /// DCA vault PDA
    #[account(
        init,
        payer = authority,
        space = DcaVault::SPACE,
        seeds = [
            DcaVault::SEED_PREFIX,
            authority.key().as_ref(),
            input_mint.key().as_ref(),
            output_mint.key().as_ref(),
        ],
        bump
    )]
    pub dca_vault: Account<'info, DcaVault>,

    /// Input token mint (token to spend)
    pub input_mint: Account<'info, Mint>,

    /// Output token mint (token to buy)
    pub output_mint: Account<'info, Mint>,

    /// User's input token account (source of funds)
    #[account(
        mut,
        constraint = user_input_token.mint == input_mint.key() @ KryptosError::InvalidMint,
        constraint = user_input_token.owner == authority.key() @ KryptosError::Unauthorized,
    )]
    pub user_input_token: Account<'info, TokenAccount>,

    /// Vault's input token account (holds deposited funds)
    #[account(
        init,
        payer = authority,
        seeds = [
            b"input_vault",
            dca_vault.key().as_ref(),
        ],
        bump,
        token::mint = input_mint,
        token::authority = dca_vault,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// Vault's output token account (receives swapped tokens)
    #[account(
        init,
        payer = authority,
        seeds = [
            b"output_vault",
            dca_vault.key().as_ref(),
        ],
        bump,
        token::mint = output_mint,
        token::authority = dca_vault,
    )]
    pub vault_output_token: Account<'info, TokenAccount>,

    /// System program
    pub system_program: Program<'info, System>,

    /// Token program
    pub token_program: Program<'info, Token>,

    /// Associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeDca>, params: InitializeDcaParams) -> Result<()> {
    // Validate parameters
    require!(params.total_amount > 0, KryptosError::InvalidAmount);
    require!(params.amount_per_trade > 0, KryptosError::InvalidAmount);
    require!(params.variance_bps <= 5000, KryptosError::InvalidVariance);
    require!(
        params.min_executions > 0 && params.max_executions >= params.min_executions,
        KryptosError::InvalidExecutionRange
    );
    require!(
        params.window_start_hour < 24 && params.window_end_hour < 24,
        KryptosError::InvalidTimeWindow
    );

    // Get current timestamp
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Calculate initial next_execution (randomized within first day)
    // For simplicity, we'll set it to current_time + 1 hour initially
    // The keeper will randomize subsequent executions
    let next_execution = current_time + 3600; // 1 hour from now

    // Initialize DCA vault
    let dca_vault = &mut ctx.accounts.dca_vault;
    dca_vault.authority = ctx.accounts.authority.key();
    dca_vault.input_mint = ctx.accounts.input_mint.key();
    dca_vault.output_mint = ctx.accounts.output_mint.key();
    dca_vault.input_vault = ctx.accounts.vault_input_token.key();
    dca_vault.output_vault = ctx.accounts.vault_output_token.key();
    dca_vault.total_amount = params.total_amount;
    dca_vault.amount_per_trade = params.amount_per_trade;
    dca_vault.variance_bps = params.variance_bps;
    dca_vault.min_executions = params.min_executions;
    dca_vault.max_executions = params.max_executions;
    dca_vault.window_start_hour = params.window_start_hour;
    dca_vault.window_end_hour = params.window_end_hour;
    dca_vault.total_spent = 0;
    dca_vault.total_received = 0;
    dca_vault.execution_count = 0;
    dca_vault.last_execution = 0;
    dca_vault.next_execution = next_execution;
    dca_vault.is_active = true;
    dca_vault.created_at = current_time;
    dca_vault.bump = ctx.bumps.dca_vault;
    dca_vault.input_vault_bump = ctx.bumps.vault_input_token;
    dca_vault.output_vault_bump = ctx.bumps.vault_output_token;

    // Transfer tokens from user to vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_input_token.to_account_info(),
            to: ctx.accounts.vault_input_token.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    transfer(transfer_ctx, params.total_amount)?;

    // Emit event
    emit!(DcaCreated {
        vault: dca_vault.key(),
        authority: dca_vault.authority,
        input_mint: dca_vault.input_mint,
        output_mint: dca_vault.output_mint,
        total_amount: dca_vault.total_amount,
        created_at: current_time,
    });

    msg!("DCA vault created successfully");
    msg!("Vault: {}", dca_vault.key());
    msg!("Total amount: {}", params.total_amount);

    Ok(())
}
