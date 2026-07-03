import { fetchLatestMerkleRoot, PAYROLL_CONTRACT_ID } from '../lib/payroll-sdk';

async function main() {
  console.log("Fetching latest Merkle Root on-chain for contract:", PAYROLL_CONTRACT_ID);
  try {
    const root = await fetchLatestMerkleRoot();
    console.log("Success! Latest root is:", root);
  } catch (err) {
    console.error("Failed to fetch root:", err);
  }
}

main();
