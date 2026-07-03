import * as fs from 'fs';
import { RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

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

  const PAYROLL_ID = 'CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3';
  const HR_SECRET = '***REMOVED-LEAKED-SECRET***';
  const hrKeypair = stellarSdk.Keypair.fromSecret(HR_SECRET);

  const proof = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/proof');
  const pub = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/public_inputs');

  const root = pub.slice(0, 32);
  const nullifier = pub.slice(32, 64);
  const recipientBytes = pub.slice(64, 96);
  const amountBytes = pub.slice(96, 128);

  const recipientAddress = stellarSdk.StrKey.encodeEd25519PublicKey(recipientBytes);
  const amount = Number(BigInt('0x' + amountBytes.toString('hex')));

  console.log('--- EXECUTING CLAIM WITH ORIGINAL NULLIFIER ---');
  console.log('Recipient Address:', recipientAddress);
  console.log('Nullifier (hex):  ', '0x' + nullifier.toString('hex'));

  const payrollContract = new stellarSdk.Contract(PAYROLL_ID);

  // 1. Submit disburse_batch
  const disburseArgs = [
    new stellarSdk.Address(hrKeypair.publicKey()).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(root),
  ];

  const hrAccount = await server.getAccount(hrKeypair.publicKey());
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
  console.log('Disbursement Tx Hash:', disburseResult.hash);
  await waitForTx(server, disburseResult.hash);
  console.log('Disbursement Confirmed!');

  // 2. Submit claim with the EXACT original nullifier from the ZK proof!
  const claimArgs = [
    stellarSdk.xdr.ScVal.scvBytes(root),
    stellarSdk.xdr.ScVal.scvBytes(nullifier),
    new stellarSdk.Address(recipientAddress).toScVal(),
    stellarSdk.xdr.ScVal.scvI128(
      new stellarSdk.xdr.Int128Parts({
        lo: stellarSdk.xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
        hi: stellarSdk.xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
      })
    ),
    stellarSdk.xdr.ScVal.scvBytes(proof),
  ];

  const claimAccount = await server.getAccount(hrKeypair.publicKey());
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
  console.log('Claim Tx Submitted! Hash:', claimResult.hash);
  await waitForTx(server, claimResult.hash);

  console.log('\n===========================================================');
  console.log('SUCCESS! CLAIM TRANSACTION CONFIRMED ON-CHAIN!');
  console.log('Claim Tx Hash:', claimResult.hash);
  console.log('Explorer: https://stellar.expert/explorer/testnet/tx/' + claimResult.hash);
  console.log('===========================================================');
}

main().catch(err => console.error('Error:', err.message || err));
