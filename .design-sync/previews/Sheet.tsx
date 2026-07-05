import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, Button } from "tecta";

export const Open = () => (
  <Sheet open>
    <SheetTrigger asChild>
      <Button variant="outline">Open sheet</Button>
    </SheetTrigger>
    <SheetContent forceMount>
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
