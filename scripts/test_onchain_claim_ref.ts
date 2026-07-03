import * as fs from 'fs';
import * as path from 'path';
import {
  PAYROLL_CONTRACT_ID,
  RPC_URL,
  NETWORK_PASSPHRASE
} from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

const PAYROLL_ID = 'CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3';
if (!process.env.HR_SECRET) throw new Error("Set HR_SECRET env var to run this script.");
const HR_SECRET = process.env.HR_SECRET!;

async function waitForTx(server: stellarSdk.rpc.Server, hash: string): Promise<void> {
  while (true) {
    const status = await server.getTransaction(hash);
    if (status.status !== stellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      if (status.status !== stellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new Error(`Transaction ${hash} failed: ${status.status}`);
      }
      return;
    }
    console.log('  ⏳ Waiting for tx to finalize...');
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   TECTA ZK Payroll — On-Chain Claim Test (Ref Proof)     ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const server = new stellarSdk.rpc.Server(RPC_URL);
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);
  const hrAddress = hrKeypair.publicKey();
  console.log('HR Admin Address:', hrAddress);

  // Reference proof public inputs:
  // Root: 06782f383c44c8686ae4b9b69eb345be31a21da3f042bfd9e7e3cbb656433dc8
  // Nullifier: 071ab9043ff1105bf26fed30816d06417cd473e5b42a52f9e1a4312fb0866f43
  // Recipient: 0f6a82d7b3a47de6db3b608d0f4585631b487b7662b5efb56b896bd8c6e23991
  // Amount: 2000 (0x7d0)
  const rootHex = '06782f383c44c8686ae4b9b69eb345be31a21da3f042bfd9e7e3cbb656433dc8';
  const nullifierHex = '071ab9043ff1105bf26fed30816d06417cd473e5b42a52f9e1a4312fb0866f43';
  const amount = 2000;

  const proof = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof');

  // 1. Generate a Stellar Account for recipient matching the recipient field element (0x0f6a82d7b3a47de6db3b608d0f4585631b487b7662b5efb56b896bd8c6e23991)
  // Recipient field in reference proof corresponds to a 32-byte public key:
  const rawRecipientBytes = Buffer.from('0f6a82d7b3a47de6db3b608d0f4585631b487b7662b5efb56b896bd8c6e23991', 'hex');
  // Construct Stellar G-address from raw ed25519 public key bytes
  const recipientAddress = stellarSdk.StrKey.encodeEd25519PublicKey(rawRecipientBytes);
  console.log('Recipient Stellar Address from Reference Proof:', recipientAddress);

  // 2. Disburse batch on-chain to add reference root to history
  console.log('\n[Step 1] Submitting disburse_batch on-chain to register root...');
  const payrollContract = new stellarSdk.Contract(PAYROLL_ID);
  const disburseArgs = [
    new stellarSdk.Address(hrAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(rootHex, 'hex')),
  ];

  const hrAccount = await server.getAccount(hrAddress);
  let disburseTx = new stellarSdk.TransactionBuilder(hrAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(payrollContract.call('disburse_batch', ...disburseArgs))
    .setTimeout(300)
    .build();

  disburseTx = await server.prepareTransaction(disburseTx);
  disburseTx.sign(hrKeypair);

  const disburseResult = await server.sendTransaction(disburseTx);
  if (disburseResult.status === 'ERROR') {
    throw new Error(`Disbursement failed: ${disburseResult.errorResult?.toXDR().toString('hex')}`);
  }
  console.log('  Disbursement Tx Hash:', disburseResult.hash);
  await waitForTx(server, disburseResult.hash);
  console.log('  ✅ Disbursement confirmed on-chain!');

  // 3. Fund recipient address via friendbot so recipient account exists to invoke transaction
  console.log('\n[Step 2] Funding recipient account on testnet...');
  const fundRes = await fetch(`https://friendbot.stellar.org/?addr=${recipientAddress}`);
  if (!fundRes.ok) {
    console.log('Friendbot warning:', await fundRes.text());
  } else {
    console.log('  ✅ Recipient funded via Friendbot!');
  }

  // 4. Submit claim transaction on-chain
  console.log('\n[Step 3] Submitting claim transaction on-chain...');
  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(rootHex, 'hex')),
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(nullifierHex, 'hex')),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(proof),
  ];

  // We can sign with HR account as transaction submitter/fee payer on behalf of recipient
  const claimTxBuilderAccount = await server.getAccount(hrAddress);
  let claimTx = new stellarSdk.TransactionBuilder(claimTxBuilderAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(payrollContract.call('claim', ...claimArgs))
    .setTimeout(300)
    .build();

  console.log('  Preparing claim transaction...');
  claimTx = await server.prepareTransaction(claimTx);
  claimTx.sign(hrKeypair);

  console.log('  Submitting claim transaction...');
  const claimResult = await server.sendTransaction(claimTx);
  if (claimResult.status === 'ERROR') {
    throw new Error(`Claim failed: ${claimResult.errorResult?.toXDR().toString('hex')}`);
  }
  console.log('  Claim Tx Hash:', claimResult.hash);
  await waitForTx(server, claimResult.hash);

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║    🎉 ON-CHAIN ZK PAYROLL CLAIM VERIFIED SUCCESSFULLY! 🎉  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n  Amount Claimed : ${amount} tokens`);
  console.log(`  Recipient      : ${recipientAddress}`);
  console.log(`  Nullifier      : 0x${nullifierHex}`);
  console.log(`  Disburse Tx    : https://stellar.expert/explorer/testnet/tx/${disburseResult.hash}`);
  console.log(`  Claim Tx       : https://stellar.expert/explorer/testnet/tx/${claimResult.hash}`);
}

main().catch(err => {
  console.error('\n❌ ERROR:', err.message ?? err);
  process.exit(1);
});
