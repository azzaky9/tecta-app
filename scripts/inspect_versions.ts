import * as fs from 'fs';

function main() {
  const path1 = '/home/azxky9/hackathon/tecta-wasm/circuits/target/circuits.json';
  const path2 = '/home/azxky9/hackathon/tecta/circuits/target/circuits.json';

  const d1 = JSON.parse(fs.readFileSync(path1, 'utf8'));
  const d2 = JSON.parse(fs.readFileSync(path2, 'utf8'));

  console.log("Tecta-wasm circuits.json noir_version:", d1.noir_version || "none");
  console.log("Tecta circuits.json noir_version:", d2.noir_version || "none");
}

main();
