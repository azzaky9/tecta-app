import * as stellarSdk from '@stellar/stellar-sdk';
import { PAYROLL_CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';

async function main() {
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const contractId = PAYROLL_CONTRACT_ID;
  console.log("Querying admin of:", contractId);

  try {
    const key = stellarSdk.xdr.ScVal.scvSymbol('admin');
    const res = await server.getContractData(
      contractId,
      key,
      stellarSdk.rpc.Durability.Persistent
    );
    console.log("Admin data:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Persistent storage failed, trying instance...");
    try {
      // Try to simulate get_roots to see if contract responds
      const dummyPublicKey = stellarSdk.Keypair.random().publicKey();
      const dummyAccount = new stellarSdk.Account(dummyPublicKey, "0");
      const contract = new stellarSdk.Contract(contractId);
      const tx = new stellarSdk.TransactionBuilder(dummyAccount, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call("get_roots"))
        .setTimeout(30)
        .build();
      const simResult = await server.simulateTransaction(tx);
      if (stellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        const vec = simResult.result?.retval?.vec();
        console.log("Roots count:", vec?.length);
        if (vec && vec.length > 0) {
          vec.forEach((root, i) => {
            const bytes = Buffer.from(root.bytes()).toString('hex');
            console.log(`Root ${i}: 0x${bytes}`);
          });
        }
      } else {
        console.error("Simulation failed:", simResult.error);
      }
    } catch(e2) {
      console.error("get_roots failed too:", e2);
    }
  }
}

main().catch(console.error);
