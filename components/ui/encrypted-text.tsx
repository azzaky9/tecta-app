"use client";
import { cn } from "@/lib/utils";
import { motion, useInView } from "motion/react";
import React, { useEffect, useRef, useState } from "react";

type EncryptedTextProps = {
  text: string;
  className?: string;
  /**
   * Time in milliseconds between revealing each subsequent real character.
   * Lower is faster. Defaults to 50ms per character.
   */
  revealDelayMs?: number;
  /** Optional custom character set to use for the gibberish effect. */
  charset?: string;
  /**
   * Time in milliseconds between gibberish flips for unrevealed characters.
   * Lower is more jittery. Defaults to 50ms.
   */
  flipDelayMs?: number;
  /** CSS class for styling the encrypted/scrambled characters */
  encryptedClassName?: string;
  /** CSS class for styling the revealed characters */
  revealedClassName?: string;
};

const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?";

function generateRandomCharacter(charset: string): string {
  const index = Math.floor(Math.random() * charset.length);
  return charset.charAt(index);
}

export const EncryptedText: React.FC<EncryptedTextProps> = ({
  text,
  className,
  revealDelayMs = 50,
  charset = DEFAULT_CHARSET,
  flipDelayMs = 50,
  encryptedClassName,
  revealedClassName,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  const [revealCount, setRevealCount] = useState<number>(0);
  const [scrambleChars, setScrambleChars] = useState<string[]>([]);

  const startTimeRef = useRef<number>(0);
  const lastFlipTimeRef = useRef<number>(0);
  const isAnimationStartedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isInView) return;

    // Initialize animation asynchronously outside render phase to respect purity
    const startAnimation = () => {
      const initialScramble = text.split("").map((ch) =>
        ch === " " ? " " : generateRandomCharacter(charset)
      );
      setScrambleChars(initialScramble);
      setRevealCount(0);

      startTimeRef.current = performance.now();
      lastFlipTimeRef.current = startTimeRef.current;
      isAnimationStartedRef.current = true;
    };

    const startRaf = requestAnimationFrame(startAnimation);
    let isCancelled = false;
    let frameId: number | null = null;

    const update = (now: number) => {
      if (isCancelled || !isAnimationStartedRef.current) {
        frameId = requestAnimationFrame(update);
        return;
      }

      const elapsedMs = now - startTimeRef.current;
      const totalLength = text.length;
      const currentRevealCount = Math.min(
        totalLength,
        Math.floor(elapsedMs / Math.max(1, revealDelayMs))
      );

      setRevealCount(currentRevealCount);

      if (currentRevealCount >= totalLength) {
        return;
      }

      // Re-randomize unrevealed scramble characters on an interval
      const timeSinceLastFlip = now - lastFlipTimeRef.current;
      if (timeSinceLastFlip >= Math.max(0, flipDelayMs)) {
        setScrambleChars((prev) => {
          const next = [...prev];
          for (let index = 0; index < totalLength; index += 1) {
            if (index >= currentRevealCount) {
              if (text[index] !== " ") {
                next[index] = generateRandomCharacter(charset);
              } else {
                next[index] = " ";
              }
            }
          }
          return next;
        });
        lastFlipTimeRef.current = now;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(startRaf);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      isAnimationStartedRef.current = false;
    };
  }, [isInView, text, revealDelayMs, charset, flipDelayMs]);

  if (!text) return null;

  return (
    <motion.span
      ref={ref}
      className={cn(className)}
      aria-label={text}
      role="text"
    >
      {text.split("").map((char, index) => {
        const isRevealed = index < revealCount;
        const displayChar = isRevealed
          ? char
          : scrambleChars[index] ?? char;

        return (
          <span
            key={index}
            className={cn(isRevealed ? revealedClassName : encryptedClassName)}
          >
            {displayChar}
          </span>
        );
      })}
    </motion.span>
  );
};
