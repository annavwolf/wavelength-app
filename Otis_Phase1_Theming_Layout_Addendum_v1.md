# Otis Phase 1 Rewrite — Theming & Layout Addendum (v1)
### Makes §7's theming buildable, and fixes proportions/whitespace
*Amends `Otis_Phase1_Rewrite_Spec_v1.md` §7 and adds new layout requirements. §7 was specified but not yet built — likely because "subtle and classy" wasn't concrete enough to act on. This gives exact values.*

---

## 1. Section theming (replaces the vague version of base spec §7)

Each of the four sections gets a distinct background tint and a matching progress-bar segment colour. Kept subtle — these are gentle background washes, not saturated colour blocks, text contrast must stay easily readable throughout.

| Section | Background tint | Progress-bar segment colour |
|---|---|---|
| Introduction | Current neutral lavender-grey (baseline, unchanged) | Purple (current default) |
| Personal & team info | A warm, slightly warmer off-white/sand tint | A muted warm rose/terracotta |
| Psychological safety assessment | A cool, slightly blue-tinted grey (ties into the ocean imagery already used here) | A muted teal/navy, echoing the ocean palette |
| Finish | Return to the neutral baseline (or a very light warm gold wash) | Gold/amber |

**Implementation notes:**
- Apply the tint to the page background only — cards, bubbles, and buttons keep their current colours so nothing loses contrast.
- Transition between sections should be a simple fade/no jarring cut.
- The **Psychological safety** section's cool-blue tint should feel like a natural lead-in to the ocean imagery already used in that section (§5.4 of the base spec) — not a competing colour.
- If exact hex values are needed, derive them as a light tint (10–15% opacity) of each segment's progress-bar colour over the current background, rather than inventing unrelated palettes. This keeps the whole thing feeling like one coherent system rather than four different color schemes.

---

## 2. Layout and proportions

**Problem (confirmed by screenshot):** wide, empty grey margins on both sides of the content column make the experience feel visually narrow and underused, and the Wavelength Consulting logo in the top corner is small relative to the available space.

**Fixes:**

1. **Widen the content container further.** The base spec (§1.2) already called for widening from the original narrow column; increase this further — the content area should comfortably use significantly more of the horizontal viewport on desktop, not just marginally more. Text lines can be longer than a narrow chat-app column while staying readable — aim for a wider, more spacious layout rather than a tall narrow one.
2. **Text boxes, input fields, and cards should scale to fill the wider container**, not stay fixed at a narrow width inside newly-available whitespace. If the container gets wider, the elements inside it should use that space, not float in the middle of it.
3. **Increase the Wavelength Consulting logo size** in the top corner, proportionate to the new, larger layout. It currently reads as small relative to the space around it.
4. **Keep it responsive** — this widening applies to desktop/larger viewports; narrower viewports (tablet/mobile) should retain sensible margins so text doesn't run edge-to-edge uncomfortably.

**Net goal:** the page should feel like it's making full, deliberate use of the screen, not like content is floating in a narrow strip with large unused margins on either side.
