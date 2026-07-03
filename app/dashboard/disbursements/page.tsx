"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  SendIcon,
  PlusIcon,
  Trash2Icon,
  ShieldCheckIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CoinsIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  type EmployeePayrollEntry,
  type DisburseResult,
  executeDisburseBatch,
} from "@/lib/payroll-sdk";
import { useWallet } from "@/components/wallet-provider";

type DisburseStatus = "idle" | "generating" | "signing" | "submitting" | "success" | "error";

const DISBURSE_TOUR_SEEN_KEY = "tecta_disburse_tour_seen";

export default function DisbursementsPage() {
  const [employees, setEmployees] = useState<EmployeePayrollEntry[]>([]);

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    amount: "",
  });

  const [status, setStatus] = useState<DisburseStatus>("idle");
  const [result, setResult] = useState<DisburseResult | null>(null);
  const [showSecretsModal, setShowSecretsModal] = useState(false);
  const { walletAddress, connectWallet } = useWallet();

  const addEmployee = () => {
    if (!newEmployee.name || !newEmployee.amount) return;

    const entry: EmployeePayrollEntry = {
      name: newEmployee.name,
      amount: Number(newEmployee.amount),
      publicKey: String(Math.floor(Math.random() * 999999999)),
      salt: String(Math.floor(Math.random() * 999999)),
    };

    setEmployees((prev) => [...prev, entry]);
    setNewEmployee({ name: "", amount: "" });
  };

  const removeEmployee = (index: number) => {
    setEmployees((prev) => prev.filter((_, i) => i !== index));
  };

  // First-time HR visit: walk through how to build and send a batch.
  useEffect(() => {
    if (localStorage.getItem(DISBURSE_TOUR_SEEN_KEY)) return;
    localStorage.setItem(DISBURSE_TOUR_SEEN_KEY, "1");

    const tour = driver({
      showProgress: true,
      allowClose: true,
      steps: [
        {
          element: "#tour-employee-list",
          popover: {
            title: "Payroll Batch",
            description: "Employees you add to this batch show up here before you disburse.",
          },
        },
        {
          element: "#tour-add-employee",
          popover: {
            title: "Add an Employee",
            description: "Enter a name and amount, then click Add to include them in the batch.",
          },
        },
        {
          element: "#tour-disburse-summary",
          popover: {
            title: "Review Before Sending",
            description: "Check the employee count and total amount before disbursing — this is what gets pulled from your wallet.",
          },
        },
        {
          element: "#tour-disburse-button",
          popover: {
            title: "Disburse the Batch",
            description: "Generates a ZK commitment per employee and submits disburse_batch on-chain, moving funds into the shielded payroll contract.",
          },
        },
      ],
    });
    tour.drive();

    return () => tour.destroy();
  }, []);

  const totalAmount = employees.reduce((sum, e) => sum + e.amount, 0);

  const handleDisburse = async () => {
    if (employees.length === 0) return;

    try {
      // Step 1: Connect wallet if not connected
      let address = walletAddress;
      if (!address) {
        setStatus("signing");
        address = await connectWallet();
        if (!address) {
          setStatus("error");
          setResult({
            success: false,
            error: "Wallet connection required",
            commitments: [],
            totalAmount: 0,
          });
          return;
        }
      }

      // Step 2: Generate commitments
      setStatus("generating");
      await new Promise((r) => setTimeout(r, 800)); // Visual feedback

      // Step 3: Sign & submit
      setStatus("signing");

      const disburseResult = await executeDisburseBatch(employees, address);

      if (disburseResult.success) {
        setResult(disburseResult);
        setStatus("success");
        // Save the employees list to localStorage so the Claim page can compute the correct sibling paths
        localStorage.setItem("demo_payroll_list", JSON.stringify(employees));
        setShowSecretsModal(true);
      } else {
        setStatus("error");
        setResult({
          success: false,
          error: "Disbursement failed",
          commitments: [],
          totalAmount,
        });
      }
    } catch (error: any) {
      setStatus("error");
      setResult({
        success: false,
        error: error.message || "Disbursement failed",
        commitments: [],
        totalAmount,
      });
    }
  };

  const resetForm = () => {
    setStatus("idle");
    setResult(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Disbursements
        </h1>
        <p className="text-sm text-muted-foreground">
          Execute shielded payroll batch disbursements via ZK commitments
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Employee Payroll List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card id="tour-employee-list">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Payroll Batch
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <UsersIcon className="h-3 w-3 mr-1" />
                  {employees.length} employees
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <CoinsIcon className="h-3 w-3 mr-1" />$
                  {totalAmount.toLocaleString()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Employee List */}
              <div className="space-y-3">
                {employees.map((employee, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {employee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{employee.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          PK: {employee.publicKey.slice(0, 6)}… · Salt:{" "}
                          {employee.salt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">
                        ${employee.amount.toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeEmployee(index)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={status !== "idle"}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {employees.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <UsersIcon className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No employees in batch</p>
                    <p className="text-xs">Add employees below to begin</p>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              {/* Add Employee Form */}
              <div id="tour-add-employee" className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Employee Name
                  </label>
                  <Input
                    placeholder="e.g. Jane Doe"
                    value={newEmployee.name}
                    onChange={(e) =>
                      setNewEmployee((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    disabled={status !== "idle"}
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Amount ($)
                  </label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={newEmployee.amount}
                    onChange={(e) =>
                      setNewEmployee((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    disabled={status !== "idle"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addEmployee();
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="default"
                  onClick={addEmployee}
                  disabled={
                    !newEmployee.name || !newEmployee.amount || status !== "idle"
                  }
                  className="gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Disburse Action Panel */}
        <div className="flex flex-col gap-4">
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Initialize Disburse
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Summary */}
              <div id="tour-disburse-summary" className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Employees</span>
                  <span className="font-medium">{employees.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-semibold text-lg">
                    ${totalAmount.toLocaleString()}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Stellar Testnet
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Method</span>
                  <span className="text-xs font-mono">disburse_batch</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Privacy</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    <ShieldCheckIcon className="h-3 w-3 mr-0.5" />
                    ZK Shielded
                  </Badge>
                </div>
              </div>

              {/* Status Progress */}
              {status !== "idle" && status !== "success" && status !== "error" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    {status === "generating" && "Generating ZK commitments…"}
                    {status === "signing" && "Awaiting wallet signature…"}
                    {status === "submitting" && "Submitting to Soroban…"}
                  </div>
                  <div className="flex gap-1">
                    {["generating", "signing", "submitting"].map((step, i) => (
                      <div
                        key={step}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          ["generating", "signing", "submitting"].indexOf(
                            status
                          ) >= i
                            ? "bg-blue-500"
                            : "bg-blue-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Success State */}
              {status === "success" && result && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                    <CheckCircle2Icon className="h-5 w-5" />
                    Disbursement Successful
                  </div>
                  {result.txHash && (
                    <div className="text-xs">
                      <span className="text-emerald-600">TX Hash:</span>{" "}
                      <span className="font-mono text-emerald-800 break-all">
                        {result.txHash}
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-emerald-600">
                    {result.commitments.length} commitments generated ·{" "}
                    ${result.totalAmount.toLocaleString()} disbursed
                  </div>
                  {/* Show commitments */}
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {result.commitments.map((c, i) => (
                      <div
                        key={i}
                        className="font-mono text-[10px] text-emerald-700 bg-emerald-100 rounded px-2 py-1 break-all"
                      >
                        #{i + 1}: {c.slice(0, 20)}…{c.slice(-8)}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    className="w-full mt-2"
                  >
                    New Disbursement
                  </Button>
                </div>
              )}

              {/* Error State */}
              {status === "error" && result && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                    <AlertCircleIcon className="h-5 w-5" />
                    Disbursement Failed
                  </div>
                  <p className="text-xs text-red-600">
                    {result.error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    className="w-full mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {/* Main Action Button */}
              {(status === "idle") && (
                <Button
                  id="tour-disburse-button"
                  className="w-full gap-2 h-11 text-sm font-semibold"
                  onClick={handleDisburse}
                  disabled={employees.length === 0}
                >
                  <SendIcon className="h-4 w-4" />
                  Initialize Disburse
                </Button>
              )}

              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                This will generate ZK commitments for each employee and submit a{" "}
                <code className="text-[10px]">disburse_batch</code> transaction
                to the shielded payroll contract on Stellar Testnet.
              </p>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    step: "1",
                    title: "Generate Commitments",
                    desc: "Poseidon hash of (amount, publicKey, salt) for each employee",
                  },
                  {
                    step: "2",
                    title: "Sign Transaction",
                    desc: "HR wallet signs disburse_batch via Stellar Wallets Kit",
                  },
                  {
                    step: "3",
                    title: "Submit On-Chain",
                    desc: "Commitments are stored in the Merkle tree on Soroban",
                  },
                  {
                    step: "4",
                    title: "Employee Claims",
                    desc: "Employees prove ownership with ZK proof to claim privately",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Secrets Modal Overlay */}
      {showSecretsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-primary/5 border-b border-border/80 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-emerald-500" />
                  Disbursement ZK Claim Secrets
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Save these details. They are required for employees to claim their salaries privately.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSecretsModal(false)}
                className="rounded-full size-8"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-[11px] text-amber-800 leading-relaxed font-sans">
                <strong>Important Notice:</strong> These secrets are calculated entirely in your browser and are never saved on any database or server. If you close this page without noting these details, the employees will not be able to claim their funds.
              </div>

              {/* Secrets Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                      <th className="p-3">Employee</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Private Key (Seed)</th>
                      <th className="p-3">Salt</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="p-3 font-medium">{emp.name}</td>
                        <td className="p-3 font-semibold">${emp.amount.toLocaleString()}</td>
                        <td className="p-3 font-mono text-[11px]">{emp.publicKey}</td>
                        <td className="p-3 font-mono text-[11px]">{emp.salt}</td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => {
                              const noteText = `Employee: ${emp.name}\nAmount: ${emp.amount}\nPrivate Key Seed: ${emp.publicKey}\nSalt: ${emp.salt}\nCommitment: ${result?.commitments[i] || ""}\nIndex: ${i}`;
                              navigator.clipboard.writeText(noteText);
                            }}
                          >
                            Copy Info
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Full JSON Export */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex justify-between items-center">
                  <span>Batch JSON Export (Raw Data)</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => {
                      const data = employees.map((emp, i) => ({
                        name: emp.name,
                        amount: emp.amount,
                        privateKey: emp.publicKey,
                        salt: emp.salt,
                        commitment: result?.commitments[i] || "",
                        index: i,
                      }));
                      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                    }}
                  >
                    Copy Entire Batch JSON
                  </Button>
                </label>
                <textarea
                  readOnly
                  value={JSON.stringify(
                    employees.map((emp, i) => ({
                      name: emp.name,
                      amount: emp.amount,
                      privateKey: emp.publicKey,
                      salt: emp.salt,
                      commitment: result?.commitments[i] || "",
                      index: i,
                    })),
                    null,
                    2
                  )}
                  className="w-full h-32 font-mono text-[10px] p-2.5 rounded-lg border border-border bg-muted/30 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border/80 px-6 py-4 flex justify-between items-center bg-muted/10">
              <div className="text-[10px] text-muted-foreground font-mono">
                Batch hash: {result?.txHash?.slice(0, 16)}…
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSecretsModal(false)}>
                  Close Window
                </Button>
                <Button size="sm" asChild>
                  <Link href="/dashboard/claim">Proceed to Claims</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
