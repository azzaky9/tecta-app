import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, Button,
} from "tecta";

export const Open = () => (
  <DropdownMenu open>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">Options</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent forceMount style={{ position: "static", transform: "none", marginTop: 8 }}>
      <DropdownMenuLabel>My Account</DropdownMenuLabel>
      <DropdownMenuGroup>
        <DropdownMenuItem>Profile<DropdownMenuShortcut>⌘P</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked>Show sidebar</DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value="light">
        <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuSub open>
        <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
        <DropdownMenuSubContent forceMount style={{ position: "static", transform: "none", marginTop: 4 }}>
          <DropdownMenuItem>Email</DropdownMenuItem>
          <DropdownMenuItem>Message</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>
);
