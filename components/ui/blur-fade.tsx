"use client";

import React, { useRef } from "react";
import { motion, useInView } from "motion/react";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  yOffset?: number;
  inViewMargin?: string;
  blur?: string;
}

export function BlurFade({
  children,
  className,
  duration = 0.6,
  delay = 0,
  yOffset = 8,
  inViewMargin = "-50px",
  blur = "8px",
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once: true,
    margin: inViewMargin as NonNullable<Parameters<typeof useInView>[1]>["margin"],
  });

  const variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: 0, opacity: 1, filter: "blur(0px)" },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={{
        delay: delay,
        duration: duration,
        ease: [0.21, 0.47, 0.32, 0.98], // smooth cubic-bezier curve
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
