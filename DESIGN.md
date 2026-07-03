---
name: Tecta Zero-Knowledge
colors:
  surface: '#ffffff'
  surface-dim: '#f5f5f7'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ffffff'
  surface-container: '#ffffff'
  surface-container-high: '#f5f5f7'
  surface-container-highest: '#e2e8f0'
  on-surface: '#1b1b1d'
  on-surface-variant: '#45464d'
  inverse-surface: '#303032'
  inverse-on-surface: '#ffffff'
  outline: '#e2e8f0'
  outline-variant: '#cbd5e1'
  surface-tint: '#565e74'
  primary: '#121212'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d4e3ff'
  on-secondary-container: '#56657c'
  tertiary: '#121212'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#b8c7e2'
  on-secondary-fixed: '#0c1c30'
  on-secondary-fixed-variant: '#39485e'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f5f5f7'
  on-background: '#1b1b1d'
  surface-variant: '#f5f5f7'
  zkp-payload-bg: '#131b2e'
  zkp-payload-text: '#bec6e0'
  zkp-payload-accent: '#7c839b'
  success-indicator: '#121212'
  error-indicator: '#ba1a1a'
typography:
  headline-lg:
    fontFamily: Sentient-Bold
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Sentient-Bold
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Sentient-Bold
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 16px
  container-margin: 24px
  stack-lg: 32px
  stack-md: 16px
  stack-sm: 8px
---

## Brand & Style

Tecta embodies a **Corporate Modern** aesthetic with a specific focus on **Enterprise Security** and **Web3 Transparency**. The brand personality is authoritative, precise, and highly technical, yet accessible through a clean, light-mode interface. 

The design style leverages a high-fidelity utilitarian approach. It balances a professional "SaaS" layout with specialized components for technical data visualization (ZKP inspectors and cryptographic addresses). The emotional response should be one of "secure reliability"—where complex backend cryptography is presented through a calm, structured, and legible interface.

## Colors

The color palette is rooted in a sophisticated off-white foundation with high-contrast pure white containers:
- **Primary:** Matte black (#121212) used for high-emphasis actions and core branding.
- **Secondary:** A muted blue-grey (#505f76) for supporting text and utility icons.
- **Background Strategy:** A clean off-white (#f5f5f7) background to provide distinction and modern depth.
- **Surface Strategy:** Uses pure white surfaces (#ffffff) for container cards and components to ensure they stand out with their embossed shadows and look clean and high-fidelity.
- **Technical Context:** A dedicated dark-mode block (#131b2e) is used specifically for code and payload inspection, signaling a "developer-tool" sub-context within the manager experience.

## Typography

The system utilizes **Sentient** (Variable/Bold) for headlines to create an editorial, premium look, and **Inter** as the workhorse typeface for body text, descriptions, and labels. It is paired with **Geist** for monospaced data, providing a technical edge to wallet addresses and cryptographic proofs.

Key typographic rules:
- **Case Policy:** Use `label-caps` for all metadata headers, table headers, and secondary navigation items to create a clear structural hierarchy.
- **Monospacing:** Any string representing a blockchain hash, wallet address, or financial value should use `mono-data`.
- **Headlines:** Use tight letter-spacing on larger headers to maintain a compact, premium feel.

## Layout & Spacing

The layout follows a **Hybrid Grid** model:
- **Side Navigation:** A fixed-width 256px (w-64) sidebar for primary navigation on desktop.
- **Main Content:** A fluid 12-column grid inside a `max-w-7xl` container. 
- **Rhythm:** An 8px base unit drives the system. Section gaps use `stack-lg` (32px), while internal component spacing uses `stack-md` (16px).
- **Responsive Behavior:** 
  - **Desktop:** Side-docked navigation with a multi-column dashboard.
  - **Mobile:** The sidebar is hidden in favor of a top-bar with a horizontal-scrolling sub-menu for quick section access. Padding reduces from 24px to 16px.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and **Embossed Shadows**:
- **Z-Index 0 (Background):** Soft off-white (#f5f5f7) provides the main page background canvas.
- **Z-Index 1 (Cards/Navigation):** Floating pure white (#ffffff) containers use an embossed shadow setup (`shadow-[0_2px_8px_rgba(18,18,18,0.06),0_1px_2px_rgba(18,18,18,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]`) to look raised and clean with a top-lip reflection highlight, without needing borders.
- **Focus States:** Input fields use a transition from the neutral border to a `primary` (#121212) ring to indicate active depth.

## Shapes

The shape language is primarily **Rounded**, moving toward **Pill-shaped** for interactive elements:
- **Containers:** Large cards and section blocks use a 16px (1rem) or 24px (1.5rem) corner radius.
- **Interactive Elements:** Primary buttons and navigation links use a `full` (pill) radius to distinguish them from static structural containers.
- **Small Components:** Inputs and small utility blocks use an 8px (0.5rem) radius.

## Components

### Buttons
- **Primary:** Pill-shaped, background `primary`, text `on-primary`. High emphasis.
- **Ghost/Nav:** Pill-shaped, transparent background, text `on-surface-variant`. On hover, apply `surface-variant`.

### Cards
- Cards use 24px padding, 24px radius, and a borderless design carrying an embossed shadow.
- **Metric Cards:** Feature a `label-caps` title, `headline-lg` value, and `mono-data` footer for trend information.

### Data Tables
- Header rows use `surface-container-low` with `label-caps` text.
- Standard rows have a fixed height of 56px to ensure a comfortable touch target and consistent vertical rhythm.
- Use horizontal dividers (`divide-y`) rather than full grid borders.

### Input Fields
- Background: `surface-container-low`.
- Border: `surface-variant`.
- Typography: `mono-data`.
- Always include a `label-caps` label above the input field.

### Status Chips
- Small, pill-shaped indicators using `surface-variant` backgrounds and `label-caps` text. Used for status like "Valid Identity" or "Verified".
