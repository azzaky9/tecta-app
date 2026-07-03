"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { Vault, Terminal, FileLock, User, Wallet } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { AnimatedBeam } from "@/components/ui/animated-beam";

export function Architecture() {
  const containerRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const tectaRef = useRef<HTMLDivElement>(null);
  const wallet1Ref = useRef<HTMLDivElement>(null);
  const wallet2Ref = useRef<HTMLDivElement>(null);
  const wallet3Ref = useRef<HTMLDivElement>(null);
  const wallet4Ref = useRef<HTMLDivElement>(null);

  return (
    <section className="py-stack-lg flex flex-col gap-stack-lg">
      <div className="flex flex-col gap-2 max-w-2xl">
        <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">The Architectural Flow</h2>
        <p className="font-body-lg text-body-lg text-secondary">
          Tecta isolates payroll computation off-chain while leveraging Soroban smart contracts for shielded execution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center w-full">
        {/* Left Side: 3 Architectural Flow Cards stacked vertically */}
        <div className="flex flex-col gap-4 w-full">
          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex gap-4 items-start rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-primary border border-slate-100 shrink-0">
              <Vault className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-bold">1. Shielded Treasury</CardTitle>
              <CardDescription className="text-xs text-secondary">
                Fund your dedicated Soroban contract with USDC to mask operational budgets.
              </CardDescription>
            </div>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex gap-4 items-start rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-primary border border-slate-100 shrink-0">
              <Terminal className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-bold">2. ZK Compilation</CardTitle>
              <CardDescription className="text-xs text-secondary">
                Execute payroll logic locally via Noir circuits so HR data never leaves your servers.
              </CardDescription>
            </div>
          </Card>

          <Card className="p-5 bg-white border border-slate-200 shadow-sm flex gap-4 items-start rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-primary border border-slate-100 shrink-0">
              <FileLock className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-bold">3. Confidential Payout</CardTitle>
              <CardDescription className="text-xs text-secondary">
                Settle instantly on-chain while keeping transaction amounts mathematically encrypted.
              </CardDescription>
            </div>
          </Card>
        </div>

        {/* Right Side: Animated Beam process diagram */}
        <div
          ref={containerRef}
          className="relative flex h-[350px] w-full items-center justify-between overflow-hidden py-10 px-6 md:px-16 bg-transparent border-none shadow-none"
        >
          {/* Left Column (User / Enterprise Treasury) */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div
              ref={userRef}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-md border border-slate-800"
            >
              <User className="h-6 w-6" />
            </div>
            <span className="font-mono text-[9px] text-secondary tracking-wider">TREASURY</span>
          </div>

          {/* Center Column (Tecta ZK-Shield Node) */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div
              ref={tectaRef}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg border border-slate-800 p-2"
            >
              <Image src="/tecta.svg" alt="Tecta" width={30} height={30} className="invert brightness-0 filter" />
            </div>
            <span className="font-mono text-[9px] text-primary tracking-wider font-semibold">TECTA SHIELD</span>
          </div>

          {/* Right Column (Employee Wallets Fan-out) */}
          <div className="flex flex-col justify-between h-full py-2 z-10">
            <div className="flex items-center gap-3">
              <div
                ref={wallet1Ref}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-md border border-slate-800"
              >
                <Wallet className="h-5 w-5" />
              </div>
              <span className="font-mono text-[9px] text-secondary">Wallet A</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                ref={wallet2Ref}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-md border border-slate-800"
              >
                <Wallet className="h-5 w-5" />
              </div>
              <span className="font-mono text-[9px] text-secondary">Wallet B</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                ref={wallet3Ref}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-md border border-slate-800"
              >
                <Wallet className="h-5 w-5" />
              </div>
              <span className="font-mono text-[9px] text-secondary">Wallet C</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                ref={wallet4Ref}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-md border border-slate-800"
              >
                <Wallet className="h-5 w-5" />
              </div>
              <span className="font-mono text-[9px] text-secondary">Wallet D</span>
            </div>
          </div>

          {/* Animated Beams */}
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={userRef}
            toRef={tectaRef}
            curvature={0}
            pathColor="#e2e8f0"
            pathOpacity={0.6}
            gradientStartColor="#3b82f6"
            gradientStopColor="#10b981"
            duration={3}
          />

          <AnimatedBeam
            containerRef={containerRef}
            fromRef={tectaRef}
            toRef={wallet1Ref}
            curvature={60}
            pathColor="#e2e8f0"
            pathOpacity={0.6}
            gradientStartColor="#10b981"
            gradientStopColor="#6366f1"
            duration={4}
            delay={0.2}
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={tectaRef}
            toRef={wallet2Ref}
            curvature={20}
            pathColor="#e2e8f0"
            pathOpacity={0.6}
            gradientStartColor="#10b981"
            gradientStopColor="#6366f1"
            duration={4}
            delay={0.6}
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={tectaRef}
            toRef={wallet3Ref}
            curvature={-20}
            pathColor="#e2e8f0"
            pathOpacity={0.6}
            gradientStartColor="#10b981"
            gradientStopColor="#6366f1"
            duration={4}
            delay={1.0}
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={tectaRef}
            toRef={wallet4Ref}
            curvature={-60}
            pathColor="#e2e8f0"
            pathOpacity={0.6}
            gradientStartColor="#10b981"
            gradientStopColor="#6366f1"
            duration={4}
            delay={1.4}
          />
        </div>
      </div>
    </section>
  );
}
