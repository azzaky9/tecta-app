import { computeMerkleRoot, getSiblingPath } from '../lib/payroll-sdk';

const employees = [
  { name: "Gale", amount: 100, privateKey: "606770551", salt: "452896", commitment: "0x13a5fec6e73ab68b52962f1054169e182fdf3cddf10e5a6327e1b81b7fb3a63c", index: 0 },
  { name: "Donte", amount: 100, privateKey: "538902417", salt: "489695", commitment: "0x17be1e5de8d34e7517da138fac2416a0b142fd359c1bd4b3ef17bb7b9865ec4e", index: 1 },
  { name: "Bale", amount: 100, privateKey: "712616626", salt: "937507", commitment: "0x0800378fd838b6ede09b3211c2e07d950c7f58aa8ab427c0ee7a4dff8d67c073", index: 2 },
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
  console.log(`http://localhost:3000/claim?${params.toString()}`);
}
