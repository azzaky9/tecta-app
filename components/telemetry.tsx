"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export function Telemetry() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-transparent border-none shadow-none w-full">
      <Card className="p-8 flex flex-col gap-2">
        <span className="font-label-caps text-label-caps text-secondary">Total Secured Settlements</span>
        <span className="font-mono-data text-headline-lg font-bold text-primary tracking-tight">$42,910,500.00</span>
        <span className="font-mono-data text-mono-data text-secondary">USDC Equivalent</span>
      </Card>
      <Card className="p-8 flex flex-col gap-2">
        <span className="font-label-caps text-label-caps text-secondary">Active Shielded Nullifiers</span>
        <span className="font-mono-data text-headline-lg font-bold text-primary tracking-tight">8,412</span>
        <span className="font-mono-data text-mono-data text-green-600 flex items-center gap-1">
          <TrendingUp className="h-4 w-4" /> +12% 7d
        </span>
      </Card>
      <Card className="p-8 flex flex-col gap-2">
        <span className="font-label-caps text-label-caps text-secondary">Verification Latency</span>
        <span className="font-mono-data text-headline-lg font-bold text-primary tracking-tight">1.2s</span>
        <span className="font-mono-data text-mono-data text-secondary">Soroban Network Avg</span>
      </Card>
    </section>
  );
}
