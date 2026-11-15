# Redesign reference and baseline inspection

Reviewed **14 November 2026**, before frontend changes. Read all 861 lines of the supplied `README (3).md` and inspected the live [BleckBl reference](https://bleckbl.vercel.app/) in Chrome rather than inferring its implementation from the brief.

## Directly observed

* The reference loaded with HTTP 200 at desktop 1440 and mobile 390 pixel widths.
* Computed font families include **Inter** and **Sora**. Its desktop hero heading measured 48 px, weight 600, line height 53.76 px; section headings measured 44–52 px. At mobile width 390, its hero measured 25.55 px. These are observations of this particular responsive render, not a recommendation to reproduce its exact sizes.
* A floating/tinted navigation bar, editorial sections, burgundy focal areas, rounded controls, generous spacing, and a monumental lowercase branded footer are visible.
* Browser animation timing records included 850 ms entrances, 1000 ms secondary effects, and a 32 second repeating ticker. Exact proprietary component code, easing functions, and implementation mechanisms were not copied.
* On mobile, the reference's menu button changes its accessible label from `Open menu` to `Close menu` and exposes `aria-expanded=true`; an expanded link list appears. Its implementation did not expose a dialog role in this inspection. The redesign can use a stronger focus-managed dialog pattern without claiming that exact implementation was observed in the reference.
* The giant patterned footer visual is visible, but no oversized text descendant inside its semantic footer supplied independently measurable glyph metadata. The project's footer font, HTML text treatment and entrance details are therefore a deliberate interpretation, not a verified copy of that visual's implementation.
* Full-page screenshots made without scrolling do not trigger offscreen reveals; the separate footer and scrolled captures show the corresponding sections. This is a capture limitation, not proof that the reference has empty sections.

Reference screenshots and browser-measured metadata are in `qa/redesign/reference/`. The user's requested Fire in Free-Fall typography is intentionally more monumental than the measured reference hero. Font selection and motion in this project should be described as an adaptation of the design language, not an exact recreation.

## Existing application baseline

All eight application routes were inspected on the running local site at **1440 × 1000** and **390 × 844** before code changes: overview, investigations, publications, comparison, analytics, research assistant, mission workspace, and sources/context. Each returned HTTP 200 and had no page-shell horizontal overflow in those baseline captures.

The original local hero measured 36 px on desktop and 30 px on mobile; section headings were commonly 16.8–18 px, using Segoe UI and Consolas system stacks. Navigation wrapped horizontally and the footer was a narrow legal strip. The redesign therefore requires composition, scale, discovery and interaction changes beyond a color substitution.

Before screenshots and computed metadata are retained in `qa/redesign/before/`. The active application's appearance is the baseline; the README's older screenshot descriptions are not assumed to describe current colors or metrics. The supplied screenshots themselves were not present as separate image attachments in this task.

## Verification boundaries

Automated accessibility scans and synthetic lab performance measurements are evidence for tested states only. They do not establish complete WCAG conformance, real-user INP, or scientific validation. Current API/data contracts, observed-versus-modeled evidence, missing measurements, source links and deterministic comparability rules must remain unchanged throughout visual implementation.
