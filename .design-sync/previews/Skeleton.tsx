import { Skeleton } from "tecta";

export const Default = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 220 }}>
    <Skeleton style={{ height: 16, width: "60%" }} />
    <Skeleton style={{ height: 16, width: "100%" }} />
    <Skeleton style={{ height: 16, width: "80%" }} />
  </div>
);
