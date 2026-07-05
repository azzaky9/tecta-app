import { Badge } from "tecta";

export const Variants = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <Badge variant="default">Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="destructive">Destructive</Badge>
    <Badge variant="outline">Outline</Badge>
    <Badge variant="zkp">ZKP</Badge>
    <Badge variant="pill">Pill</Badge>
  </div>
);
