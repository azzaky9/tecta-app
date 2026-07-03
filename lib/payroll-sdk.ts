/**
 * Tecta Payroll SDK — Browser-compatible wrapper for ZK payroll disbursement.
 *
 * Bridges the Noir circuits and Stellar Soroban contracts for:
 * 1. Generating commitments (HR side)
 * 2. Executing disburse_batch on-chain via Stellar Wallets Kit
 *
 * Based on tecta-wasm/scripts/payroll-sdk.js — adapted for Next.js client usage.
 */

import { ProofData } from "@aztec/bb.js";
import { Buffer } from "buffer";
import {
  poseidon1,
  poseidon2,
  poseidon3,
  poseidon4,
  poseidon5,
  poseidon6,
  poseidon7,
  poseidon8,
} from "poseidon-lite";

export const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const PAYROLL_CONTRACT_ID =
  process.env.NEXT_PUBLIC_STELLAR_PAYROLL_ID ??
  "CAFRROTQNRVUQO6XBH4QFH57QAALGQXK336GV2BZR6HEITNLKWJSHLX3";

export const VERIFIER_CONTRACT_ID =
  process.env.NEXT_PUBLIC_STELLAR_VERIFIER_ID ??
  "CABPT2QO54HVAH5VWTLT3QZ3VXWNK2ZY6J2VZUK42SZHWXSWZO2ODPTK";

export const RPC_URL = "https://soroban-testnet.stellar.org:443";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// ==========================================
// 0. POSEIDON ROUTER HELPER
// ==========================================

function poseidon(inputs: (bigint | number | string)[]): bigint {
  const len = inputs.length;
  switch (len) {
    case 1:
      return poseidon1(inputs);
    case 2:
      return poseidon2(inputs);
    case 3:
      return poseidon3(inputs);
    case 4:
      return poseidon4(inputs);
    case 5:
      return poseidon5(inputs);
    case 6:
      return poseidon6(inputs);
    case 7:
      return poseidon7(inputs);
    case 8:
      return poseidon8(inputs);
    default:
      throw new Error(`Unsupported Poseidon input length: ${len}`);
  }
}

// ==========================================
// 0.5 TOKEN DECIMALS & AMOUNT SCALING
// ==========================================

/**
 * Converts a human-readable amount (e.g. "1.5" XLM/USDC) into raw on-chain
 * units (stroops for 7-decimal tokens). All contract calls and ZK commitments
 * use raw units; the UI only ever deals in human-readable values.
 */
export function toRawAmount(human: string | number, decimals: number): bigint {
  const s = String(human).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid amount: "${human}". Use a positive number like 12 or 3.5`);
  }
  const [int, frac = ""] = s.split(".");
  if (frac.length > decimals) {
    throw new Error(`Amount "${human}" has more than ${decimals} decimal places`);
  }
  return BigInt(int + frac.padEnd(decimals, "0"));
}

/** Formats a raw on-chain amount back to a human-readable string. */
export function fromRawAmount(raw: bigint, decimals: number): string {
  const s = raw.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

let cachedDecimals: number | null = null;

/**
 * Reads the payroll token address from the contract's instance storage and
 * returns that token's `decimals()`. Works for any Soroban token (XLM SAC,
 * USDC, custom), so swapping the treasury token needs no frontend change.
 */
export async function getTokenDecimals(): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals;
  try {
    const sdk = await import("@stellar/stellar-sdk");
    const token = await getPayrollTokenAddress();
    const retval = await simulateTokenCall(token, "decimals");
    cachedDecimals = Number(sdk.scValToNative(retval));
    return cachedDecimals;
  } catch (e) {
    console.warn("getTokenDecimals failed, defaulting to 7 (Stellar standard):", e);
    cachedDecimals = 7;
    return 7;
  }
}

let cachedSymbol: string | null = null;

/** Reads the treasury token's symbol() (e.g. "native" for XLM, "USDC" for a SAC-wrapped issuer). */
export async function getPayrollTokenSymbol(): Promise<string | null> {
  if (cachedSymbol !== null) return cachedSymbol;
  try {
    const sdk = await import("@stellar/stellar-sdk");
    const token = await getPayrollTokenAddress();
    const retval = await simulateTokenCall(token, "symbol");
    cachedSymbol = String(sdk.scValToNative(retval));
    return cachedSymbol;
  } catch (e) {
    console.warn("getPayrollTokenSymbol failed:", e);
    return null;
  }
}

let cachedTokenAddress: string | null = null;

/** Reads the treasury token contract address from the payroll contract's storage. */
export async function getPayrollTokenAddress(): Promise<string> {
  if (cachedTokenAddress) return cachedTokenAddress;
  const sdk = await import("@stellar/stellar-sdk");
  const server = new sdk.rpc.Server(RPC_URL);
  const payroll = new sdk.Contract(PAYROLL_CONTRACT_ID);
  const entries = await server.getLedgerEntries(payroll.getFootprint());
  const storage = entries.entries[0].val.contractData().val().instance().storage();
  for (const item of storage ?? []) {
    try {
      if (sdk.scValToNative(item.key()) === "token") {
        const addr: string = sdk.scValToNative(item.val()).toString();
        cachedTokenAddress = addr;
        return addr;
      }
    } catch { /* non-native key, skip */ }
  }
  throw new Error("token address not found in payroll storage");
}

async function simulateTokenCall(token: string, method: string, ...args: any[]) {
  const sdk = await import("@stellar/stellar-sdk");
  const server = new sdk.rpc.Server(RPC_URL);
  const dummy = new sdk.Account(sdk.Keypair.random().publicKey(), "0");
  const tx = new sdk.TransactionBuilder(dummy, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new sdk.Contract(token).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (sdk.rpc.Api.isSimulationSuccess(sim) && sim.result) return sim.result.retval;
  throw new Error(`${method}() simulation failed`);
}

/** Returns an address's raw-unit balance of the payroll treasury token. */
export async function getTokenBalance(holder: string): Promise<bigint> {
  const sdk = await import("@stellar/stellar-sdk");
  const token = await getPayrollTokenAddress();
  const retval = await simulateTokenCall(token, "balance", new sdk.Address(holder).toScVal());
  return BigInt(sdk.scValToNative(retval));
}

// ==========================================
// 1. COMMITMENT & NULLIFIER GENERATION
// ==========================================

/**
 * Derives the ZK public key from a secret key.
 */
export function deriveZkPublicKey(secretKey: string | bigint): bigint {
  return poseidon([BigInt(secretKey)]);
}

/**
 * Computes a leaf commitment for the Merkle tree.
 * Commitment = Hash(amount, Hash(secret_key), salt)
 */
export function generateCommitment(
  amount: number | bigint,
  secretKey: string | bigint,
  salt: string | bigint
): string {
  const zkPublicKey = deriveZkPublicKey(secretKey);
  const commitment = poseidon([BigInt(amount), zkPublicKey, BigInt(salt)]);
  return "0x" + commitment.toString(16).padStart(64, "0");
}

/**
 * Computes the unique nullifier to prevent double-spending.
 * Nullifier = Hash(secret_key, salt)
 */
export function generateNullifier(
  secretKey: string | bigint,
  salt: string | bigint
): string {
  const nullifier = poseidon([BigInt(secretKey), BigInt(salt)]);
  return "0x" + nullifier.toString(16).padStart(64, "0");
}

/**
 * Decodes a Stellar G-address to its 32-byte hex public key
 * and checks if it satisfies the BN254 field modulus constraint.
 */
export async function getRecipientFieldElement(gAddress: string): Promise<string> {
  let cleaned = gAddress.trim();

  if (cleaned.startsWith("0x")) {
    return cleaned;
  }

  if (cleaned.length === 112 && cleaned.slice(0, 56) === cleaned.slice(56)) {
    cleaned = cleaned.slice(0, 56);
  }
  const { Keypair } = await import("@stellar/stellar-sdk");
  const keypair = Keypair.fromPublicKey(cleaned);
  const rawBytes = keypair.rawPublicKey();

  const hex = "0x" + Array.from(rawBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const value = BigInt(hex);

  if (value >= FIELD_MODULUS) {
    throw new Error(
      `Recipient address exceeds BN254 modulus. Please use a compatible address (starts with GA).`
    );
  }
  return hex;
}

// ==========================================
// 2. BATCH COMMITMENT GENERATION & MERKLE TREE
// ==========================================

export type EmployeePayrollEntry = {
  name: string;
  amount: number;
  publicKey: string;
  salt: string;
};

/**
 * Generates commitments for a list of employees to perform a batch disburse.
 * `decimals` scales human-readable amounts to raw on-chain units before
 * hashing (pass 0 when amounts are already raw).
 */
export function generateCommitments(
  payrollList: EmployeePayrollEntry[],
  decimals: number = 0
): string[] {
  return payrollList.map((item) => {
    return generateCommitment(toRawAmount(item.amount, decimals), item.publicKey, item.salt);
  });
}

/**
 * Computes the 8-level binary Merkle Tree root from a list of commitments.
 */
export function computeMerkleRoot(commitments: string[]): string {
  let currentLayer = [...commitments];
  while (currentLayer.length < 256) {
    currentLayer.push("0x0000000000000000000000000000000000000000000000000000000000000000");
  }

  for (let level = 0; level < 8; level++) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = BigInt(currentLayer[i]);
      const right = BigInt(currentLayer[i + 1]);
      const h = poseidon([left, right]);
      nextLayer.push("0x" + h.toString(16).padStart(64, "0"));
    }
    currentLayer = nextLayer;
  }
  return currentLayer[0];
}

/**
 * Computes the sibling path for a given index in the 8-level binary Merkle Tree.
 */
export function getSiblingPath(commitments: string[], index: number): string[] {
  let currentLayer = [...commitments];
  while (currentLayer.length < 256) {
    currentLayer.push("0x0000000000000000000000000000000000000000000000000000000000000000");
  }

  const siblingPath: string[] = [];
  let currentIndex = index;

  for (let level = 0; level < 8; level++) {
    const isRightChild = currentIndex % 2 !== 0;
    const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;
    siblingPath.push(currentLayer[siblingIndex]);

    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = BigInt(currentLayer[i]);
      const right = BigInt(currentLayer[i + 1]);
      const h = poseidon([left, right]);
      nextLayer.push("0x" + h.toString(16).padStart(64, "0"));
    }
    currentLayer = nextLayer;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return siblingPath;
}

// ==========================================
// 3. DISBURSE VIA STELLAR WALLETS KIT
// ==========================================

export type DisburseResult = {
  success: boolean;
  txHash?: string;
  error?: string;
  commitments: string[];
  totalAmount: number;
};

/**
 * Executes the disburse_batch call on the Soroban shielded payroll contract.
 * Uses the Stellar Wallets Kit for signing.
 */
export async function executeDisburseBatch(
  employees: EmployeePayrollEntry[],
  hrAddress: string
): Promise<DisburseResult> {
  // Human-readable amounts in, raw token units on-chain.
  const decimals = await getTokenDecimals();
  const commitments = generateCommitments(employees, decimals);
  const totalAmount = employees.reduce((sum, e) => sum + e.amount, 0); // human, for display
  const rawTotal = employees.reduce((sum, e) => sum + toRawAmount(e.amount, decimals), 0n);

  try {
    // Pre-check HR balance so users get a clear error instead of the token
    // contract's cryptic Error(Contract, #10) (insufficient balance).
    try {
      const balance = await getTokenBalance(hrAddress);
      if (balance < rawTotal) {
        throw new Error(
          `Insufficient treasury balance: batch needs ${fromRawAmount(rawTotal, decimals)} ` +
          `but HR wallet ${hrAddress.slice(0, 6)}… only holds ${fromRawAmount(balance, decimals)} ` +
          `(token has ${decimals} decimals). Lower the salaries or fund the wallet.`
        );
      }
    } catch (e: any) {
      if (e.message?.startsWith("Insufficient treasury balance")) throw e;
      console.warn("Balance pre-check skipped:", e); // don't block disburse on a failed read
    }
    // Dynamic import of Stellar SDK and Wallets Kit (only in browser)
    const { StellarWalletsKit } = await import(
      "@creit.tech/stellar-wallets-kit/sdk"
    );

    const stellarSdk = await import("@stellar/stellar-sdk");
    const { Contract, Address, xdr, TransactionBuilder, Account, rpc } = stellarSdk;

    const newRoot = computeMerkleRoot(commitments);
    const cleanRoot = newRoot.startsWith("0x") ? newRoot.slice(2) : newRoot;

    const contract = new Contract(PAYROLL_CONTRACT_ID);
    const disburseArgs = [
      new Address(hrAddress).toScVal(),
      xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(String(rawTotal & 0xFFFFFFFFFFFFFFFFn)),
          hi: xdr.Int64.fromString(String(rawTotal >> 64n)),
        })
      ),
      xdr.ScVal.scvBytes(Buffer.from(cleanRoot, "hex")),
    ];

    const server = new rpc.Server(RPC_URL);

    // Fetch the account sequence using getAccount
    let account;
    try {
      account = await server.getAccount(hrAddress);
    } catch (e) {
      console.error("Failed to load HR account details:", e);
      throw new Error(
        `HR Account ${hrAddress} is not funded or does not exist on Testnet. Please fund it first with some Testnet XLM.`
      );
    }

    // Build the transaction
    let tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("disburse_batch", ...disburseArgs))
      .setTimeout(30)
      .build();

    // Simulate & prepare transaction footprints and fees
    console.log("Simulating transaction on Soroban...");
    tx = await server.prepareTransaction(tx);

    // Sign via Stellar Wallets Kit
    console.log("Requesting signature from connected wallet...");
    const signResult = await StellarWalletsKit.signTransaction(tx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    // Some wallet modules return a string directly, others return an object with signedTxXdr
    const signedTxXdr = typeof signResult === "string" ? signResult : signResult.signedTxXdr;

    // Reconstruct transaction object from signed XDR and send
    console.log("Submitting transaction to Soroban RPC...");
    const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const submitResult = await server.sendTransaction(signedTx);

    if (submitResult.status === "ERROR") {
      throw new Error(
        submitResult.errorResult?.toXDR().toString("hex") || "Transaction was rejected by the network."
      );
    }

    return {
      success: true,
      txHash: submitResult.hash,
      commitments,
      totalAmount,
    };
  } catch (error: any) {
    console.error("Disburse batch failed:", error);
    return {
      success: false,
      error: error.message || "Transaction failed",
      commitments,
      totalAmount,
    };
  }
}

// ==========================================
// 4. EMPLOYEE CLAIM (BROWSER PROVING & WALLET)
// ==========================================

export type ClaimResult = {
  success: boolean;
  txHash?: string;
  error?: string;
};

/**
 * Generates the ZK Proof locally in the browser using Noir JS and Barretenberg.
 */
export async function generateClaimProofLocal(
  secrets: {
    amount: number | bigint;
    privateKey: string | bigint;
    salt: string | bigint;
    treeIndex: number | bigint;
    siblingPath: string[];
  },
  publicInputs: {
    root: string;
    nullifier: string;
    recipientAddress: string;
  }
): Promise<ProofData> {
  const recipientHex = await getRecipientFieldElement(publicInputs.recipientAddress);
  const rootHex = publicInputs.root.startsWith("0x") ? publicInputs.root : `0x${publicInputs.root}`;
  const nullifierHex = publicInputs.nullifier.startsWith("0x") ? publicInputs.nullifier : `0x${publicInputs.nullifier}`;

  const formattedSiblingPath = secrets.siblingPath.map((h) =>
    h.startsWith("0x") ? h : `0x${h}`
  );

  const payload = {
    root: rootHex,
    nullifier: nullifierHex,
    recipient: recipientHex,
    amount: BigInt(secrets.amount).toString(),
    secret_key: BigInt(secrets.privateKey).toString(),
    salt: BigInt(secrets.salt).toString(),
    index: BigInt(secrets.treeIndex).toString(),
    hash_path: formattedSiblingPath,
  };

  console.log("Requesting ZK Proof from API...", payload);
  const response = await fetch("/api/generate-proof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate ZK proof on server.");
  }

  const rawHex = data.proofHex.startsWith("0x") ? data.proofHex.slice(2) : data.proofHex;
  const proofBytes = new Uint8Array(
    rawHex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
  );

  const publicInputsList = [rootHex, nullifierHex, recipientHex, `0x${BigInt(secrets.amount).toString(16)}`];

  console.log("Proof received! Length:", proofBytes.length, "bytes");
  return { proof: proofBytes, publicInputs: publicInputsList };
}

/**
 * Submits the claim to the shielded payroll contract on-chain.
 */
export async function claimSalary(
  root: string,
  nullifier: string,
  recipientAddress: string,
  amount: number | bigint,
  proofBytes: Uint8Array
): Promise<ClaimResult> {
  try {
    console.log("=== claimSalary inputs (raw) ===");
    console.log("root:", root);
    console.log("nullifier:", nullifier);
    console.log("recipientAddress:", recipientAddress);
    console.log("amount:", amount.toString());
    console.log("proofBytes length:", proofBytes.length);

    let finalRecipient = recipientAddress.trim();
    if (finalRecipient.length === 112 && finalRecipient.slice(0, 56) === finalRecipient.slice(56)) {
      finalRecipient = finalRecipient.slice(0, 56);
    }
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
    const stellarSdk = await import("@stellar/stellar-sdk");
    const { Contract, Address, xdr, TransactionBuilder, rpc } = stellarSdk;

    const contract = new Contract(PAYROLL_CONTRACT_ID);

    const cleanRoot = root.startsWith("0x") ? root.slice(2) : root;
    const cleanNullifier = nullifier.startsWith("0x") ? nullifier.slice(2) : nullifier;

    // Convert parameters to ScVals
    const claimArgs = [
      xdr.ScVal.scvBytes(Buffer.from(cleanRoot, "hex")),
      xdr.ScVal.scvBytes(Buffer.from(cleanNullifier, "hex")),
      new Address(finalRecipient).toScVal(),
      xdr.ScVal.scvI128(
        new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(String(BigInt(amount) & 0xFFFFFFFFFFFFFFFFn)),
          hi: xdr.Int64.fromString(String(BigInt(amount) >> 64n)),
        })
      ),
      xdr.ScVal.scvBytes(Buffer.from(proofBytes)),
    ];

    const server = new rpc.Server(RPC_URL);

    // Fetch sequence
    let account;
    try {
      account = await server.getAccount(finalRecipient);
    } catch (e) {
      console.error("Failed to load recipient account details:", e);
      throw new Error(
        `Recipient Account ${recipientAddress} is not funded or does not exist on Testnet. Please fund it first with some Testnet XLM (min balance 1 XLM) so it exists on-chain.`
      );
    }

    console.log("Final claimSalary inputs (processed):");
    claimArgs.forEach((arg, i) => {
      console.log(`  [${i}]:`, arg);
    });

    // Build the transaction
    let tx = new TransactionBuilder(account, {
      fee: stellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("claim", ...claimArgs))
      .setTimeout(30)
      .build();

    // Simulate & prepare transaction footprints and fees
    console.log("Simulating claim transaction on Soroban...");
    tx = await server.prepareTransaction(tx);

    // Sign via Stellar Wallets Kit
    console.log("Requesting signature from connected wallet...");
    const signResult = await StellarWalletsKit.signTransaction(tx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    const signedTxXdr = typeof signResult === "string" ? signResult : signResult.signedTxXdr;

    // Submit transaction
    console.log("Submitting claim transaction to Soroban RPC...");
    const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const submitResult = await server.sendTransaction(signedTx);

    if (submitResult.status === "ERROR") {
      throw new Error(
        submitResult.errorResult?.toXDR().toString("hex") || "Transaction was rejected by the network."
      );
    }

    return {
      success: true,
      txHash: submitResult.hash,
    };
  } catch (error: any) {
    console.error("Claim salary failed:", error);
    return {
      success: false,
      error: error.message || "Transaction failed",
    };
  }
}

/**
 * Submits a claim for a recipient with no XLM of their own. The contract's
 * claim() never calls recipient.require_auth() — only the ZK proof and
 * nullifier gate the payout — so a server-side sponsor wallet can be the
 * transaction source/fee-payer instead of the recipient. Use this when the
 * recipient's account can't be loaded (fresh/unfunded wallet); otherwise
 * prefer `claimSalary`, which is unchanged.
 */
export async function claimSalarySponsored(
  root: string,
  nullifier: string,
  recipientAddress: string,
  amount: number | bigint,
  proofBytes: Uint8Array
): Promise<ClaimResult> {
  try {
    let finalRecipient = recipientAddress.trim();
    if (finalRecipient.length === 112 && finalRecipient.slice(0, 56) === finalRecipient.slice(56)) {
      finalRecipient = finalRecipient.slice(0, 56);
    }
    const proofHex = "0x" + Buffer.from(proofBytes).toString("hex");

    const response = await fetch("/api/claim-sponsored", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        root,
        nullifier,
        recipientAddress: finalRecipient,
        amount: BigInt(amount).toString(),
        proofHex,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Sponsored claim failed.");
    }

    return { success: true, txHash: data.txHash };
  } catch (error: any) {
    console.error("Sponsored claim salary failed:", error);
    return {
      success: false,
      error: error.message || "Transaction failed",
    };
  }
}

/**
 * Fetches the full on-chain Merkle root history via get_roots(). Index 0 is
 * always the genesis empty-tree root set at initialize(); each subsequent
 * entry is one disburse_batch call, so `roots.length - 1` is the real batch count.
 */
export async function fetchRootHistory(): Promise<string[]> {
  const stellarSdk = await import("@stellar/stellar-sdk");
  const { Contract, TransactionBuilder, Account, rpc, Keypair } = stellarSdk;
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(PAYROLL_CONTRACT_ID);

  const dummyAccount = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_roots"))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(simResult)) {
    const vec = simResult.result?.retval?.vec();
    if (vec) {
      return vec.map((v) => "0x" + Buffer.from(v.bytes()).toString("hex"));
    }
  }
  throw new Error("Failed to fetch Merkle root history from contract simulation.");
}

/**
 * Fetches the latest Merkle root from the contract by simulating a get_roots call.
 */
export async function fetchLatestMerkleRoot(): Promise<string> {
  const stellarSdk = await import("@stellar/stellar-sdk");
  const { Contract, TransactionBuilder, Account, rpc, Keypair } = stellarSdk;
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(PAYROLL_CONTRACT_ID);

  // Use a dummy account for read-only simulation
  const dummyPublicKey = Keypair.random().publicKey();
  const dummyAccount = new Account(dummyPublicKey, "0");
  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_roots"))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(simResult)) {
    const vec = simResult.result?.retval?.vec();
    if (vec && vec.length > 0) {
      const lastRootBytes = vec[vec.length - 1].bytes();
      return "0x" + Buffer.from(lastRootBytes).toString("hex");
    }
  }
  throw new Error("Failed to fetch Merkle roots from contract simulation.");
}
