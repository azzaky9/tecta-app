## Setup

No provider wraps the whole app — most components read no context. Two exceptions:

- **Sidebar family** (`Sidebar`, `SidebarContent`, `SidebarMenu*`, etc.) — every one of them calls `useSidebar()` internally, which throws outside `SidebarProvider`. Always compose them as `<SidebarProvider><Sidebar>…</Sidebar><SidebarInset>…</SidebarInset></SidebarProvider>`. `Sidebar` itself needs `md:` breakpoint width (≥768px) to show its desktop layout — it collapses to a Sheet on narrow viewports.
- **Tooltip family** — wrap in `<TooltipProvider>` (delayDuration defaults to 0 in this DS, i.e. instant).

Everything else (`Button`, `Card`, `Badge`, `Input`, …) is a plain styled element or a self-contained Radix primitive — import and use directly, no wrapper needed.

Overlay/portal components (`DropdownMenu*`, `Sheet*`, `Tooltip*`) render their content via a `Portal` — pass `open` (controlled) to force the open state instead of relying on click/hover interaction.

## Styling idiom: Tailwind v4 utility classes, CSS-variable tokens

This is a Tailwind utility-class system (v4, `@theme inline`), not a props-based theme system. Style layout/spacing with Tailwind classes; component-internal colors already come from the token set below — don't hardcode hex colors.

Real token names (from `app/globals.css`, all consumable as `bg-<name>` / `text-<name>` / etc., or `var(--<name>)` in raw CSS):

| Family | Tokens |
|---|---|
| Surface/text | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground` |
| Brand | `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground` |
| State | `muted`, `muted-foreground`, `destructive`, `border`, `input`, `ring` |
| Sidebar (separate palette) | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring` |
| Charts | `chart-1` … `chart-5` |
| ZKP-specific | `zkp-payload-bg`, `zkp-payload-text`, `zkp-payload-accent` (used by `Badge variant="zkp"`) |

Radius scale: `--radius-sm` (0.6×) through `--radius-4xl` (2.6× base) — use `rounded-sm`…`rounded-4xl`, not arbitrary pixel values.

Typography scale is custom, not Tailwind's default: `text-headline-lg|md|sm` (600-700 weight, tight tracking) for headings, `text-body-lg|md` for body copy, `text-label-caps` (12px, uppercase-style caps, 700 weight) for labels/pills, `text-mono-data` for numeric/code data. Heading font is `font-headline-*` (`Sentient-Bold`/`Sentient-Variable`, serif fallback); body is `font-sans` (`--font-sans`, a variable set by the Next.js app, not shipped in this bundle — falls back to the system sans stack).

`class-variance-authority` (cva) drives every variant prop (`Button`, `Badge`, `SidebarMenuButton` all use it) — variants are real Tailwind class strings, not inline styles.

## Where the truth lives

- `styles.css` → `_ds_bundle.css` — the actual compiled utility classes and component CSS. Read this before styling; it's the ground truth for what a class name resolves to.
- `tokens/` — not used in this DS (tokens are inline in `_ds_bundle.css` via `@theme`, not a separate token package).
- Per-component `.prompt.md` — props reference per component.

## Example: composing with this DS

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from "tecta";

function PlanCard() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Upgrade to Pro</CardTitle>
        <CardDescription>Unlock every feature and remove limits.</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Badge variant="secondary">Popular</Badge>
      </CardContent>
      <CardFooter>
        <Button size="lg">Upgrade</Button>
      </CardFooter>
    </Card>
  );
}
```
