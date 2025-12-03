use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint, Transfer, transfer};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::{IntentVault, IntentType, TriggerType, ExecutionStyle, IntentStatus};
use crate::errors::KryptosError;
use crate::events::IntentCreated;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateIntentParams {
    /// Unique nonce to allow multiple intents (user-provided)
    pub nonce: u64,
    /// Intent type (Buy = 0, Sell = 1, Swap = 2)
    pub intent_type: u8,
    /// Amount to use for the intent
    pub amount: u64,
    /// Trigger type (PriceAbove = 0, PriceBelow = 1, PriceRange = 2)
    pub trigger_type: u8,
    /// Trigger price in USD (6 decimals)
    pub trigger_price: u64,
    /// Upper bound for PriceRange trigger (0 if not used)
    pub trigger_price_max: u64,
    /// Execution style (Immediate = 0, Stealth = 1, Twap = 2)
    pub execution_style: u8,
    /// Number of chunks for Stealth/TWAP (1 for Immediate)
    pub num_chunks: u8,
    /// Expiry time in seconds from now
    pub expiry_seconds: i64,
}

#[derive(Accounts)]
#[instruction(params: CreateIntentParams)]
pub struct CreateIntent<'info> {
    /// User creating the intent
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Intent vault PDA (using nonce for uniqueness)
    #[account(
        init,
        payer = authority,
        space = IntentVault::SPACE,
        seeds = [
            IntentVault::SEED_PREFIX,
            authority.key().as_ref(),
            input_mint.key().as_ref(),
            &params.nonce.to_le_bytes(),
        ],
        bump
    )]
    pub intent_vault: Account<'info, IntentVault>,

    /// Input token mint
    pub input_mint: Account<'info, Mint>,

    /// Output token mint
    pub output_mint: Account<'info, Mint>,

    /// User's input token account
    #[account(
        mut,
        constraint = user_input_token.mint == input_mint.key() @ KryptosError::InvalidMint,
        constraint = user_input_token.owner == authority.key() @ KryptosError::Unauthorized,
    )]
    pub user_input_token: Account<'info, TokenAccount>,

    /// Vault's input token account
    #[account(
        init,
        payer = authority,
        seeds = [
            b"intent_input_vault",
            intent_vault.key().as_ref(),
        ],
        bump,
        token::mint = input_mint,
        token::authority = intent_vault,
    )]
    pub vault_input_token: Account<'info, TokenAccount>,

    /// System program
    pub system_program: Program<'info, System>,

    /// Token program
    pub token_program: Program<'info, Token>,

    /// Associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateIntent>, params: CreateIntentParams) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Validate parameters
    require!(params.amount > 0, KryptosError::InvalidAmount);
    require!(params.trigger_price > 0, KryptosError::InvalidTriggerPrice);
    require!(params.expiry_seconds > 0, KryptosError::InvalidExpiryTime);

    // Parse intent type
    let intent_type = match params.intent_type {
        0 => IntentType::Buy,
        1 => IntentType::Sell,
        2 => IntentType::Swap,
        _ => return Err(KryptosError::InvalidAmount.into()),
    };

    // Parse trigger type
    let trigger_type = match params.trigger_type {
        0 => TriggerType::PriceAbove,
        1 => TriggerType::PriceBelow,
        2 => {
            // Validate price range
            require!(
                params.trigger_price_max > params.trigger_price,
                KryptosError::InvalidPriceRange
            );
            TriggerType::PriceRange
        }
        _ => return Err(KryptosError::InvalidTriggerPrice.into()),
    };

    // Parse execution style
    let execution_style = match params.execution_style {
        0 => ExecutionStyle::Immediate,
        1 => ExecutionStyle::Stealth,
        2 => ExecutionStyle::Twap,
        _ => ExecutionStyle::Immediate,
    };

    // Calculate expiry
    let expires_at = current_time + params.expiry_seconds;

    // Initialize intent vault
    let intent_vault = &mut ctx.accounts.intent_vault;
    intent_vault.authority = ctx.accounts.authority.key();
    intent_vault.intent_type = intent_type;
    intent_vault.input_mint = ctx.accounts.input_mint.key();
    intent_vault.output_mint = ctx.accounts.output_mint.key();
    intent_vault.input_vault = ctx.accounts.vault_input_token.key();
    intent_vault.amount = params.amount;
    intent_vault.trigger_type = trigger_type;
    intent_vault.trigger_price = params.trigger_price;
    intent_vault.trigger_price_max = params.trigger_price_max;
    intent_vault.execution_style = execution_style;
    intent_vault.num_chunks = params.num_chunks.max(1);
    intent_vault.chunks_executed = 0;
    intent_vault.expires_at = expires_at;
    intent_vault.triggered_at = 0;
    intent_vault.executed_at = 0;
    intent_vault.created_at = current_time;
    intent_vault.status = IntentStatus::Monitoring;
    intent_vault.total_spent = 0;
    intent_vault.total_received = 0;
    intent_vault.bump = ctx.bumps.intent_vault;
    intent_vault.vault_bump = ctx.bumps.vault_input_token;

    // Transfer tokens from user to vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_input_token.to_account_info(),
            to: ctx.accounts.vault_input_token.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    transfer(transfer_ctx, params.amount)?;

    // Emit event
    emit!(IntentCreated {
        vault: intent_vault.key(),
        authority: intent_vault.authority,
        intent_type: params.intent_type,
        input_mint: intent_vault.input_mint,
        output_mint: intent_vault.output_mint,
        amount: intent_vault.amount,
        trigger_price: intent_vault.trigger_price,
        expires_at: intent_vault.expires_at,
        created_at: current_time,
    });

    msg!("Intent created successfully");
    msg!("Vault: {}", intent_vault.key());
    msg!("Trigger price: {}", params.trigger_price);
    msg!("Expires at: {}", expires_at);

    Ok(())
}
