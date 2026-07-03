import { PAYROLL_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';

async function main() {
  console.log("Querying info for contract:", PAYROLL_CONTRACT_ID);
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const contract = new stellarSdk.Contract(PAYROLL_CONTRACT_ID);

  const dummyPublicKey = stellarSdk.Keypair.random().publicKey();
  const dummyAccount = new stellarSdk.Account(dummyPublicKey, "0");

  // We cannot call administrative storage directly, but we can simulate call get_roots
  // Wait! Let's simulate a call that will trigger reading storage or let's look at the contract's instance storage keys if we can
  // Actually, we can read contract data directly using server.getContractData!
  // Let's get the ADMIN storage key: const ADMIN = symbol_short("admin");
  // Let's fetch all contract data to see what keys exist!
  // In Soroban, the instance storage is stored on the contract instance.
  // Let's write a simulation that calls a dummy method or let's read the contract's instance data
  const rootsTx = new stellarSdk.TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_roots"))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(rootsTx);
  console.log("Roots simulation result:", JSON.stringify(simResult, null, 2));
}

main().catch(console.error);
