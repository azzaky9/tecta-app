import { computeMerkleRoot, getSiblingPath } from '../lib/payroll-sdk';

const BASE_URL = 'https://d58b-114-10-40-213.ngrok-free.app';

const employees = [
  { name: "John", amount: 5000, privateKey: "553933982", salt: "768254", commitment: "0x19f8ff67a9a01f751dce8fd4c456b752cb1b38b0fc43fbcdc3a0711f5f3207bb", index: 0 },
  { name: "Donte", amount: 1000, privateKey: "231946928", salt: "355944", commitment: "0x1ca36477ffb26fa8a20b8fddfa590ad760d9584dee2c2b184567c0dd8829f9ae", index: 1 },
  { name: "Garry", amount: 2500, privateKey: "4036188", salt: "344524", commitment: "0x1c3825af49e2473f7f6413a3f268290ce1044ee3f27097a9ffcfe7d65b4cef8b", index: 2 },
];

const commitments = employees.map(e => e.commitment);
const root = computeMerkleRoot(commitments);
console.log("root:", root);

for (const e of employees) {
  const path = getSiblingPath(commitments, e.index);
  const params = new URLSearchParams({
    root, amount: String(e.amount), pk: e.privateKey, salt: e.salt,
    idx: String(e.index), path: path.join(','), name: e.name,
  });
  console.log(`\n${e.name}:`);
  console.log(`${BASE_URL}/claim?${params.toString()}`);
}
