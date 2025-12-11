# KRYPTOS

<div align="center">
  <img src="app/public/logo.png" alt="KRYPTOS Logo" width="120" />
  
  **The Private DeFi Agent on Solana**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](https://opensource.org/licenses/MIT)
  [![Solana](https://img.shields.io/badge/Solana-Mainnet-black.svg)](https://solana.com)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
  [![Rust](https://img.shields.io/badge/Rust-1.89-orange.svg)](https://www.rust-lang.org/)
  [![Anchor](https://img.shields.io/badge/Anchor-0.32-purple.svg)](https://www.anchor-lang.com/)

  [Website](https://kryptosagent.xyz) • [Launch App](https://kryptosagent.xyz/app) • [Documentation](https://kryptosagent.xyz/docs) • [Twitter](https://x.com/kryptos_fi) • [$KRYPTOS](https://solscan.io/token/9Uoz8X9wt4oC5sDJUxE4xaHarA9pctQm91Npctdspump)
</div>

---

## Overview

KRYPTOS is a privacy-first DeFi agent that lets you interact with Solana through natural language. No complex dashboards, no confusing interfaces — just type what you want to do.

```
"Swap 1 SOL to USDC"
"Drop 0.1 SOL to friend@email.com"
"Burn 100 BONK"
"Check my balance"
```

Your agent handles the rest with built-in privacy features.

## Features

### 🔒 Privacy-First Architecture
- **Stealth Execution** — Transactions routed through private channels, invisible to front-runners
- **Timing Obfuscation** — DCA orders executed with randomized timing and amounts
- **MEV Protection** — Built-in protection against sandwich attacks

### 💬 Natural Language Interface
- **Conversational Trading** — Type commands like you're texting a friend
- **AI-Powered Parsing** — Understands context and intent, not just keywords
- **Multi-Language Support** — English and Indonesian supported

### 🎁 Drop Links
- **Send to Anyone** — Send crypto via shareable links, no wallet needed
- **Zero Friction** — Recipients claim with email, Google, or X
- **Gasless Claims** — We sponsor all transaction fees for recipients
- **Auto Wallets** — Wallets created automatically on claim
- **Full Custody** — Recipients can export private keys anytime
- **Auto Refund** — Unclaimed drops return after 7 days
- **All Tokens** — Supports SOL, SPL tokens, and Token-2022

### 🔥 Token Burns
- **Permanent Removal** — Burn unwanted tokens from your wallet
- **Flexible Amounts** — Burn specific amount, percentage, or all
- **Full Token Support** — Works with SPL and Token-2022 tokens
- **Clean Portfolio** — Remove dust and scam tokens

### 💸 Transfers
- **Direct Transfers** — Send tokens to any Solana wallet address
- **All Tokens** — Supports SOL, SPL, and Token-2022
- **Simple Commands** — Just type "Send 10 USDC to [address]"

### ⚡ Core Capabilities
- **Instant Swaps** — Optimal routing across all Solana DEXes
- **Private DCA Vaults** — On-chain automated strategies with privacy features
- **Limit Orders** — Set price targets and auto-execute when conditions are met
- **Token Lookup** — Check any token info by symbol or contract address
- **Portfolio Tracking** — View balances across all holdings

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        KRYPTOS                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Next.js   │    │   Anchor    │    │   Keeper    │     │
│  │  Frontend   │───▶│  Programs   │◀───│   Service   │     │
│  │             │    │  (on-chain) │    │  (off-chain)│     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  LLM Agent  │    │ DCA Vaults  │    │  DEX Agg.   │     │
│  │ (OpenRouter)│    │ Drop Escrow │    │  (Jupiter)  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                             │                               │
│                             ▼                               │
│                      ┌─────────────┐                        │
│                      │   Privy     │                        │
│                      │  (Wallets)  │                        │
│                      └─────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component | Description | Tech Stack |
|-----------|-------------|------------|
| **Frontend** | Chat-based interface for user interaction | Next.js 16, React 19, TailwindCSS 4 |
| **DCA Program** | On-chain DCA vaults and limit orders | Anchor 0.32, Rust 1.89 |
| **Drop Program** | On-chain escrow for drop links | Anchor 0.32, Rust 1.89 |
| **Keeper Service** | Automated DCA execution with randomization | Node.js 20, TypeScript 5 |
| **LLM Agent** | Natural language parsing and intent detection | OpenRouter API |
| **Auth Provider** | Embedded wallets for drop claims | Privy |

## Quick Start

### Prerequisites

- Node.js 20+
- Rust 1.89+ & Anchor CLI 0.32+ (for smart contract development)
- Solana CLI
- A Solana wallet with SOL for transactions

### Installation

```bash
# Clone the repository
git clone https://github.com/kryptosagent/kryptos.git
cd kryptos

# Install frontend dependencies
cd app
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

### Environment Variables

```env
# Required
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_HELIUS_RPC=your_helius_rpc_url
OPENROUTER_API_KEY=your_openrouter_key

# Optional
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key
```

## Smart Contracts

KRYPTOS smart contracts are deployed on Solana Mainnet:

| Program | Address | Description |
|---------|---------|-------------|
| **KRYPTOS DCA** | `F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2` | DCA vaults, limit orders |
| **KRYPTOS Drop** | `CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK` | Drop links, escrow, claims |

### Instructions

**DCA Program:**

| Instruction | Description |
|-------------|-------------|
| `initialize_dca` | Create a new DCA vault with parameters |
| `withdraw_dca` | Withdraw funds from an active vault |
| `close_dca` | Close an empty vault and reclaim rent |
| `execute_dca` | Execute a DCA order (keeper only) |
| `create_intent` | Create a limit order with price trigger |
| `withdraw_intent` | Withdraw funds from a limit order |
| `close_intent` | Close an empty intent vault and reclaim rent |
| `execute_intent` | Execute a limit order when price target is hit (keeper only) |

**Drop Program:**

| Instruction | Description |
|-------------|-------------|
| `create_drop` | Create a new drop with escrow |
| `create_drop_sol` | Create a native SOL drop |
| `claim_drop` | Claim tokens from a drop |
| `claim_drop_sol` | Claim native SOL from a drop |
| `refund_drop` | Refund expired unclaimed drop to creator |

### DCA Vault Features

- **Frequency Options**: Hourly, Daily, Weekly
- **Amount Variance**: ±20% randomization per execution
- **Timing Variance**: Randomized execution within time windows
- **MEV Protection**: Transactions submitted through private channels

## Keeper Service

The keeper service monitors active DCA vaults and executes orders:

```bash
cd keeper
npm install
npm run build
npm start
```

### Configuration

```env
SOLANA_RPC_URL=your_rpc_url
KEEPER_PRIVATE_KEY=your_keeper_wallet_private_key
PROGRAM_ID=F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2
DCA_CHECK_INTERVAL=60
INTENT_CHECK_INTERVAL=30
```

## Commands Reference

| Command | Example | Description |
|---------|---------|-------------|
| **Drop** | `Drop 0.1 SOL to friend@email.com` | Send crypto via shareable link |
| **Drop Token** | `Drop 100 USDC via link` | Drop any SPL/Token-2022 token |
| **Burn** | `Burn 100 BONK` | Burn specific token amount |
| **Burn %** | `Burn 50% USDC` | Burn percentage of balance |
| **Burn All** | `Burn all WIF` | Burn entire token balance |
| **Transfer** | `Send 10 USDC to <address>` | Transfer to any wallet |
| **Swap** | `Swap 1 SOL to USDC` | Instant token swap |
| **DCA** | `DCA 100 USDC to SOL daily for 7 days` | Create DCA vault |
| **List DCA** | `My DCAs` | View active DCA vaults |
| **Withdraw DCA** | `Withdraw DCA USDC to SOL` | Withdraw from DCA vault |
| **Close DCA** | `Close DCA USDC to SOL` | Close vault, reclaim rent |
| **Limit Order** | `Buy SOL when price drops to $200` | Create limit order |
| **List Limits** | `My limit orders` | View active limit orders |
| **Cancel Limit** | `Cancel limit order` | Cancel and withdraw funds |
| **Balance** | `Check my balance` | View portfolio |
| **Price** | `Price of SOL` | Get token price |
| **Token** | `Token <address>` | Lookup token info |
| **Help** | `Help` | Show all commands |

## Security

- **Non-Custodial**: Users maintain full control of their wallets
- **Open Source**: All code is publicly auditable
- **On-Chain Logic**: Critical operations executed via smart contract
- **No Tracking**: No analytics, no wallet tracking, no data collection

### Responsible Disclosure

Found a vulnerability? Please email [hello@kryptosagent.xyz](mailto:hello@kryptosagent.xyz)

## Contributing

We welcome contributions! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Website**: [kryptosagent.xyz](https://kryptosagent.xyz)
- **App**: [kryptosagent.xyz/app](https://kryptosagent.xyz/app)
- **Documentation**: [kryptosagent.xyz/docs](https://kryptosagent.xyz/docs)
- **Twitter**: [@kryptos_fi](https://x.com/kryptos_fi)
- **Email**: [hello@kryptosagent.xyz](mailto:hello@kryptosagent.xyz)
- **Token**: [$KRYPTOS](https://solscan.io/token/9Uoz8X9wt4oC5sDJUxE4xaHarA9pctQm91Npctdspump)

---

<div align="center">
  <strong>Built with privacy in mind. Powered by Solana.</strong>
  
  <br/><br/>
  
  Made by the KRYPTOS team
</div>