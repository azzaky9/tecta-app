"use client";

import { ShieldCheck, Zap, Coins, FileCheck2 } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Zero-Knowledge Proofs",
    description:
      "Every claim is verified on-chain by a Noir circuit and Soroban verifier contract — salary amounts and recipient identity never touch a server or a block explorer.",
  },
  {
    icon: Zap,
    title: "Gasless Employee Claims",
    description:
      "Employees can claim with a wallet that holds zero XLM. Tecta sponsors the network fee, so there's no funding step, no wallet top-up, no friction before payday.",
  },
  {
    icon: Coins,
    title: "Any-Token Treasury",
    description:
      "Run payroll in XLM today, USDC tomorrow. Decimals and raw on-chain amounts are resolved automatically — admins always work in human-readable numbers.",
  },
  {
    icon: FileCheck2,
    title: "Verifiable On-Chain Settlement",
    description:
      "Every disbursement settles instantly on Soroban with a publicly auditable transaction hash — the trail is provable end-to-end while amounts stay confidential.",
  },
];

export function Features() {
  return (
    <section className="py-stack-lg flex flex-col gap-stack-lg">
      <div className="flex flex-col gap-2 max-w-2xl">
        <span className="font-label-caps text-xs text-secondary tracking-wider">Core Capabilities</span>
        <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Built for confidential, institutional-grade payroll
        </h2>
        <p className="font-body-lg text-body-lg text-secondary">
          Privacy and auditability aren't a tradeoff — every settlement is cryptographically provable and publicly
          verifiable, without exposing who was paid or how much.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map((feature) => (
          <Card
            key={feature.title}
            className="p-6 bg-white border border-slate-200 shadow-sm flex gap-4 items-start rounded-2xl"
          >
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-primary border border-slate-100 shrink-0">
              <feature.icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <CardTitle className="text-base font-bold">{feature.title}</CardTitle>
              <CardDescription className="text-xs text-secondary leading-relaxed">
                {feature.description}
              </CardDescription>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
