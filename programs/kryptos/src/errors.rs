use anchor_lang::prelude::*;

#[error_code]
pub enum KryptosError {
    // === General Errors ===
    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Invalid amount provided")]
    InvalidAmount,

    #[msg("Insufficient funds")]
    InsufficientFunds,

    #[msg("Math overflow occurred")]
    MathOverflow,

    // === DCA Errors ===
    #[msg("DCA vault is not active")]
    DcaNotActive,

    #[msg("DCA has already completed")]
    DcaCompleted,

    #[msg("DCA execution not yet allowed")]
    DcaExecutionNotAllowed,

    #[msg("Invalid execution time window")]
    InvalidTimeWindow,

    #[msg("Invalid variance basis points (max 5000 = 50%)")]
    InvalidVariance,

    #[msg("Invalid execution count range")]
    InvalidExecutionRange,

    #[msg("DCA vault still has remaining funds")]
    DcaHasRemainingFunds,

    // === Intent Errors ===
    #[msg("Intent has expired")]
    IntentExpired,

    #[msg("Intent is not in monitoring status")]
    IntentNotMonitoring,

    #[msg("Intent trigger condition not met")]
    TriggerConditionNotMet,

    #[msg("Intent already executed")]
    IntentAlreadyExecuted,

    #[msg("Intent already cancelled")]
    IntentAlreadyCancelled,

    #[msg("Invalid trigger price")]
    InvalidTriggerPrice,

    #[msg("Invalid price range (min must be less than max)")]
    InvalidPriceRange,

    #[msg("Invalid expiry time (must be in the future)")]
    InvalidExpiryTime,

    #[msg("Intent vault still has remaining funds")]
    IntentHasRemainingFunds,

    // === Swap Errors ===
    #[msg("Swap failed")]
    SwapFailed,

    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    #[msg("Invalid swap route")]
    InvalidSwapRoute,

    // === Token Errors ===
    #[msg("Invalid token mint")]
    InvalidMint,

    #[msg("Token account mismatch")]
    TokenAccountMismatch,

    // === Keeper Errors ===
    #[msg("Invalid keeper authority")]
    InvalidKeeper,
}
