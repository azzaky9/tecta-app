import React, { useRef } from "react";
import { AnimatedBeam } from "tecta";

export const Default = () => {
  const containerRef = useRef(null);
  const fromRef = useRef(null);
  const toRef = useRef(null);
  return (
    <div ref={containerRef} style={{ position: "relative", width: 240, height: 100, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div ref={fromRef} style={{ width: 40, height: 40, borderRadius: "50%", background: "#6366f1" }} />
      <div ref={toRef} style={{ width: 40, height: 40, borderRadius: "50%", background: "#9c40ff" }} />
      <AnimatedBeam containerRef={containerRef} fromRef={fromRef} toRef={toRef} />
    </div>
  );
};
