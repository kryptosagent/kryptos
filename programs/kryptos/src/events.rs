use anchor_lang::prelude::*;

// === DCA Events ===

#[event]
pub struct DcaCreated {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub total_amount: u64,
    pub created_at: i64,
}

#[event]
pub struct DcaExecuted {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub amount_spent: u64,
    pub amount_received: u64,
    pub execution_count: u32,
    pub next_execution: i64,
    pub executed_at: i64,
}

#[event]
pub struct DcaCancelled {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub remaining_amount: u64,
    pub cancelled_at: i64,
}

#[event]
pub struct DcaCompleted {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub total_spent: u64,
    pub total_received: u64,
    pub execution_count: u32,
    pub completed_at: i64,
}

// === Intent Events ===

#[event]
pub struct IntentCreated {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub intent_type: u8,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub amount: u64,
    pub trigger_price: u64,
    pub expires_at: i64,
    pub created_at: i64,
}

#[event]
pub struct IntentTriggered {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub trigger_price: u64,
    pub current_price: u64,
    pub triggered_at: i64,
}

#[event]
pub struct IntentExecuted {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub amount_spent: u64,
    pub amount_received: u64,
    pub executed_at: i64,
}

#[event]
pub struct IntentCancelled {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub remaining_amount: u64,
    pub cancelled_at: i64,
}

#[event]
pub struct IntentExpired {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub expired_at: i64,
}

// === Withdrawal Events ===

#[event]
pub struct FundsWithdrawn {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
    pub vault_type: String,
    pub withdrawn_at: i64,
}
