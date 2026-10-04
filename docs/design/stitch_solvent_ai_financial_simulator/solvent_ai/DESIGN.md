---
name: Solvent AI
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434656'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#747688'
  outline-variant: '#c4c5d9'
  surface-tint: '#124af0'
  primary: '#0040e0'
  on-primary: '#ffffff'
  primary-container: '#2e5bff'
  on-primary-container: '#efefff'
  inverse-primary: '#b8c3ff'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fc'
  on-secondary-container: '#57657a'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#0035be'
  secondary-fixed: '#d5e3fc'
  secondary-fixed-dim: '#b9c7df'
  on-secondary-fixed: '#0d1c2e'
  on-secondary-fixed-variant: '#3a485b'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-desktop: 40px
  container-padding-mobile: 16px
  gutter: 24px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style
The design system for this financial platform is built on the pillars of **clarity, precision, and institutional trust.** It targets individuals seeking to regain control over their debt and liquidity, requiring a UI that feels both authoritative and empowering. 

The aesthetic follows a **Corporate / Modern** approach with a focus on data density without clutter. The interface uses a "Card-on-Canvas" layout where the primary background remains a soft off-white to reduce eye strain, while active content lives on pure white surfaces. This creates a subtle depth that guides the user toward actionable financial insights. 

Key visual principles:
- **Data Integrity:** Numbers and financial metrics are never obscured by decorative elements.
- **Calmness:** Generous whitespace (macro-padding) is used to prevent the "stress" often associated with debt management.
- **Utility:** Every element serves a functional purpose, utilizing subtle borders rather than heavy shadows to define structure.

## Colors
The palette is engineered for high-stakes decision-making. **Deep Indigo** is the primary driver for "Commit" actions and navigational focus. The status colors—Emerald, Amber, and Crimson—are reserved strictly for financial health indicators (Effort Rates) to ensure they carry maximum semantic weight.

- **Primary (Indigo):** Used for primary buttons, active states, and brand accents.
- **Secondary (Slate):** Used for body text, icons, and structural borders.
- **Background (Neutral):** #F8FAFC serves as the application canvas.
- **Surface:** Pure white (#FFFFFF) is used for cards and input containers to differentiate them from the canvas.

## Typography
This design system utilizes **Inter** for its exceptional legibility in numerical data and small-scale labels. 

- **Numerical Display:** For account balances and debt totals, use `display-lg` with tightened letter spacing to convey a sense of "solid" financial standing.
- **Hierarchy:** Use `label-sm` in Slate (#475569) for metadata and field titles to maintain a clear distinction between labels and user data.
- **Responsiveness:** On mobile, `display-lg` scales down significantly to ensure large balances do not wrap awkwardly or break the horizontal rhythm of the cards.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop (max-width: 1280px) and transitions to a **Fluid Grid** on mobile devices.

- **Desktop:** 12-column grid with 24px gutters. Use a centralized "Focus Column" for complex debt calculators to keep user attention on the center of the screen.
- **Mobile:** 4-column grid with 16px margins. 
- **Spacing Rhythm:** All spacing is based on an 8px baseline. Use `stack-md` (12px) for spacing between related items within a card, and `stack-lg` (24px) for spacing between distinct card sections.
- **Safe Areas:** Ensure a minimum of 40px vertical padding between the header and the primary dashboard content to allow the layout to "breathe."

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layering** and **Low-Contrast Outlines** rather than aggressive shadows. 

- **Level 0 (Canvas):** The #F8FAFC background.
- **Level 1 (Cards):** White background with a 1px border (#E2E8F0). No shadow. This is the primary container for all content.
- **Level 2 (Hover/Active):** When a card or element is interactive, apply a very soft, diffused shadow (0px 4px 12px rgba(0, 0, 0, 0.05)) to suggest "lift."
- **Separators:** Use 1px solid lines in #F1F5F9 for internal card divisions.

## Shapes
The shape language is refined and professional. 
- **Cards & Containers:** Use `rounded-lg` (1rem / 16px) for main content areas to soften the professional aesthetic.
- **Buttons & Inputs:** Use `rounded-md` (0.5rem / 8px) to maintain a sense of structural integrity and precision.
- **Status Badges:** Use "Pill" shapes (full radius) for effort rate indicators to distinguish them from interactive buttons.

## Components
Consistent implementation of these components ensures the "Fintech" aesthetic is maintained:

- **Data Cards:** Pure white background, 1px border (#E2E8F0), 16px corner radius. Include a `label-sm` header for the card title.
- **Primary Buttons:** Deep Indigo background, white text, 8px radius. Use `label-md` for button text.
- **Status Badges (Effort Rate):** 
    - *Healthy (<30%):* Emerald Green text/border with 10% opacity Emerald fill.
    - *Warning (30-45%):* Amber Gold text/border with 10% opacity Amber fill.
    - *Danger (>45%):* Crimson Red text/border with 10% opacity Crimson fill.
- **Progress Bars:** 8px height, rounded ends. The track should be #F1F5F9, and the fill should match the semantic status color of the metric.
- **Input Fields:** 1px border (#CBD5E1), 8px radius. On focus, the border transitions to Deep Indigo with a 2px outer glow (Indigo at 10% opacity).
- **Lists:** Use "Inlined List Items" for debt accounts with the balance right-aligned in `headline-sm` weight to ensure clear scanability.