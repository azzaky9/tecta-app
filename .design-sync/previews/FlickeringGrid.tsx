import { FlickeringGrid } from "tecta";

export const Default = () => (
  <div style={{ width: 240, height: 120, position: "relative" }}>
    <FlickeringGrid width={240} height={120} squareSize={4} gridGap={6} maxOpacity={0.5} />
  </div>
);
