export const KRYPTOS_PROGRAM_ID = 'F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2';

export const KRYPTOS_IDL = {
  "address": "F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2",
  "metadata": {
    "name": "kryptos",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "KRYPTOS - Privacy-focused DCA and Intent execution on Solana"
  },
  "instructions": [
    {
      "name": "close_dca",
      "discriminator": [22, 7, 33, 98, 168, 183, 34, 243],
      "accounts": [
        { "name": "authority", "writable": true, "signer": true },
        { "name": "dca_vault", "writable": true },
        { "name": "vault_input_token", "writable": true },
        { "name": "vault_output_token", "writable": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": []
    },
    {
      "name": "initialize_dca",
      "discriminator": [50, 254, 84, 15, 178, 10, 160, 191],
      "accounts": [
        { "name": "authority", "writable": true, "signer": true },
        { "name": "dca_vault", "writable": true },
        { "name": "input_mint" },
        { "name": "output_mint" },
        { "name": "user_input_token", "writable": true },
        { "name": "vault_input_token", "writable": true },
        { "name": "vault_output_token", "writable": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { "name": "associated_token_program", "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
        { "name": "rent", "address": "SysvarRent111111111111111111111111111111111" }
      ],
      "args": [
        { "name": "params", "type": { "defined": { "name": "InitializeDcaParams" } } }
      ]
    },
    {
      "name": "withdraw_dca",
      "discriminator": [48, 57, 69, 149, 154, 125, 2, 124],
      "accounts": [
        { "name": "authority", "writable": true, "signer": true },
        { "name": "dca_vault", "writable": true },
        { "name": "vault_input_token", "writable": true },
        { "name": "vault_output_token", "writable": true },
        { "name": "user_input_token", "writable": true },
        { "name": "user_output_token", "writable": true },
        { "name": "token_program", "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "DcaVault",
      "discriminator": [78, 168, 169, 28, 73, 18, 143, 249]
    }
  ],
  "types": [
    {
      "name": "InitializeDcaParams",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "total_amount", "type": "u64" },
          { "name": "amount_per_trade", "type": "u64" },
          { "name": "variance_bps", "type": "u16" },
          { "name": "min_executions", "type": "u8" },
          { "name": "max_executions", "type": "u8" },
          { "name": "window_start_hour", "type": "u8" },
          { "name": "window_end_hour", "type": "u8" }
        ]
      }
    },
    {
      "name": "DcaVault",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "input_mint", "type": "pubkey" },
          { "name": "output_mint", "type": "pubkey" },
          { "name": "input_vault", "type": "pubkey" },
          { "name": "output_vault", "type": "pubkey" },
          { "name": "total_amount", "type": "u64" },
          { "name": "amount_per_trade", "type": "u64" },
          { "name": "variance_bps", "type": "u16" },
          { "name": "min_executions", "type": "u8" },
          { "name": "max_executions", "type": "u8" },
          { "name": "window_start_hour", "type": "u8" },
          { "name": "window_end_hour", "type": "u8" },
          { "name": "total_spent", "type": "u64" },
          { "name": "total_received", "type": "u64" },
          { "name": "execution_count", "type": "u32" },
          { "name": "last_execution", "type": "i64" },
          { "name": "next_execution", "type": "i64" },
          { "name": "is_active", "type": "bool" },
          { "name": "created_at", "type": "i64" },
          { "name": "bump", "type": "u8" },
          { "name": "input_vault_bump", "type": "u8" },
          { "name": "output_vault_bump", "type": "u8" }
        ]
      }
    }
  ]
} as const;

export type InitializeDcaParams = {
  totalAmount: bigint;
  amountPerTrade: bigint;
  varianceBps: number;
  minExecutions: number;
  maxExecutions: number;
  windowStartHour: number;
  windowEndHour: number;
};