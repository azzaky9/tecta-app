import { Kbd, KbdGroup } from "tecta";

export const Default = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Kbd>⌘</Kbd>
    <KbdGroup>
      <Kbd>Ctrl</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  </div>
);
