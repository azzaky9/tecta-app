import { Input } from "tecta";

export const Default = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
    <Input placeholder="Email address" />
    <Input placeholder="Disabled" disabled />
  </div>
);
