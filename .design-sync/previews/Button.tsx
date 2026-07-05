import { Button } from "tecta";

export const Variants = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
    <Button variant="default">Default</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="destructive">Destructive</Button>
    <Button variant="link">Link</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const Disabled = () => (
  <div style={{ display: "flex", gap: 8 }}>
    <Button disabled>Disabled</Button>
    <Button variant="outline" disabled>Disabled outline</Button>
  </div>
);
