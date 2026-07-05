import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarGroupAction, SidebarGroupContent, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarMenuAction, SidebarMenuBadge, SidebarMenuSub, SidebarMenuSubItem,
  SidebarMenuSubButton, SidebarMenuSkeleton, SidebarInput, SidebarInset, SidebarRail,
  SidebarSeparator, SidebarTrigger, Button,
} from "tecta";

export const Default = () => (
  <SidebarProvider defaultOpen style={{ minHeight: 420 }}>
    <Sidebar collapsible="none">
      <SidebarHeader>
        <SidebarInput placeholder="Search" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupAction><span>+</span></SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>Overview</SidebarMenuButton>
                <SidebarMenuBadge>3</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>Payroll</SidebarMenuButton>
                <SidebarMenuAction><span>⋯</span></SidebarMenuAction>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="#">Runs</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="#">History</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarTrigger />
      </SidebarFooter>
    </Sidebar>
    <SidebarInset>
      <div style={{ padding: 16, fontSize: 14 }}>Main content area</div>
    </SidebarInset>
  </SidebarProvider>
);
