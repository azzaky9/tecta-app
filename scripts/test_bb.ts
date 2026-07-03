import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import circuitJson from '../circuits/target/circuits.json';
import { generateNullifier } from '../lib/payroll-sdk';

async function main() {
  const privateKey = "654720141";
  const salt = "483898";
  const treeIndex = 0;
  const siblingPath = [
    "0x2047357f162ff5cbf24f602a7078bcfdf653bc442832081463f5653d0e8651d3",
    "0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864",
    "0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1",
    "0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238",
    "0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a",
    "0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55",
    "0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78",
    "0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d"
  ];
  const amount = 1000;
  const root = "0x251a175ba16c870139fb88ba179fda111d3dfbf397d95d6e951ec381294787f0";
  const recipientAddress = "0x18808b90f0641cbe186ff8ff528e571a23b47365b0c05128c7a17fdbc96cbdcb";

  const nullifier = generateNullifier(privateKey, salt);

  const inputs = {
    root,
    nullifier,
    recipient: recipientAddress,
    amount: `0x${BigInt(amount).toString(16)}`,
    secret_key: `0x${BigInt(privateKey).toString(16)}`,
    salt: `0x${BigInt(salt).toString(16)}`,
    index: `0x${BigInt(treeIndex).toString(16)}`,
    hash_path: siblingPath,
  };

  console.log("Inputs:", inputs);

  try {
    const noir = new Noir(circuitJson as any);
    const { witness } = await noir.execute(inputs);
    console.log("Witness generated successfully!");

    const { Barretenberg } = await import("@aztec/bb.js");
    const barretenbergAPI = await Barretenberg.new({ threads: 1 });
    await barretenbergAPI.initSRSChonk();
    const backend = new UltraHonkBackend(circuitJson.bytecode, barretenbergAPI);
    console.log("UltraHonkBackend initialized. Generating proof...");
    const proof = await backend.generateProof(witness);
    console.log("Proof generated successfully! Length:", proof.proof.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
