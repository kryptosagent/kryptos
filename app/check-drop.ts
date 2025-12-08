import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK');
const dropId = 'xwk8cg4yjob7';
const creator = new PublicKey('88hWnaJYUimQNc28rZXHAzaQwwBKpavLS4Pt8YAUaBvN');

const [escrowPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('escrow'), Buffer.from(dropId), creator.toBuffer()],
  PROGRAM_ID
);

console.log('Expected Escrow PDA:', escrowPda.toBase58());

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

async function main() {
  const info = await connection.getAccountInfo(escrowPda);
  if (info) {
    console.log('✅ Account exists!');
    console.log('Owner:', info.owner.toBase58());
    console.log('Data length:', info.data.length);
  } else {
    console.log('❌ Account NOT found');
  }
}

main().catch(console.error);
