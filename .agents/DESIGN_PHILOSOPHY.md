# OneAgent Browser — Design Philosophy: **Nocturne Glass**

> **Core Mandate**: *"If a design is too noticeable, it is bad design."*
> Every surface in OneAgent Browser — chrome, menus, popups, URL bar, tabs, Appbar, sidebars, and internal `about:*` pages — MUST follow this philosophy without exception.

---

## 1. Visual Identity & Inspiration

**Heavy Inspiration**: macOS & Safari architectural calm fused with smoked-obsidian depth.

1. **Architectural Smoked Glass (NOT Liquid Glass)**:
   - Crisp, smoked translucent panels with subtle blur, a razor-thin directional edge highlight, and soft ambient shadow glow.
   - **NEVER** use liquid-glass refraction, chromatic warping, loud neon outlines, or heavy opaque cards.
2. **Zero White Tint**:
   - Dark surfaces MUST stay deep smoked obsidian (`rgba(16–20, 17–21, 23–28, 0.76–0.86)`) or subtly tinted by `--lwt-accent-color`.
   - **NEVER** use milky white frost (`rgba(255, 255, 255, 0.12+)` backgrounds) in dark mode.
   - Light mode uses clean, cool crystal translucency (`rgba(249–252, 250–253, 253–255, 0.80–0.88)`) without chalky gray washout.
3. **Subtle Blur Budget & Containing-Block Safety**:
   - Floating menus / arrow panels / URL bar popover / expanded overlays / dialogs: `--oa-blur-panel` (`blur(11px) saturate(1.22)`).
   - Sticky headers (with zero `position: fixed` descendants) / bottom bars / findbar: `--oa-blur-subtle` (`blur(8px) saturate(1.16)`).
   - **NEVER** apply `backdrop-filter` to inline cards (`.card`, `moz-card`, tiles) or containers holding `anchor()` / `position: fixed` elements: `backdrop-filter` creates a `position: fixed` containing block that traps fixed/anchored descendants (e.g., anchored illustrations).
   - **NEVER** apply `clip-path` (or `overflow: clip` on ancestors) on a `backdrop-filter` surface (like `.urlbarView-background`), as Gecko WebRender isolates clipped backdrop groups and stops blurring the page behind them.
   - **NEVER** exceed `12px` blur — background structure should stay softly legible, not smeared into soup.
4. **One Universal Light Source (`155deg` Overhead Top-Leading)**:
   - Every element in the browser shares ONE key light positioned slightly above and to the inline-start (`155deg`):
     - **Elevated surfaces** (panels, menus, cards, active tabs, buttons, chips) catch a razor `1px` top specular rim (`inset 0 1px 0 0 var(--oa-edge-top)`), an ultra-subtle directional sheen (`var(--oa-sheen-surface)` / `var(--oa-sheen-elevated)`), and cast a soft bottom-weighted ambient drop shadow.
     - **Recessed surfaces** (URL bar at rest, search inputs, inset grouped wells like Pinned/Manage Apps) invert the lighting: soft dark top inner shadow (`inset 0 1px 2px`) + whisper bottom specular lip (`inset 0 -1px 0 0`).
5. **Border & Glow Restraint**:
   - Borders are strictly **`1px`** (`--oa-border-width`), low-opacity hairlines (`6%–8.5%` at rest).
   - **NEVER** use `2px` borders on cards, panels, pills, or inputs (reserve `2px` outlines solely for `:focus-visible` keyboard accessibility).
   - Edge glow (`--oa-border-glow`, `--oa-edge-top-glow`) and shadow glow (`--oa-glow-accent`, `--oa-glow-ambient`) are **theme-derived** (`--color-accent-primary`) and reserved for **active, selected, hovered-interactive, or focused** states — whisper-quiet so depth is *felt* rather than shouted.
6. **Concentric Radii (macOS / Safari Rhythm)**:
   - Outer floating containers (panels, menus, cards, `#appbar-box`, `.browserContainer`): `--oa-radius-panel` / `--oa-radius-card` (`12px`).
   - Inner grouped wells, tiles, standard buttons, inputs: `--oa-radius-control` (`8px`).
   - Menu items & compact highlights: `--oa-radius-item` (`6px`).
   - Search bars, URL pills, circular icon chips: `--oa-radius-pill` (`9999px`).

---

## 2. Single Source of Truth (CSS Tokens & Reusable Classes)

**File**: `firefox/toolkit/themes/shared/design-system/src/oneagent-glass.css`
**Chrome URI**: `chrome://global/skin/design-system/oneagent-glass.css`

It is automatically imported everywhere via:
- `firefox/toolkit/themes/shared/global-shared.css` (all browser chrome, menus, popups, dialogs, sidebars)
- `firefox/toolkit/themes/shared/in-content/common-shared.css` (all internal `about:*` pages, Settings, Add-ons, Passwords, Add Apps)

### Canonical Tokens

| Category | Token | Purpose |
| :--- | :--- | :--- |
| **Light** | `--oa-light-angle` | Universal `155deg` overhead top-leading key light |
| **Blur** | `--oa-blur-subtle` / `--oa-blur-panel` | `8px` inline / `11px` floating glass blur |
| **Surfaces** | `--oa-surface-canvas` | Deep obsidian (`#0c0d11`) / clean light (`#f3f4f8`) page base |
| | `--oa-surface-glass` | Standard smoked translucent glass (tints with `:root[lwtheme]`) |
| | `--oa-surface-glass-elevated` | Floating menus, arrow panels, URL popover, dialogs |
| | `--oa-surface-card` | Bento / settings / Appbar panel cards |
| | `--oa-surface-recessed` | Inset inputs, URL bar at rest, grouped list wells |
| | `--oa-surface-hover` / `--oa-surface-active` | Whisper hover tint & subtle theme-accent active fill |
| **Sheen** | `--oa-sheen-surface` / `--oa-sheen-elevated` | Subtle `155deg` top-leading surface illumination |
| | `--oa-sheen-ambient-canvas` | Soft overhead studio light falloff on internal pages |
| **Edges** | `--oa-edge-top` / `--oa-edge-top-strong` / `--oa-edge-top-glow` | `1px` inset top specular bevel |
| **Borders** | `--oa-border-width` (`1px`) | Strictly `1px` everywhere |
| | `--oa-border-hairline` / `--oa-border-hover` / `--oa-border-glow` | Resting / hover / active hairline colors |
| | `--oa-divider` | Ultra-quiet `1px` row & section separator |
| **Shadows** | `--oa-shadow-card` / `--oa-shadow-card-hover` | Card depth + top bevel + hover ambient glow |
| | `--oa-shadow-panel` | Floating menu/panel shadow + top specular + ambient aura |
| | `--oa-shadow-glow-active` | Active/selected directional edge glow + outer shadow glow |
| | `--oa-shadow-recessed` / `--oa-shadow-control` | Recessed input well / raised subtle control shadow |
| **Glows** | `--oa-glow-accent` / `--oa-glow-ambient` | Theme-derived (`--color-accent-primary`) soft outer glows |
| **Motion** | `--oa-ease` / `--oa-duration-fast` (`140ms`) / `--oa-duration-base` (`180ms`) | Calm macOS easing |

### Reusable Primitive Classes

Always prefer these classes (or compose directly from `--oa-*` tokens) when building new UI:

- `.oa-glass-surface` — Floating frosted panel (menus, popovers, dropdowns, modals)
- `.oa-glass-card` — Elevated bento/settings card with subtle sheen and `1px` hairline
- `.oa-glass-well` — Recessed grouped container (list tables, Pinned/Manage apps, settings rows)
- `.oa-glass-chip` — Interactive tile/pill with resting hairline, hover lift, and active edge+shadow glow
- `.oa-glass-input` — Recessed Safari-style pill input with accent focus edge glow & shadow glow

---

## 3. System Coverage Map

| Surface | Files Wired |
| :--- | :--- |
| **Core Tokens & Primitives** | `firefox/toolkit/themes/shared/design-system/src/oneagent-glass.css`, `desktop-jar.inc.mn`, `global-shared.css`, `in-content/common-shared.css` |
| **Menus & Arrow Panels** | `firefox/toolkit/themes/shared/popup.css`, `firefox/toolkit/themes/shared/menu.css` |
| **URL Bar & Popover** | `firefox/browser/themes/shared/urlbar.css` |
| **Tabs & Content Viewport** | `firefox/browser/themes/shared/tabbrowser/tabs.css`, `firefox/browser/themes/shared/tabbrowser/content-area.css` |
| **Vertical Tabs & Sidebars** | `firefox/browser/themes/shared/sidebar.css`, `firefox/browser/components/sidebar/sidebar.css` |
| **Appbar & Add Apps Panel** | `firefox/browser/components/sidebar/appbar.css`, `appbar-main.css`, `appbar-customize.html` |
| **Findbar** | `firefox/toolkit/themes/shared/findbar.css` |
| **Internal Pages & Widgets** | `in-content/common-shared.css`, `preferences/preferences.css`, `moz-card/moz-card.css`, `moz-box-common.css`, `moz-button/moz-button.css` |

---

## 4. Mandatory Agent Checklist (Before Shipping Any UI Edit)

- [ ] **No hardcoded flat colors or Nova violet (`#b89cff`)**: Use `--oa-surface-*`, `--oa-border-*`, `--oa-shadow-*`, `--oa-theme-accent*`, or neutral Firefox semantic tokens. Never leave Nova violet (`--color-violet-30` / `#b89cff`), opaque `#202020`, or milky white `rgba(255,255,255,0.15+)` fills.
- [ ] **Neutral hairline borders everywhere**: Keep `--border-color*`, `--button-border-color*`, `--input-border-color*`, and `--toolbar-field-border-color` mapped to `--oa-border-hairline` (never high-contrast `--color-accent-primary` or `#3a3944` solid borders on default buttons/badges).
- [ ] **Transparent sticky headers**: Sticky top containers (`#search-container`, `.sticky-container`, `.main-search`, `.main-heading`) must keep `background: transparent` so they never slice `--oa-sheen-ambient-canvas`.
- [ ] **Respect the `155deg` key light**: Elevated surfaces get top specular bevel + bottom shadow; recessed wells/inputs get top inner shadow + faint bottom lip.
- [ ] **1px border limit**: Never use `2px+` borders on surfaces/inputs/cards (including checked `moz-visual-picker-item`; only `:focus-visible` accessibility outlines).
- [ ] **Blur discipline & containing-block safety**: Stay within `--oa-blur-subtle` (`8px`) or `--oa-blur-panel` (`11px`). Never apply `backdrop-filter` to inline cards (breaks `anchor()` / `position: fixed`), never combine `clip-path` with `backdrop-filter` (breaks WebRender blur), and omit redundant CSS `backdrop-filter` under `@media (-moz-windows-mica-popups)` so DWM Acrylic passes cleanly.
- [ ] **Theme chroma gate & High-Contrast safety**: Drive `--oa-theme-tint` (`chroma > 10`) and `--oa-theme-accent*` via `_extractOATheme` in `LightweightThemeConsumer.sys.mjs` -> `LightweightThemeChild.sys.mjs` so neutral black/white themes stay clean while chromatic themes infuse internal pages, Add Apps, sidebars, and menus; wrap decorative glass rules in `@media not (forced-colors)`.
- [ ] **Windows Acrylic & Mica safety**: Keep `@media (-moz-windows-mica)` / `(-moz-windows-mica-popups)` translucent on toolbars/menus/arrow panels (`panel:not([type="drag"])`, `menupopup`, `.toolbar-menupopup`) without opaque `appearance: none` or double borders.
- [ ] **Test visual restraint**: Step back — if borders, blur, or glow draw attention to themselves before the content, dial opacity down.
