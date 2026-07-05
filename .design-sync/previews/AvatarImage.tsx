import { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount } from "tecta";

const IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%236366f1'/%3E%3C/svg%3E";

export const Sizes = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Avatar size="sm"><AvatarImage src={IMG} alt="User" /><AvatarFallback>JD</AvatarFallback></Avatar>
    <Avatar size="default"><AvatarImage src={IMG} alt="User" /><AvatarFallback>JD</AvatarFallback></Avatar>
    <Avatar size="lg"><AvatarImage src={IMG} alt="User" /><AvatarFallback>JD</AvatarFallback></Avatar>
  </div>
);

export const WithBadge = () => (
  <Avatar size="lg">
    <AvatarImage src={IMG} alt="User" />
    <AvatarFallback>JD</AvatarFallback>
    <AvatarBadge style={{ width: 12, height: 12 }} />
  </Avatar>
);

export const Group = () => (
  <AvatarGroup>
    <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
    <Avatar><AvatarImage src={IMG} alt="User" /><AvatarFallback>CD</AvatarFallback></Avatar>
    <Avatar><AvatarFallback>EF</AvatarFallback></Avatar>
    <AvatarGroupCount>+3</AvatarGroupCount>
  </AvatarGroup>
);
