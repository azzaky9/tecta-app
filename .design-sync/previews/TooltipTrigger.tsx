import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Button } from "tecta";

export const Open = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent forceMount style={{ position: "static", transform: "none", marginTop: 8 }}>
        Add to library
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
