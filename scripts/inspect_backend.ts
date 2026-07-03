import { UltraHonkBackend } from '@aztec/bb.js';
import circuitJson from '/home/azxky9/hackathon/tecta-wasm/circuits/target/circuits.json';
import * as fs from 'fs';

async function main() {
  const { Barretenberg } = await import("@aztec/bb.js");
  const barretenbergAPI = await Barretenberg.new({ threads: 1 });
  await barretenbergAPI.initSRSChonk();
  const backend = new UltraHonkBackend(circuitJson.bytecode as any, barretenbergAPI);

  console.log("Getting verification key...");
  const vk = await backend.getVerificationKey();
  console.log("VK retrieved, length:", vk.length);

  const existingVkPath = '/home/azxky9/hackathon/tecta-wasm/target/vk/vk';
  const existingVk = fs.readFileSync(existingVkPath);
  console.log("Existing VK length:", existingVk.length);

  const match = vk.equals(existingVk);
  console.log(`Do the VKs match? ${match ? "YES! 🎉" : "NO! ❌"}`);

  if (!match) {
    console.log("Existing VK (first 32 bytes):", existingVk.slice(0, 32).toString('hex'));
    console.log("Generated VK (first 32 bytes):", vk.slice(0, 32).toString('hex'));
  }
}

main().catch(console.error);
