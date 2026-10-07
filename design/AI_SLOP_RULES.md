# AI-slop rules

Patterns to avoid by default. Each one is allowed only with a written product reason in `DESIGN_DECISION_LOG.md`.

## Never (already rejected by the user or by this DNA)
| Pattern | Why |
|---|---|
| 3D globe, gold orb, glowing spheres | Rejected by the user (Oct 2026). |
| "View as admin" / impersonation screens | Rejected by the user. |
| Sky / sun / clouds / hills / buildings behind data | Decoration that says nothing about work. |
| Greeting as the largest text on a screen | Generic AI dashboard opener. |
| Glass tiles or glass buttons over gradients | Dribbble cliché, poor contrast. |
| Coloured glow shadows, hover lift + glow, 3D tilt, shine sweep | Motion and light with no meaning. |
| Pill-shaped primary buttons | Consumer / landing-page look. |
| Icon in a tinted rounded square before every row | Padding, not information. |
| Gradient logo tile | Template look. |

## Avoid by default
| Pattern | Use instead |
|---|---|
| A grid of equal rounded cards | Fewer blocks, ordered by user need |
| Donut as the default chart | Labelled bars with numbers; donut as "Show as" only |
| Big hero sections | Your day block sized to its content |
| Stagger animation on every card on every visit | One 150 ms fade for the page |
| Count-up numbers on every visit | First load of the day, Lively only |
| Moving tickers / carousels | Static latest-3 list |
| Emoji as section markers | Words; emoji only in user content (kudos, reactions) |
| Colour-only status | Icon + word (+ colour) |
| Colour used as decoration | Company colour only for action, link, focus, selection |
| Radial page glow | Flat `--bg` |
| Showing the same number in 3 places | One home per figure; others link to it |
| Equal-height stretched cards | Content sets height |
| Centred layouts in work screens | Left-aligned, grid-based |
| "Bento" layouts | Grid with clear main column and rail |
| Decorative illustrations in empty states | One line + one action |

## Also avoid
| Pattern | Why |
|---|---|
| A visual "signature" that does not help a task | The user rejected Roster for this reason; usefulness first |
| All-caps micro labels, text under 13 px | Hard to read |

## Quick test
Cover the logo. If the screen could belong to any SaaS product, it fails.
