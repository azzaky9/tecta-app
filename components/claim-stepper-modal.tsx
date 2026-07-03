"use client";

import { motion, AnimatePresence } from "motion/react";
import { CheckIcon, Loader2Icon, AlertCircleIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STELLAR_EXPERT_TESTNET_TX = "https://stellar.expert/explorer/testnet/tx/";

export type ClaimStepKey = "proving" | "submitting" | "success";

const STEPS: { key: ClaimStepKey; label: string; desc: string }[] = [
  { key: "proving", label: "Generate Proof", desc: "Proving ownership in your browser" },
  { key: "submitting", label: "Submit", desc: "Broadcasting to Stellar — no wallet needed" },
  { key: "success", label: "Done", desc: "Salary sent privately" },
];

export function ClaimStepperModal({
  open,
  status,
  errorMessage,
  txHash,
  onClose,
}: {
  open: boolean;
  status: ClaimStepKey | "error";
  errorMessage?: string;
  txHash?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  const activeIndex = status === "error" ? -1 : STEPS.findIndex((s) => s.key === status);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl"
        >
          {status === "error" ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertCircleIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">Claim failed</h3>
              <p className="text-sm text-muted-foreground break-words">{errorMessage}</p>
              <button
                onClick={onClose}
                className="mt-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-base font-semibold">Claiming your salary</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Zero-knowledge proof generated locally — your identity stays private.
                </p>
              </div>

              <ol className="flex flex-col gap-0">
                {STEPS.map((step, i) => {
                  const isDone = status === "success" ? true : activeIndex > i;
                  const isCurrent = status !== "success" && i === activeIndex;
                  const isLast = i === STEPS.length - 1;

                  return (
                    <li key={step.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                            isDone
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isCurrent
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted text-muted-foreground"
                          )}
                        >
                          {isDone ? (
                            <CheckIcon className="h-3.5 w-3.5" />
                          ) : isCurrent ? (
                            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className={cn(
                              "w-px flex-1 min-h-[24px] my-1 transition-colors",
                              isDone ? "bg-emerald-500" : "bg-border"
                            )}
                          />
                        )}
                      </div>
                      <div className="pb-6">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isCurrent ? "text-foreground" : isDone ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {status === "success" && (
                <div className="flex flex-col gap-3">
                  {txHash && (
                    <a
                      href={`${STELLAR_EXPERT_TESTNET_TX}${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {txHash.slice(0, 10)}…{txHash.slice(-8)}
                      <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
