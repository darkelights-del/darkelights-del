# Design System — GNCE Onyx

A dark, medieval-modern identity built for a scroll-driven experience.
Coal-black fields, one crimson accent, two purple steps, and a distinctive
uncial + script + old-style-serif type system. Typography carries the
identity; motion is the life. Read this (and the skills in `.claude/skills/`)
before touching UI.

## Principles

1. **Four colors, two purple steps.** `#0A0908` coal, `#1A0F20` +
   `#2B1B2F` purple (darker / lighter), `#6E0D25` crimson, `#E8E2DC`
   off-white, plus off-white alphas for rules and muted text. Crimson and
   purple both read as text on coal (intentional low-key contrast).
2. **No idle glows. No gradient fills.** Life comes from motion and solid
   color. Texture is film grain and *non-gradient* frosted glass (uniform
   tint + blur + hairline), used sparingly. No ambient/looping glow.
3. **Type is the imagery.** Uncial Antiqua (display), Grey Qo (one script
   flourish per page), Cardo (body). Push display scale hard; keep body
   readable (Cardo is a scholar's old-style serif, tuned for length).
4. **Machined edges.** Radius 0 except the gear button. Hairline rules and
   negative space over cards; glass panels where a surface is warranted.
5. **Every animation is scroll-driven and motivated.** It communicates
   hierarchy, story, or feedback, never decoration. Reveals are clip-path
   wipes and masked character rises, never opacity cross-fades. Everything
   respects `prefers-reduced-motion` and degrades without JS.
6. **Placeholders are loud.** `<Placeholder name="...">` for blocks; `.stub`
   for inline unknowns (team number, handle, TBD dates).
7. **No em-dashes in visible copy. Lean copy only** (no-slop-writing): every
   visible sentence earns its place; anything that restates gets cut.

## Tokens (`src/styles/global.css` `@theme`)

| Token | Value | Use |
| --- | --- | --- |
| `--font-display` | Uncial Antiqua | Headlines, the ONYX wordmark |
| `--font-script` | Grey Qo | One script flourish per page |
| `--font-text` | Cardo | Body, labels (`.type-label` = spaced small caps) |
| `--color-bg` | `#0a0908` | Coal background |
| `--color-surface` / `--color-panel` | `#1a0f20` / `#2b1b2f` | Purple, darker / lighter (glass, footer) |
| `--color-accent` | `#6e0d25` | Crimson: fills, accent text, markers |
| `--color-ink` / `--color-muted` | `#e8e2dc` / ash 60% | Text / secondary text |
| `--ease-out-strong` etc. | cubic-beziers | Entrances, on-screen movement, spring |

## Motion engine — `src/scripts/motion.ts`

One GSAP + ScrollTrigger layer wired to Lenis. The head sets
`html.will-animate` synchronously (no first-paint flash); the module clears
it on boot, and failsafes clear it (and reveal everything) if it never does.
Under reduced motion the module bows out and static CSS stands in.

**Primitives** (data attributes, work on any page):
- `[data-split]` — headings split into masked lines of characters that rise
  from behind the line, scroll-locked; re-split on resize.
- `[data-reveal]` (up/left/right/scale/diag) — crisp clip-path wipe on
  enter, opacity held at 1 (no fade); `diag` is a corner wipe. Lists
  alternate variants instead of repeating one. `[data-reveal-scrub]` is the
  same, locked to scroll. `data-reveal-group` staggers children.
- `[data-parallax="±px"]`, `[data-count]` (number counter),
  `[data-magnetic]` (cursor pull, pointer-fine), `[data-hover-preview]`
  (image beside cursor, needs `[data-preview-root]` + `[data-preview-img]`).

**Scenes** (named, run only when their element exists):
- `.onyx-spine` — the 3D extruded wordmark behind Home; letters hand off
  O → N → Y → X as you scroll (`initOnyxSpine`).
- `[data-hero]` — hero wordmark assembles, then tips into depth.
- `[data-stack]` / `[data-stack-card]` — pinned card stack (lineage).
- `[data-hscroll]` / `[data-hscroll-track]` — diagonal scroll-hijack
  (season build log): the track pans sideways while climbing, panels
  counter-drift past each other, and the track skews with scroll velocity.
- `[data-screen]` — cinema screen-on: letterbox bars part from the centre,
  scrubbed (season highlight match).
- `[data-drift="±px"]` — sibling columns scrub opposite directions so a
  grid shears and crosses as it passes (season gallery).
- `[data-marquee]` / `[data-marquee-track]` — looping ticker geared to
  scroll velocity; scrolling back up rolls it backwards (outreach).
- `[data-tilt]` — glass panels lean toward the cursor, pointer-fine only
  (contact channels).
- `[data-coverflow]` — Swiper coverflow (roster), Swiper dynamically
  imported only where used.
- `[data-flip]` (awards), `[data-ladder]`/`[data-rung]` (sponsor tiers),
  `[data-progress]` (blog reading bar).

One trick per section: no two sections on a page share an entrance or
scroll behaviour.

## Per-page specialties

- **Home**: 3D ONYX spine · hero wordmark · pinned lineage card stack ·
  masked mission line · scroll-reveal robot specs · coverflow roster ·
  magnetic sponsor CTA.
- **Season**: kinetic header · diagonal build log (velocity skew,
  cross-drift panels) · screen-on highlight match · flip-card awards ·
  cross-drift gallery columns.
- **Outreach**: kinetic header · velocity ticker · post rows wiping in
  from alternating sides · ink-in CTA paragraph · magnetic CTA.
- **Contact**: kinetic header · cursor-tilt glass channels · scrubbed tier
  ladder · corner-wipe partner rows · magnetic contact CTA.
- **Blog post**: reading-progress bar · masked title.

## The blog (Outreach)

Markdown collection in `src/content/blog/`. `outreach/index.astro` lists
posts as line-hover rows; `outreach/[id].astro` renders a post in
`.post-body` with a `ViewCounter` (GoatCounter) and `Comments` (giscus),
both stubbed until IDs are set in `src/lib/services.ts` (see README).

## Component inventory

| Component | Purpose |
| --- | --- |
| `scripts/motion.ts` | Motion engine: primitives + scenes. Reduced-motion safe. |
| `layouts/BaseLayout.astro` | Shell: fonts, intro cover, heat rail, view transitions, GearNav, footer, imports motion. |
| `components/Reveal.astro` | `[data-reveal]` wrapper. |
| `components/GearNav.astro` | Gear button + full-screen menu. |
| `components/Placeholder.astro` / `SectionLabel.astro` / `Footer.astro` | Content slots / label / footer. |
| `components/ViewCounter.astro` / `Comments.astro` | Blog views / comments, stub until configured. |

## Conventions

- Content column: `mx-auto max-w-5xl px-5 sm:px-8` (blog body `max-w-3xl`).
- Section rhythm varies on purpose; don't metronome identical sections.
- At most one `.type-label` eyebrow per page opening; most sections open
  with a display headline.
