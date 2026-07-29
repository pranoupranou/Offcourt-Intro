# OFF COURT — Carousel Edition

A three-chapter landing page for Off Court Social Club, launching in North
Bangalore. The hero is a swipeable four-image carousel showcasing Community,
Padel, Wellness and Food & Beverage, leading straight into the founding
membership sign-up.

## Chapters

1. **Hero carousel** — four full-bleed photos with per-slide captions,
   dot navigation, swipe support, and gentle autoplay that stops the moment
   a visitor takes control (dot click or swipe).
2. **Enroll** — founding membership sign-up (Name / Email / Phone), horizontal
   fields on desktop, stacked on mobile. Quiet success state on submit.
3. **Footer** — minimal.

## Run locally

No dependencies.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1   # http://localhost:4175
```

or double-click `start-offcourt.cmd`.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | markup — hero carousel + enroll + footer |
| `styles.css` | mobile-first (390px) styling, brand palette, grain |
| `main.js` | carousel engine (dots, swipe, autoplay-until-interacted), entrance fades, enroll form |
| `assets/community.jpg` `padel-life.jpg` `wellness-life.jpg` `fnb-life.jpg` | the four carousel photos |
| `server.ps1` | zero-dependency local dev server with byte-range support |

## Brand

Merlot `#6A0024` · Chalk `#F2E5C6` · Ink `#170509` · Copper `#C9906B`.
Type: Crista (display) + Geist (sans).

The carousel runs full-colour photography with light-on-dark scrims for nav
and captions — unlike the rest of the site, which uses a beige-everywhere
palette with dark text.

## Notes

- Each slide's `object-position` is hand-tuned per photo (see
  `styles.css`, `.slide[data-index="N"] .slide-img`) so the subject that
  matters — the padel court, the yoga mat, the coffee bar — survives the
  crop on narrow phones, not just whatever sits at the frame's centre.
- `prefers-reduced-motion` disables the slide transition and autoplay;
  the carousel still works via dots/swipe, just without animation.
- To add a fifth slide: duplicate a `<figure class="slide">` block and its
  matching `<button class="dot">`, add an `object-position` rule for its
  index, and update `width: 400%` → `500%` on `.carousel-track` (and the
  `flex: 0 0 25%` on `.slide` → `20%`) in `styles.css`.
