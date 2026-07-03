"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/components/wallet-provider";
import {
  claimSalary,
  claimSalarySponsored,
  fetchLatestMerkleRoot,
  generateClaimProofLocal,
  generateCommitments,
  generateNullifier,
  getSiblingPath,
  getTokenDecimals,
  toRawAmount,
} from "@/lib/payroll-sdk";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

type ClaimStepStatus = "idle" | "proving" | "signing" | "submitting" | "success" | "error";

export default function ClaimPage() {
  const { walletAddress, connectWallet } = useWallet();

  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // Secrets Input State
  const [secrets, setSecrets] = useState({
    privateKey: "188127391",
    salt: "912223",
    amount: "5000",
    treeIndex: "0",
  });

  const [siblingPath, setSiblingPath] = useState<string[]>([]);
  const [root, setRoot] = useState("");
  const [nullifier, setNullifier] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);

  // Token decimals drive human→raw amount scaling (works for XLM, USDC, any Soroban token)
  useEffect(() => {
    getTokenDecimals()
      .then(setTokenDecimals)
      .catch(() => setTokenDecimals(7));
  }, []);

  const [status, setStatus] = useState<ClaimStepStatus>("idle");

  // Load employees list from localStorage on mount and auto-select the first one
  useEffect(() => {
    try {
      const stored = localStorage.getItem("demo_payroll_list");
      if (stored) {
        const list = JSON.parse(stored);
        setEmployeesList(list);
        if (list.length > 0) {
          const first = list[0];
          setSecrets({
            privateKey: String(first.publicKey),
            salt: String(first.salt),
            amount: String(first.amount),
            treeIndex: "0",
          });
        }
      } else {
        const fallback = [
          { name: "Zac", amount: 1000, publicKey: "172256170", salt: "198990" },
          { name: "Josh", amount: 450, publicKey: "749373417", salt: "399204" },
        ];
        setEmployeesList(fallback);
        setSecrets({
          privateKey: "172256170",
          salt: "198990",
          amount: "1000",
          treeIndex: "0",
        });
      }
    } catch (e) {
      console.warn("Failed to load demo payroll list from localStorage:", e);
    }
  }, []);

  // Selection helper
  const handleSelectEmployee = (indexStr: string) => {
    const index = parseInt(indexStr);
    if (!isNaN(index) && index >= 0 && index < employeesList.length) {
      const emp = employeesList[index];
      setSecrets({
        privateKey: String(emp.publicKey),
        salt: String(emp.salt),
        amount: String(emp.amount),
        treeIndex: indexStr,
      });
    } else {
      setSecrets((prev) => ({ ...prev, treeIndex: indexStr }));
    }
  };

  // Derive sibling path locally for demo purposes using the expected test data
  useEffect(() => {
    try {
      if (employeesList.length > 0 && tokenDecimals !== null) {
        const commitments = generateCommitments(employeesList, tokenDecimals);
        const index = parseInt(secrets.treeIndex);
        if (!isNaN(index) && index >= 0 && index < employeesList.length) {
          const path = getSiblingPath(commitments, index);
          setSiblingPath(path);
        }
      }
    } catch (e) {
      console.warn("Could not compute sibling path:", e);
    }
  }, [secrets.treeIndex, employeesList, tokenDecimals]);

  const [errorMessage, setErrorMessage] = useState("");
  const [txHash, setTxHash] = useState("");
  const [provingLogs, setProvingLogs] = useState<string[]>([]);
  const [generatedProof, setGeneratedProof] = useState<Uint8Array | null>(null);
  const [claimInputs, setClaimInputs] = useState<string[]>([]);

  const [copiedTx, setCopiedTx] = useState(false);
  const [isFetchingRoot, setIsFetchingRoot] = useState(false);

  // Derive nullifier locally when private inputs change
  useEffect(() => {
    try {
      if (secrets.privateKey && secrets.salt) {
        const derivedNull = generateNullifier(secrets.privateKey, secrets.salt);
        setNullifier(derivedNull);
      }
    } catch (e) {
      console.warn("Could not derive nullifier:", e);
    }
  }, [secrets.privateKey, secrets.salt]);

  // Load recipient wallet address when connected
  const [customRecipient, setCustomRecipient] = useState("");
  const rawRecipient = customRecipient || walletAddress || "";
  const recipientToUse = (() => {
    const trimmed = rawRecipient.trim();
    if (trimmed.length === 112 && trimmed.slice(0, 56) === trimmed.slice(56)) {
      return trimmed.slice(0, 56);
    }
    return trimmed;
  })();

  // Auto-fetch latest root from blockchain on page load
  useEffect(() => {
    handleFetchRoot();
  }, []);

  const handleFetchRoot = async () => {
    setIsFetchingRoot(true);
    try {
      const latestRoot = await fetchLatestMerkleRoot();
      setRoot(latestRoot);
    } catch (err: any) {
      console.warn("Could not auto-fetch Merkle root:", err);
    } finally {
      setIsFetchingRoot(false);
    }
  };

  const addLog = (msg: string) => {
    setProvingLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Step 1: Generate ZK Proof locally in the browser
  const handleGenerateProof = async () => {
    if (!secrets.privateKey || !secrets.salt || !secrets.amount || !secrets.treeIndex || !root) {
      setErrorMessage("Please fill in all private secrets and the Merkle root.");
      setStatus("error");
      return;
    }

    setStatus("proving");
    setErrorMessage("");
    setProvingLogs([]);
    setGeneratedProof(null);

    try {
      addLog("Initializing Noir JS circuit compiler...");
      await new Promise((r) => setTimeout(r, 600));

      addLog("Loading compiled payroll circuit JSON...");
      await new Promise((r) => setTimeout(r, 500));

      addLog("Starting witness generation inside browser...");
      addLog(`Inputs: Amount: ${secrets.amount}, Index: ${secrets.treeIndex}`);
      await new Promise((r) => setTimeout(r, 600));

      addLog("Running Barretenberg proving backend (Honk)...");

      const decimals = tokenDecimals ?? (await getTokenDecimals());
      const proofBytes = await generateClaimProofLocal(
        {
          amount: toRawAmount(secrets.amount, decimals),
          privateKey: secrets.privateKey.startsWith("0x") ? secrets.privateKey : BigInt(secrets.privateKey),
          salt: secrets.salt.startsWith("0x") ? secrets.salt : BigInt(secrets.salt),
          treeIndex: BigInt(secrets.treeIndex),
          siblingPath: siblingPath,
        },
        {
          root: root,
          nullifier: nullifier,
          recipientAddress: recipientToUse,
        }
      );

      addLog("Zero-Knowledge proof generated successfully!");
      addLog(`Proof size: ${proofBytes.proof.length} bytes`);
      setGeneratedProof(proofBytes.proof);
      setClaimInputs(proofBytes.publicInputs);
      setStatus("idle");
    } catch (err: any) {
      console.error("Generating claim proof Failed Error message shows below: ")
      console.error(err);
      addLog(`Proving failed: ${err.message || err}`);
      setErrorMessage(err.message || "Failed to generate ZK proof.");
      setStatus("error");
    }
  };

  // Step 2: Sign and submit the proof to the contract.
  // Claiming to a fresh wallet (0 XLM, never funded) can't build a tx with
  // that wallet as source — no on-chain sequence number exists yet. Since
  // the contract's claim() never checks recipient.require_auth(), we fall
  // back to a sponsor-paid claim in that case instead of blocking the user.
  const handleSubmitClaim = async () => {
    if (!generatedProof) return;

    if (!walletAddress) {
      setStatus("signing");
      const address = await connectWallet();
      if (!address) {
        setErrorMessage("Wallet connection required to submit transaction.");
        setStatus("error");
        return;
      }
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      console.log("Submitting claim with inputs:", claimInputs);
      const decimals = tokenDecimals ?? (await getTokenDecimals());
      const rawAmount = toRawAmount(secrets.amount, decimals);

      let claimResult = await claimSalary(root, nullifier, recipientToUse, rawAmount, generatedProof);

      if (!claimResult.success && claimResult.error?.includes("not funded or does not exist")) {
        addLog("Recipient wallet has no XLM yet — retrying as a sponsored claim...");
        claimResult = await claimSalarySponsored(root, nullifier, recipientToUse, rawAmount, generatedProof);
      }

      if (claimResult.success && claimResult.txHash) {
        setTxHash(claimResult.txHash);
        setStatus("success");
      } else {
        setErrorMessage(claimResult.error || "Claim transaction failed.");
        setStatus("error");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to submit transaction.");
      setStatus("error");
    }
  };

  const handleCopyTx = () => {
    navigator.clipboard.writeText(txHash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  const handleSiblingPathChange = (index: number, val: string) => {
    setSiblingPath((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const resetForm = () => {
    setStatus("idle");
    setGeneratedProof(null);
    setProvingLogs([]);
    setTxHash("");
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Claim Salary</h1>
        <p className="text-sm text-muted-foreground">
          Privately claim your salary using Zero-Knowledge proofs on Stellar Testnet
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Input parameters */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Claim Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Private Inputs */}
              <div className="bg-muted/30 p-4 rounded-xl border border-border/60 space-y-4">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Private Employee Secrets (Client-Side Only)
                </h4>
                {employeesList.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                      Select Disbursed Employee (Auto-Populates Secrets)
                    </label>
                    <select
                      className="w-full bg-background border border-border/80 rounded-lg p-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={secrets.treeIndex}
                      onChange={(e) => handleSelectEmployee(e.target.value)}
                      disabled={status === "proving" || status === "submitting"}
                    >
                      {employeesList.map((emp, i) => (
                        <option key={i} value={i}>
                          {emp.name} (Amount: ${emp.amount}, Seed: {emp.publicKey}, Salt: {emp.salt})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Private Key / Seed
                    </label>
                    <Input
                      placeholder="e.g. 188127391"
                      value={secrets.privateKey}
                      onChange={(e) =>
                        setSecrets((prev) => ({ ...prev, privateKey: e.target.value }))
                      }
                      disabled={status === "proving" || status === "submitting"}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Salt
                    </label>
                    <Input
                      placeholder="e.g. 912223"
                      value={secrets.salt}
                      onChange={(e) => setSecrets((prev) => ({ ...prev, salt: e.target.value }))}
                      disabled={status === "proving" || status === "submitting"}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Salary Amount ($)
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g. 2000"
                      value={secrets.amount}
                      onChange={(e) =>
                        setSecrets((prev) => ({ ...prev, amount: e.target.value }))
                      }
                      disabled={status === "proving" || status === "submitting"}
                    />
                  </div>
                </div>
              </div>

              {/* Public Parameters */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Public Parameters (On-Chain)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block flex justify-between items-center">
                      <span>Connected Wallet (Recipient)</span>
                      {!walletAddress && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs font-normal"
                          onClick={connectWallet}
                        >
                          <WalletIcon className="h-3 w-3 mr-1" />
                          Connect Wallet
                        </Button>
                      )}
                    </label>
                    <Input
                      placeholder="Connect wallet or enter address"
                      value={recipientToUse}
                      onChange={(e) => setCustomRecipient(e.target.value)}
                      disabled={status === "proving" || status === "submitting"}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Must starts with GA (satisfying the BN254 field modulus constraint).
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block flex justify-between items-center">
                      <span>On-Chain Merkle Root</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs font-normal"
                        onClick={handleFetchRoot}
                        disabled={isFetchingRoot}
                      >
                        <RefreshCwIcon className={`h-3 w-3 mr-1 ${isFetchingRoot && 'animate-spin'}`} />
                        Auto-fetch Latest
                      </Button>
                    </label>
                    <Input
                      placeholder="0x..."
                      value={root}
                      onChange={(e) => setRoot(e.target.value)}
                      disabled={status === "proving" || status === "submitting"}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Tree Index
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g. 1"
                      value={secrets.treeIndex}
                      onChange={(e) => handleSelectEmployee(e.target.value)}
                      disabled={status === "proving" || status === "submitting"}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Derived Nullifier (Public)
                    </label>
                    <Input
                      readOnly
                      value={nullifier}
                      placeholder="Automatically derived"
                      className="font-mono text-xs bg-muted/20"
                    />
                  </div>
                </div>
              </div>


            </CardContent>
          </Card>
        </div>

        {/* Right: Actions Panel */}
        <div className="flex flex-col gap-4">
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Proof Settlement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generation State */}
              {status === "proving" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
                    <Loader2Icon className="h-5 w-5 animate-spin" />
                    Generating ZK Proof...
                  </div>
                  <div className="text-[10px] text-blue-600 leading-relaxed">
                    This computes the proof locally inside the browser. It compiles the WASM solver, solves the witness constraints, and builds the Honk proof.
                  </div>
                </div>
              )}

              {/* Signing & Submitting State */}
              {(status === "signing" || status === "submitting") && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                    <Loader2Icon className="h-5 w-5 animate-spin" />
                    {status === "signing" ? "Awaiting Wallet Signature..." : "Submitting to Soroban..."}
                  </div>
                  <div className="text-[10px] text-amber-600">
                    Signing proof envelope and submitting verification call to payroll smart contract.
                  </div>
                </div>
              )}

              {/* Success State */}
              {status === "success" && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                    <CheckCircle2Icon className="h-5 w-5" />
                    Claim Successful!
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Salary claimed privately. Funds have been securely deposited into your wallet address.
                  </p>
                  {txHash && (
                    <div className="bg-emerald-100 rounded p-2 flex items-center justify-between gap-2 overflow-hidden border border-emerald-200">
                      <span className="font-mono text-[9px] text-emerald-800 truncate select-all">
                        {txHash}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-emerald-700 hover:text-emerald-900"
                        onClick={handleCopyTx}
                      >
                        {copiedTx ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={resetForm} className="w-full mt-2">
                    Claim Another
                  </Button>
                </div>
              )}

              {/* Error State */}
              {status === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                    <AlertCircleIcon className="h-5 w-5" />
                    Process Failed
                  </div>
                  <p className="text-[10px] text-red-600 break-words leading-relaxed">
                    {errorMessage}
                  </p>
                  <Button variant="outline" size="sm" onClick={resetForm} className="w-full mt-2">
                    Try Again
                  </Button>
                </div>
              )}

              {/* Step buttons */}
              {status === "idle" && (
                <div className="space-y-3">
                  {!generatedProof ? (
                    <Button
                      onClick={handleGenerateProof}
                      className="w-full h-11 text-xs font-semibold gap-2"
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                      1. Solve ZK Proof locally
                    </Button>
                  ) : (
                    <>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 text-center">
                        <span className="text-xs text-emerald-700 font-semibold flex items-center justify-center gap-1.5">
                          <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
                          ZK Proof Ready ({generatedProof.length} bytes)
                        </span>
                      </div>
                      <Button
                        onClick={handleSubmitClaim}
                        className="w-full h-11 text-xs font-semibold gap-2"
                      >
                        <WalletIcon className="h-4 w-4" />
                        2. Submit Claim to Soroban
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setGeneratedProof(null)}
                        className="w-full text-xs text-muted-foreground"
                      >
                        Re-generate Proof
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proving Logs Console */}
          {provingLogs.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  ZK Console Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="bg-black/95 text-emerald-400 font-mono text-[9px] p-3 rounded-lg max-h-48 overflow-y-auto space-y-1 select-text scrollbar-thin">
                  {provingLogs.map((log, i) => (
                    <div key={i} className="break-all whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
