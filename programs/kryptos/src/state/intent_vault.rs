use anchor_lang::prelude::*;

/// Intent type enumeration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum IntentType {
    #[default]
    Buy,
    Sell,
    Swap,
}

/// Trigger type enumeration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum TriggerType {
    #[default]
    PriceAbove,
    PriceBelow,
    PriceRange,
}

/// Execution style enumeration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum ExecutionStyle {
    #[default]
    Immediate,
    Stealth,
    Twap,
}

/// Intent status enumeration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum IntentStatus {
    #[default]
    Monitoring,
    Triggered,
    Executing,
    Executed,
    Expired,
    Cancelled,
}

#[account]
#[derive(Default)]
pub struct IntentVault {
    // === Owner ===
    pub authority: Pubkey,
    
    // === Unique identifier ===
    pub nonce: u64,
    
    // === Intent Config ===
    pub intent_type: IntentType,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub input_vault: Pubkey,
    pub amount: u64,
    
    // === Trigger Conditions ===
    pub trigger_type: TriggerType,
    /// Trigger price in USD (6 decimals, e.g., 150000000 = $150)
    pub trigger_price: u64,
    /// For PriceRange: upper bound
    pub trigger_price_max: u64,
    
    // === Execution ===
    pub execution_style: ExecutionStyle,
    /// For Stealth/TWAP: number of chunks
    pub num_chunks: u8,
    /// Chunks already executed
    pub chunks_executed: u8,
    
    // === Timing ===
    pub expires_at: i64,
    pub triggered_at: i64,
    pub executed_at: i64,
    pub created_at: i64,
    
    // === Status ===
    pub status: IntentStatus,
    
    // === Tracking ===
    pub total_spent: u64,
    pub total_received: u64,
    
    // === Bumps ===
    pub bump: u8,
    pub vault_bump: u8,
}

impl IntentVault {
    /// Account space
    pub const SPACE: usize = 8 +  // discriminator
        32 +    // authority
        8 +     // nonce
        1 +     // intent_type
        32 +    // input_mint
        32 +    // output_mint
        32 +    // input_vault
        8 +     // amount
        1 +     // trigger_type
        8 +     // trigger_price
        8 +     // trigger_price_max
        1 +     // execution_style
        1 +     // num_chunks
        1 +     // chunks_executed
        8 +     // expires_at
        8 +     // triggered_at
        8 +     // executed_at
        8 +     // created_at
        1 +     // status
        8 +     // total_spent
        8 +     // total_received
        1 +     // bump
        1 +     // vault_bump
        64;     // padding

    /// PDA seeds prefix
    pub const SEED_PREFIX: &'static [u8] = b"intent_vault";
    
    /// Check if intent has expired
    pub fn is_expired(&self, current_time: i64) -> bool {
        current_time > self.expires_at
    }
    
    /// Check if trigger condition is met
    pub fn check_trigger(&self, current_price: u64) -> bool {
        match self.trigger_type {
            TriggerType::PriceAbove => current_price > self.trigger_price,
            TriggerType::PriceBelow => current_price < self.trigger_price,
            TriggerType::PriceRange => {
                current_price >= self.trigger_price && current_price <= self.trigger_price_max
            }
        }
    }
}
