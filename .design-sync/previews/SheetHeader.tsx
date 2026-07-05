import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, Button } from "tecta";

export const Open = () => (
  <Sheet open>
    <SheetTrigger asChild>
      <Button variant="outline">Open sheet</Button>
    </SheetTrigger>
    <SheetContent forceMount style={{ position: "static", transform: "none", width: 320, boxShadow: "none", border: "1px solid var(--border)" }}>
      <SheetHeader>
        <SheetTitle>Edit profile</SheetTitle>
        <SheetDescription>Make changes to your profile here.</SheetDescription>
      </SheetHeader>
      <SheetFooter>
        <Button>Save changes</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
