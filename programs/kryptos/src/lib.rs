use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Re-export everything from instructions (includes Anchor-generated modules)
pub use instructions::*;

declare_id!("F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2");

#[program]
pub mod kryptos {
    use super::*;

    // ============================================
    // DCA INSTRUCTIONS
    // ============================================

    pub fn initialize_dca(
        ctx: Context<InitializeDca>,
        params: InitializeDcaParams,
    ) -> Result<()> {
        instructions::initialize_dca::handler(ctx, params)
    }

    pub fn execute_dca(
        ctx: Context<ExecuteDca>,
        params: ExecuteDcaParams,
    ) -> Result<()> {
        instructions::execute_dca::handler(ctx, params)
    }

    pub fn withdraw_dca(ctx: Context<WithdrawDca>) -> Result<()> {
        instructions::withdraw::handler_withdraw_dca(ctx)
    }

    pub fn close_dca(ctx: Context<CloseDca>) -> Result<()> {
        instructions::close::handler_close_dca(ctx)
    }

    // ============================================
    // INTENT INSTRUCTIONS
    // ============================================

    pub fn create_intent(
        ctx: Context<CreateIntent>,
        params: CreateIntentParams,
    ) -> Result<()> {
        instructions::create_intent::handler(ctx, params)
    }

    pub fn execute_intent(
        ctx: Context<ExecuteIntent>,
        params: ExecuteIntentParams,
    ) -> Result<()> {
        instructions::execute_intent::handler(ctx, params)
    }

    pub fn withdraw_intent(ctx: Context<WithdrawIntent>) -> Result<()> {
        instructions::withdraw::handler_withdraw_intent(ctx)
    }

    pub fn close_intent(ctx: Context<CloseIntent>) -> Result<()> {
        instructions::close::handler_close_intent(ctx)
    }
}
