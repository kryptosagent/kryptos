use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};

use crate::state::{DcaVault, IntentVault, IntentStatus};
use crate::errors::KryptosError;
use crate::events::{DcaCancelled, IntentCancelled, FundsWithdrawn};

// ============================================
// WITHDRAW FROM DCA VAULT
// ============================================

#[derive(Accounts)]
pub struct WithdrawDca<'info> {
    /// Owner of the DCA vault
    #[account(mut)]
    pub authority: Signer<'info>,

    /// DCA vault to withdraw from
    #[account(
        mut,
        constraint = dca_vault.authority == authority.key() @ KryptosError::Unauthorized,
    )]
    pub dca_vault: Account<'info, DcaVault>,

    /// Vault's input token account
    #[account(
        mut,
        constraint = vault_input_token.key() == dca_vault.input_vault @ KryptosError::TokenAccountMismatch,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// Vault's output token account
    #[account(
        mut,
        constraint = vault_output_token.key() == dca_vault.output_vault @ KryptosError::TokenAccountMismatch,
    )]
    pub vault_output_token: Account<'info, TokenAccount>,

    /// User's input token account (to receive remaining input)
    #[account(mut)]
    pub user_input_token: Account<'info, TokenAccount>,

    /// User's output token account (to receive accumulated output)
    #[account(mut)]
    pub user_output_token: Account<'info, TokenAccount>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

pub fn handler_withdraw_dca(ctx: Context<WithdrawDca>) -> Result<()> {
    let dca_vault = &mut ctx.accounts.dca_vault;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Get remaining balances
    let remaining_input = ctx.accounts.vault_input_token.amount;
    let accumulated_output = ctx.accounts.vault_output_token.amount;

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

    // Transfer remaining input tokens back to user
    if remaining_input > 0 {
        let transfer_input_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_input_token.to_account_info(),
                to: ctx.accounts.user_input_token.to_account_info(),
                authority: dca_vault.to_account_info(),
            },
            signer_seeds,
        );
        transfer(transfer_input_ctx, remaining_input)?;
    }

    // Transfer accumulated output tokens to user
    if accumulated_output > 0 {
        let transfer_output_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_output_token.to_account_info(),
                to: ctx.accounts.user_output_token.to_account_info(),
                authority: dca_vault.to_account_info(),
            },
            signer_seeds,
        );
        transfer(transfer_output_ctx, accumulated_output)?;
    }

    // Deactivate DCA
    dca_vault.is_active = false;

    // Emit events
    emit!(DcaCancelled {
        vault: dca_vault.key(),
        authority: dca_vault.authority,
        remaining_amount: remaining_input,
        cancelled_at: current_time,
    });

    emit!(FundsWithdrawn {
        vault: dca_vault.key(),
        authority: dca_vault.authority,
        amount: remaining_input + accumulated_output,
        vault_type: "DCA".to_string(),
        withdrawn_at: current_time,
    });

    msg!("DCA withdrawn successfully");
    msg!("Input returned: {}", remaining_input);
    msg!("Output claimed: {}", accumulated_output);

    Ok(())
}

// ============================================
// WITHDRAW FROM INTENT VAULT
// ============================================

#[derive(Accounts)]
pub struct WithdrawIntent<'info> {
    /// Owner of the intent vault
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Intent vault to withdraw from
    #[account(
        mut,
        constraint = intent_vault.authority == authority.key() @ KryptosError::Unauthorized,
        constraint = intent_vault.status != IntentStatus::Executed @ KryptosError::IntentAlreadyExecuted,
    )]
    pub intent_vault: Account<'info, IntentVault>,

    /// Vault's input token account
    #[account(
        mut,
        constraint = vault_input_token.key() == intent_vault.input_vault @ KryptosError::TokenAccountMismatch,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// User's input token account
    #[account(mut)]
    pub user_input_token: Account<'info, TokenAccount>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

pub fn handler_withdraw_intent(ctx: Context<WithdrawIntent>) -> Result<()> {
    let intent_vault = &mut ctx.accounts.intent_vault;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Get remaining balance
    let remaining_amount = ctx.accounts.vault_input_token.amount;

    // Prepare PDA signer seeds (using nonce instead of created_at)
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

    // Transfer remaining tokens back to user
    if remaining_amount > 0 {
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_input_token.to_account_info(),
                to: ctx.accounts.user_input_token.to_account_info(),
                authority: intent_vault.to_account_info(),
            },
            signer_seeds,
        );
        transfer(transfer_ctx, remaining_amount)?;
    }

    // Update status
    intent_vault.status = IntentStatus::Cancelled;

    // Emit events
    emit!(IntentCancelled {
        vault: intent_vault.key(),
        authority: intent_vault.authority,
        remaining_amount,
        cancelled_at: current_time,
    });

    emit!(FundsWithdrawn {
        vault: intent_vault.key(),
        authority: intent_vault.authority,
        amount: remaining_amount,
        vault_type: "Intent".to_string(),
        withdrawn_at: current_time,
    });

    msg!("Intent withdrawn successfully");
    msg!("Amount returned: {}", remaining_amount);

    Ok(())
}
