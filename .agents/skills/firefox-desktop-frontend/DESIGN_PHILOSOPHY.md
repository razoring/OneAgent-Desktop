# Frosted Luminescence — Browser Design Philosophy

> **Mandatory Reference for Agents**: All HTML, CSS, XUL, and Lit front-end changes MUST adhere to the **Frosted Luminescence** design philosophy defined here.

---

## 1. Core Aesthetic Vision: Architectural Frosted Glass & Physical Depth

**Frosted Luminescence** treats every UI surface as a physical slab of **matte, finely-ground architectural glass** suspended in three-dimensional space over an ambiently lit canvas.

- **NOT "Liquid Glass"**: Never use warpy refraction, glossy wet reflections, thick cartoon specular blobs, or high-saturation neon borders.
- **Matte Blurred Diffusion**: Surfaces diffuse background light through high-radius Gaussian blur paired with subtle saturation boost (`backdrop-filter: var(--glass-backdrop-sm | md | lg)`).
- **3-Layer Physical Lighting Model**:
  1. **Overhead Specular Rim (`--glass-highlight-top` & `--glass-highlight-rim`)**: Every elevated glass slab catches light along its top inner bevel (`inset 0 1px 0 0 var(--glass-highlight-top)`) and a subtle inner perimeter (`inset 0 0 0 0.5px var(--glass-highlight-rim)`).
  2. **Diagonal Micro-Sheen (`--glass-sheen-gradient`)**: A `165deg` soft gradient across the face of cards, panels, menus, and buttons creates tactile dimensionality without gloss.
  3. **Dual-Component Elevation Shadow (`--box-shadow-level-1..4`)**: Combines a tight contact shadow (ambient occlusion) with a soft, deep penumbra drop shadow proportional to the element's Z-height.

---

## 2. Canonical Design System Tokens (`tokens-shared.css`)

Always consume these tokens from `toolkit/themes/shared/design-system/dist/tokens-shared.css` (available on `:root`, `:host`, and `:host(.anonymous-content-host)` across all chrome, shadow DOM, and in-content documents):

### Blur & Backdrop Filters
| Token | Value | Usage |
| :--- | :--- | :--- |
| `--glass-backdrop-sm` | `blur(12px) saturate(165%)` | Buttons, pills, inputs, list containers, tiles |
| `--glass-backdrop-md` | `blur(20px) saturate(165%)` | Cards (`moz-card`), sidebars, Appbar panels, sticky headers, URL bar |
| `--glass-backdrop-lg` | `blur(28px) saturate(165%)` | Floating menus (`menupopup`), popovers (`panel`), autocomplete dropdowns |

### Translucent Glass Surfaces
| Token | Usage |
| :--- | :--- |
| `--glass-surface-bg` | Base cards, grouped boxes (`moz-box-group`), sidebars, richlistboxes |
| `--glass-surface-elevated-bg` | Secondary elevated bars (e.g., Appbar bottom bar, sticky headers) |
| `--glass-surface-floating-bg` | Context menus, AppMenu panels, dropdowns, floating overlays |
| `--glass-surface-interactive-bg` | Unhovered tiles, inputs, interactive pills |
| `--glass-surface-interactive-hover` | Hovered tiles, pills, and glass controls |
| `--glass-surface-interactive-active` | Pressed/active tiles, pills, and glass controls |

### Lighting, Borders & Elevation
| Token | Usage |
| :--- | :--- |
| `--glass-highlight-top` | Top inner specular bevel (`inset 0 1px 0 0 var(--glass-highlight-top)`) |
| `--glass-highlight-rim` | Inner 0.5px perimeter rim light |
| `--glass-shadow-inner-bottom` | Recessed inner shadow for text/search inputs |
| `--glass-sheen-gradient` | `165deg` surface sheen applied via `background-image` |
| `--glass-border-outer-color` | Standard `1px solid` hairline border for glass surfaces |
| `--glass-border-color-strong` | Emphasized border on `:hover` or active interaction |
| `--glass-ambient-canvas-gradient` | Subtle dual-radial accent ambient light on in-content page `:root` |
| `--box-shadow-level-1` | Low elevation: buttons, inputs, tiles, grouped lists |
| `--box-shadow-level-2` | Medium elevation: cards (`moz-card`), hovered tiles |
| `--box-shadow-level-3` | High elevation: sidebars (`#sidebar`, `#appbar-box`) |
| `--box-shadow-level-4` | Floating elevation: menus (`menupopup`), popups (`panel`), dropdowns |

---

## 3. Reusable CSS Utility Classes (`global-shared.css`)

When building new UI in chrome, sidebar panels, or internal pages, use these standard primitives:

- **`.glass-surface`**: Base frosted slab (`--glass-surface-bg`, `--glass-sheen-gradient`, `--glass-backdrop-md`, border + level-2 shadow).
- **`.glass-card`**: Elevated rounded card container with smooth hover transitions.
- **`.glass-panel`**: High-elevation floating overlay (`--glass-surface-floating-bg`, `--glass-backdrop-lg`, level-4 shadow).
- **`.glass-pill` / `.glass-button`**: Interactive frosted button/tile with hover lift and specular rim.
- **`.glass-input`**: Recessed frosted input field with top rim highlight and inner top shadow.
- **`.glass-list-container`**: Rounded frosted container for divided rows (e.g. Pinned apps, Manage apps, settings lists).

---

## 4. Mandatory Rules for Every Surface

1. **Menus & Popups (`menupopup`, `panel`, `panel-list`)**:
   - Must never use flat, opaque backgrounds (except inside `@media (forced-colors)`).
   - Must apply `background-image: var(--glass-sheen-gradient)` and `backdrop-filter: var(--glass-backdrop-lg)`.
   - Hovered menu items (`menuitem[_moz-menuactive]`, `.subviewbutton:hover`) must show a raised specular top highlight (`inset 0 1px 0 0 var(--glass-highlight-top)`).
2. **Internal Webpages (`about:preferences`, `about:addons`, `appbar-customize.html`, etc.)**:
   - The page `:root` must apply `background-image: var(--glass-ambient-canvas-gradient); background-attachment: fixed;` over `var(--background-color-canvas)` so glass cards have subtle ambient light to diffuse.
   - Sticky headers (such as `#search-container`) must use translucent background + `backdrop-filter: var(--glass-backdrop-md)` so scrolling content blurs smoothly beneath them.
3. **Cards, Lists & Interactive Controls**:
   - Prefer `<moz-card>`, `<moz-box-group>`, `<moz-button>`, and `.glass-card` / `.glass-list-container`.
   - Recessed inputs (`<input>`, `.search-input`, `#urlbar`) must combine `backdrop-filter` with an inner shadow or top specular rim so depth hierarchy (recessed input < flat canvas < raised card < floating menu) is immediately legible.
4. **Accessibility & High-Contrast Safety**:
   - Always preserve `@media (forced-colors)` and `@media (prefers-contrast)` token overrides in `tokens-shared.css`.
