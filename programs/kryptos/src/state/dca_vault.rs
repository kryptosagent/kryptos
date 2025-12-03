use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct DcaVault {
    // === Owner ===
    /// User who created this DCA
    pub authority: Pubkey,
    
    // === Token Config ===
    /// Token to spend (e.g., USDC)
    pub input_mint: Pubkey,
    /// Token to buy (e.g., SOL)
    pub output_mint: Pubkey,
    /// Token account vault holding input tokens
    pub input_vault: Pubkey,
    /// Token account to receive output tokens
    pub output_vault: Pubkey,
    
    // === DCA Config ===
    /// Total amount to DCA (in smallest unit)
    pub total_amount: u64,
    /// Amount per execution (base, before variance)
    pub amount_per_trade: u64,
    /// Variance in basis points (e.g., 2000 = 20%)
    pub variance_bps: u16,
    /// Minimum number of executions per week
    pub min_executions: u8,
    /// Maximum number of executions per week
    pub max_executions: u8,
    
    // === Time Window ===
    /// Execution window start hour (UTC, 0-23)
    pub window_start_hour: u8,
    /// Execution window end hour (UTC, 0-23)
    pub window_end_hour: u8,
    
    // === Tracking ===
    /// Total amount spent so far
    pub total_spent: u64,
    /// Total amount received so far
    pub total_received: u64,
    /// Number of executions completed
    pub execution_count: u32,
    /// Timestamp of last execution
    pub last_execution: i64,
    /// Timestamp of next execution (randomized)
    pub next_execution: i64,
    
    // === Status ===
    /// Whether DCA is still active
    pub is_active: bool,
    /// Creation timestamp
    pub created_at: i64,
    
    // === PDA Bumps ===
    pub bump: u8,
    pub input_vault_bump: u8,
    pub output_vault_bump: u8,
}

impl DcaVault {
    /// Account space (8 discriminator + fields)
    pub const SPACE: usize = 8 +  // discriminator
        32 +    // authority
        32 +    // input_mint
        32 +    // output_mint
        32 +    // input_vault
        32 +    // output_vault
        8 +     // total_amount
        8 +     // amount_per_trade
        2 +     // variance_bps
        1 +     // min_executions
        1 +     // max_executions
        1 +     // window_start_hour
        1 +     // window_end_hour
        8 +     // total_spent
        8 +     // total_received
        4 +     // execution_count
        8 +     // last_execution
        8 +     // next_execution
        1 +     // is_active
        8 +     // created_at
        1 +     // bump
        1 +     // input_vault_bump
        1 +     // output_vault_bump
        64;     // padding for future use

    /// PDA seeds prefix
    pub const SEED_PREFIX: &'static [u8] = b"dca_vault";
    
    /// Check if DCA is completed
    pub fn is_completed(&self) -> bool {
        self.total_spent >= self.total_amount
    }
    
    /// Check if execution is allowed now
    pub fn can_execute(&self, current_time: i64) -> bool {
        self.is_active 
            && !self.is_completed()
            && current_time >= self.next_execution
    }
}
