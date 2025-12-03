use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, CloseAccount, close_account};

use crate::state::{DcaVault, IntentVault, IntentStatus};
use crate::errors::KryptosError;

// ============================================
// CLOSE DCA VAULT
// ============================================

#[derive(Accounts)]
pub struct CloseDca<'info> {
    /// Owner of the DCA vault
    #[account(mut)]
    pub authority: Signer<'info>,

    /// DCA vault to close
    #[account(
        mut,
        close = authority,
        constraint = dca_vault.authority == authority.key() @ KryptosError::Unauthorized,
        constraint = !dca_vault.is_active @ KryptosError::DcaNotActive,
    )]
    pub dca_vault: Account<'info, DcaVault>,

    /// Vault's input token account (must be empty)
    #[account(
        mut,
        constraint = vault_input_token.key() == dca_vault.input_vault @ KryptosError::TokenAccountMismatch,
        constraint = vault_input_token.amount == 0 @ KryptosError::DcaHasRemainingFunds,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// Vault's output token account (must be empty)
    #[account(
        mut,
        constraint = vault_output_token.key() == dca_vault.output_vault @ KryptosError::TokenAccountMismatch,
        constraint = vault_output_token.amount == 0 @ KryptosError::DcaHasRemainingFunds,
    )]
    pub vault_output_token: Account<'info, TokenAccount>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

pub fn handler_close_dca(ctx: Context<CloseDca>) -> Result<()> {
    let dca_vault = &ctx.accounts.dca_vault;

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

    // Close input token account
    let close_input_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault_input_token.to_account_info(),
            destination: ctx.accounts.authority.to_account_info(),
            authority: dca_vault.to_account_info(),
        },
        signer_seeds,
    );
    close_account(close_input_ctx)?;

    // Close output token account
    let close_output_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault_output_token.to_account_info(),
            destination: ctx.accounts.authority.to_account_info(),
            authority: dca_vault.to_account_info(),
        },
        signer_seeds,
    );
    close_account(close_output_ctx)?;

    msg!("DCA vault closed successfully");
    msg!("Rent reclaimed by: {}", ctx.accounts.authority.key());

    Ok(())
}

// ============================================
// CLOSE INTENT VAULT
// ============================================

#[derive(Accounts)]
pub struct CloseIntent<'info> {
    /// Owner of the intent vault
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Intent vault to close
    #[account(
        mut,
        close = authority,
        constraint = intent_vault.authority == authority.key() @ KryptosError::Unauthorized,
        constraint = intent_vault.status == IntentStatus::Executed 
            || intent_vault.status == IntentStatus::Cancelled 
            || intent_vault.status == IntentStatus::Expired 
            @ KryptosError::IntentNotMonitoring,
    )]
    pub intent_vault: Account<'info, IntentVault>,

    /// Vault's input token account (must be empty)
    #[account(
        mut,
        constraint = vault_input_token.key() == intent_vault.input_vault @ KryptosError::TokenAccountMismatch,
        constraint = vault_input_token.amount == 0 @ KryptosError::IntentHasRemainingFunds,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

pub fn handler_close_intent(ctx: Context<CloseIntent>) -> Result<()> {
    let intent_vault = &ctx.accounts.intent_vault;

    // Prepare PDA signer seeds (using nonce)
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

    // Close input token account
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault_input_token.to_account_info(),
            destination: ctx.accounts.authority.to_account_info(),
            authority: intent_vault.to_account_info(),
        },
        signer_seeds,
    );
    close_account(close_ctx)?;

    msg!("Intent vault closed successfully");
    msg!("Rent reclaimed by: {}", ctx.accounts.authority.key());

    Ok(())
}
