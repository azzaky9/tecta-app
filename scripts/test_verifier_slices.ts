import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import circuitJson from '/home/azxky9/hackathon/tecta-wasm/circuits/target/circuits.json';
import { generateCommitments, getSiblingPath, generateNullifier, getRecipientFieldElement, RPC_URL, NETWORK_PASSPHRASE } from '../lib/payroll-sdk';
import * as stellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

async function main() {
  // 1. Generate the valid proof and inputs for Alice
  const employees = [
    { name: "Alice", amount: 50, publicKey: "111222", salt: "333444" },
    { name: "Bob", amount: 75, publicKey: "555666", salt: "777888" },
  ];

  const commitments = generateCommitments(employees);
  const recipientAddress = "GABBRMQNWDYLAM275BKHVGBNGO7CYIXS75AVD4TEZWJCD5EXS4DJAMJT";
  const recipientHex = await getRecipientFieldElement(recipientAddress);

  const alice = employees[0];
  const siblingPath = getSiblingPath(commitments, 0);
  const nullifier = generateNullifier(alice.publicKey, alice.salt);
  const root = "0x2537c7f5ff988a2304d105180be21fb1fba0e160e63d88af930d565511ab4058";

  const inputs = {
    root,
    nullifier,
    recipient: recipientHex,
    amount: `0x${BigInt(alice.amount).toString(16)}`,
    secret_key: `0x${BigInt(alice.publicKey).toString(16)}`,
    salt: `0x${BigInt(alice.salt).toString(16)}`,
    index: `0x0`,
    hash_path: siblingPath,
  };

  const noir = new Noir(circuitJson as any);
  const { witness } = await noir.execute(inputs);

  const { Barretenberg } = await import("@aztec/bb.js");
  const barretenbergAPI = await Barretenberg.new({ threads: 1 });
  await barretenbergAPI.initSRSChonk();
  const backend = new UltraHonkBackend(circuitJson.bytecode, barretenbergAPI);
  const proofs = await backend.generateProof(witness);

  console.log("Generated proof length:", proofs.proof.length); // 14656

  // 2. Build the public inputs flat bytes
  // [root (32B) | nullifier (32B) | recipient (32B) | amount (32B)]
  const cleanRoot = root.startsWith("0x") ? root.slice(2) : root;
  const cleanNullifier = nullifier.startsWith("0x") ? nullifier.slice(2) : nullifier;
  const cleanRecipient = recipientHex.startsWith("0x") ? recipientHex.slice(2) : recipientHex;
  const cleanAmount = BigInt(alice.amount).toString(16).padStart(64, '0');

  const pubInputBytes = Buffer.concat([
    Buffer.from(cleanRoot, "hex"),
    Buffer.from(cleanNullifier, "hex"),
    Buffer.from(cleanRecipient, "hex"),
    Buffer.from(cleanAmount, "hex"),
  ]);
  console.log("Public inputs flat bytes length:", pubInputBytes.length); // 128

  // 3. Test different proof slices
  const verifierId = "CABPT2QO54HVAH5VWTLT3QZ3VXWNK2ZY6J2VZUK42SZHWXSWZO2ODPTK";
  const server = new stellarSdk.rpc.Server(RPC_URL);
  const contract = new stellarSdk.Contract(verifierId);

  const dummyPublicKey = stellarSdk.Keypair.random().publicKey();
  const dummyAccount = new stellarSdk.Account(dummyPublicKey, "0");

  const rawProof = proofs.proof.slice(128); // 14528 bytes

  // Create count prefix: 32 bytes representing 4
  const countPrefix32 = Buffer.alloc(32);
  countPrefix32.writeUInt32BE(4, 28);

  // Create count prefix: 4 bytes representing 4
  const countPrefix4 = Buffer.alloc(4);
  countPrefix4.writeUInt32BE(4, 0);

  const candidates = [
    {
      name: "Option A: Raw generated proof directly (14656 bytes)",
      data: Buffer.from(proofs.proof)
    },
    {
      name: "Option B: Raw proof sliced (14528 bytes)",
      data: Buffer.from(rawProof)
    },
    {
      name: "Option C: Raw proof prepended with 32-byte public input count prefix (14560 bytes)",
      data: Buffer.concat([countPrefix32, Buffer.from(rawProof)])
    },
    {
      name: "Option D: Raw proof prepended with 4-byte public input count prefix (14532 bytes)",
      data: Buffer.concat([countPrefix4, Buffer.from(rawProof)])
    },
    {
      name: "Option E: Reference proof style (countPrefix32 + publicInputs + rawProof) (14688 bytes)",
      data: Buffer.concat([countPrefix32, pubInputBytes, Buffer.from(rawProof)])
    },
    {
      name: "Option F: Alternative reference proof style (countPrefix4 + publicInputs + rawProof) (14660 bytes)",
      data: Buffer.concat([countPrefix4, pubInputBytes, Buffer.from(rawProof)])
    }
  ];

  for (const cand of candidates) {
    console.log(`\nTesting ${cand.name}... length: ${cand.data.length}`);
    const verifyArgs = [
      stellarSdk.xdr.ScVal.scvBytes(cand.data),
      stellarSdk.xdr.ScVal.scvBytes(pubInputBytes),
      stellarSdk.xdr.ScVal.scvBytes(Buffer.from(cleanNullifier, "hex")),
    ];

    const tx = new stellarSdk.TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("verify", ...verifyArgs))
      .setTimeout(30)
      .build();

    try {
      const simResult = await server.simulateTransaction(tx);
      if (stellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        const val = simResult.result?.retval?.bool();
        console.log(`  => SUCCESS! Return value: ${val}`);
      } else {
        console.log(`  => FAILED! Simulation error:`, simResult.error);
        if (simResult.events && simResult.events.length > 0) {
          console.log(`     Events:`, simResult.events.map(e => e.event().toXDR().toString('hex')));
        }
      }
    } catch (err: any) {
      console.log(`  => ERROR:`, err.message);
    }
  }
}

main().catch(console.error);
