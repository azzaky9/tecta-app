import { Collapsible, CollapsibleTrigger, CollapsibleContent, Button } from "tecta";

export const Open = () => (
  <Collapsible defaultOpen style={{ width: 280 }}>
    <CollapsibleTrigger asChild>
      <Button variant="outline">Toggle details</Button>
    </CollapsibleTrigger>
    <CollapsibleContent style={{ marginTop: 8, fontSize: 14 }}>
      Additional details revealed when the disclosure is open.
    </CollapsibleContent>
  </Collapsible>
);
