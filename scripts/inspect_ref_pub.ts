import * as fs from 'fs';

function main() {
  const pub = fs.readFileSync('/home/azxky9/hackathon/tecta-wasm/proofs/proof.bin/public_inputs');
  console.log("Public inputs length (bytes):", pub.length);

  // Print 4 public inputs (32 bytes each) as hex
  for (let i = 0; i < 4; i++) {
    const chunk = pub.slice(i * 32, (i + 1) * 32);
    console.log(`Input ${i}: ${chunk.toString('hex')}`);
  }
}

main();
