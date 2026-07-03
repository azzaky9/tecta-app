"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { CardSpotlight } from "@/components/ui/card-spotlight";

export function CTA() {
  const containerRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const tectaRef = useRef<HTMLDivElement>(null);
  const employeeRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<HTMLDivElement>(null);

  return (
    <section className="flex flex-col gap-6 my-stack-lg w-full">
      {/* Title & Header */}
      <div className="flex flex-col gap-2 max-w-2xl items-center text-center mx-auto">
        <span className="font-label-caps text-xs text-secondary tracking-wider">Disbursement Hub</span>
        <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Join the Privacy Ecosystem
        </h2>
        <p className="font-body-lg text-body-lg text-secondary">
          Configure institutional disbursements or access your personal shielded stablecoin payroll dashboard.
        </p>
      </div>

      {/* Main Interactive Floating Bubble Layout */}
      <div
        ref={containerRef}
        className="relative flex flex-col md:grid md:grid-cols-3 gap-8 md:gap-4 w-full min-h-[500px] items-center justify-center bg-transparent border-none shadow-none py-10 overflow-visible"
      >
        {/* Left Column: Enterprise Card (Floating Left Bubble) */}
        <div className="relative w-full h-[320px] z-10">
          <CardSpotlight
            className="absolute inset-0 p-8 bg-slate-900 text-white rounded-[32px] border border-slate-800 shadow-[0_20px_50px_rgba(15,23,42,0.15)] flex flex-col justify-between cursor-pointer"
            color="#0f172a"
            dotColors={[[59, 130, 246], [139, 92, 246]]}
            radius={260}
          >
            <div className="flex flex-col gap-4">
              <span className="font-label-caps text-[10px] text-slate-400 tracking-wider font-bold">Enterprise</span>
              <h3 className="font-headline-lg text-2xl font-bold tracking-tight text-white">For Enterprise</h3>
              <p className="font-body-md text-xs text-slate-300 max-w-[220px]">
                Secure your treasury, automate operational payroll, and manage compliance.
              </p>
            </div>
            <Button asChild className="rounded-full bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-950 font-semibold shadow-none cursor-pointer w-fit">
              <Link href="/dashboard">Deploy Instance</Link>
            </Button>
          </CardSpotlight>
          {/* Right Edge Connector Port */}
          <div
            ref={userRef}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black border-2 border-white z-20 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hidden md:block"
          />
        </div>

        {/* Center Column: Tecta Shield logo and Bottom ZK-Verifier bubble */}
        <div className="flex flex-col items-center justify-between h-[360px] py-4 w-full">
          {/* Tecta Shield Center Node */}
          <div className="my-auto flex flex-col items-center gap-2 z-10">
            <div
              ref={tectaRef}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white shadow-xl border-4 border-white p-2.5"
            >
              <Image src="/tecta.svg" alt="Tecta" width={34} height={34} className="invert brightness-0 filter" />
            </div>
            <span className="font-mono text-[9px] text-primary tracking-widest font-semibold uppercase">
              Tecta Shield
            </span>
          </div>

          {/* Bottom Card (ZK-Verifier Bubble Node) */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-[20px] p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] w-[260px] font-mono text-[9px] text-slate-500">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-800">ZK-VERIFIER NODE</span>
                <span className="text-slate-400">Status: Verified // Block #4.9M</span>
              </div>
            </div>
            {/* Top Edge Connector Port */}
            <div
              ref={verifierRef}
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-black border-2 border-white z-20 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hidden md:block"
            />
          </div>
        </div>

        {/* Right Column: Employees Card (Floating Right Bubble) */}
        <div className="relative w-full h-[320px] z-10">
          <CardSpotlight
            className="absolute inset-0 p-8 bg-white text-black border border-slate-200 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex flex-col justify-between cursor-pointer"
            color="#f8fafc"
            dotColors={[[148, 163, 184], [71, 85, 105]]}
            radius={260}
          >
            <div className="flex flex-col gap-4">
              <span className="font-label-caps text-[10px] text-slate-500 tracking-wider font-bold">Employees</span>
              <h3 className="font-headline-lg text-2xl font-bold tracking-tight text-black">For Employees</h3>
              <p className="font-body-md text-xs text-slate-600 max-w-[220px]">
                Receive stablecoins, manage cryptographic paystubs, and generate tax proofs.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-black hover:bg-slate-50 text-black font-semibold shadow-none cursor-pointer w-fit"
            >
              <Link href="/dashboard">Access Portal</Link>
            </Button>
          </CardSpotlight>
          {/* Left Edge Connector Port */}
          <div
            ref={employeeRef}
            className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black border-2 border-white z-20 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hidden md:block"
          />
        </div>

        {/* Animated Beams */}
        {/* Input: Enterprise -> Tecta Shield */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={userRef}
          toRef={tectaRef}
          curvature={0}
          pathColor="#e2e8f0"
          pathOpacity={0.6}
          gradientStartColor="#3b82f6"
          gradientStopColor="#10b981"
          duration={3.5}
        />

        {/* Output 1: Tecta Shield -> Employees */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={tectaRef}
          toRef={employeeRef}
          curvature={0}
          pathColor="#e2e8f0"
          pathOpacity={0.6}
          gradientStartColor="#10b981"
          gradientStopColor="#6366f1"
          duration={4}
          delay={0.5}
        />

        {/* Output 2: Tecta Shield -> ZK-Verifier */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={tectaRef}
          toRef={verifierRef}
          curvature={0}
          pathColor="#e2e8f0"
          pathOpacity={0.6}
          gradientStartColor="#10b981"
          gradientStopColor="#059669"
          duration={4}
          delay={1}
        />
      </div>
    </section>
  );
}
