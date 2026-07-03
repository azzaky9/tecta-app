import * as fs from 'fs';
import {
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
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function main() {
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);
  const hrAddress = hrKeypair.publicKey();

  // Load reference proof and public inputs
  const proof = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof');
  const rootHex = '06782f383c44c8686ae4b9b69eb345be31a21da3f042bfd9e7e3cbb656433dc8';
  const amount = 2000;

  // Generate a NEW random 32-byte nullifier so this test is 100% unique and fresh!
  const randomNullifier = stellarSdk.Keypair.random().rawPublicKey();
  const nullifierHex = randomNullifier.toString('hex');

  const rawRecipientBytes = Buffer.from('0f6a82d7b3a47de6db3b608d0f4585631b487b7662b5efb56b896bd8c6e23991', 'hex');
  const recipientAddress = stellarSdk.StrKey.encodeEd25519PublicKey(rawRecipientBytes);

  console.log('--- STARTING CLAIM TEST ---');
  console.log('Recipient Address:', recipientAddress);
  console.log('Nullifier (hex):  ', '0x' + nullifierHex);

  // 1. Submit disburse_batch on-chain
  console.log('1. Submitting disburse_batch...');
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
  console.log('   Disbursement Tx Hash:', disburseResult.hash);
  await waitForTx(server, disburseResult.hash);
  console.log('   Disbursement Confirmed!');

  // 2. Submit claim transaction
  console.log('2. Submitting claim transaction...');
  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(Buffer.from(rootHex, 'hex')),
    stellarSdk.xdr.ScVal.scvBytes(randomNullifier),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(proof),
  ];

  const claimAccount = await server.getAccount(hrAddress);
  let claimTx = new stellarSdk.TransactionBuilder(claimAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(payrollContract.call('claim', ...claimArgs))
    .setTimeout(300)
    .build();

  claimTx = await server.prepareTransaction(claimTx);
  claimTx.sign(hrKeypair);

  const claimResult = await server.sendTransaction(claimTx);
  if (claimResult.status === 'ERROR') {
    throw new Error(`Claim failed: ${claimResult.errorResult?.toXDR().toString('hex')}`);
  }
  console.log('   Claim Tx Hash:', claimResult.hash);
  await waitForTx(server, claimResult.hash);

  console.log('\n===========================================================');
  console.log('SUCCESS! CLAIM TRANSACTION CONFIRMED ON-CHAIN:');
  console.log(`Disburse Tx Hash : ${disburseResult.hash}`);
  console.log(`Claim Tx Hash    : ${claimResult.hash}`);
  console.log(`Stellar Explorer : https://stellar.expert/explorer/testnet/tx/${claimResult.hash}`);
  console.log('===========================================================');
}

main().catch(err => {
  console.error('\nERROR:', err.message ?? err);
  process.exit(1);
});
