# PeelPlan

See it at actual size before you stick. / เห็นขนาดจริง ก่อนติดจริง

Plan laptop sticker layouts on a true 1:1 lid, then print a placement guide accurate to ±1 mm.

## Phase 1 status

Phase 1 runs entirely in the browser, with no backend.

- Laptop models with cited sources: `src/config/laptops.ts`
- One module for every unit conversion (mm ↔ CSS px ↔ PDF pt): `src/lib/scale.ts`
- Screen calibration against an ISO/IEC 7810 ID-1 card, saved per screen
- Editor (react-konva): drag, corner-scale with a live mm readout, rotate (hold Shift to snap every 15°), flip, duplicate, delete, layer order, lock, multi-select (Shift-click or marquee), undo/redo, keyboard shortcuts, snap guides (lid centre, edges, 5 mm margin, other stickers, equal spacing), and warnings for overlaps, the logo zone, and stickers near the edge
- Upload: background removal (edge flood fill, no third-party model), erase/restore brush, auto-isolation of the main shape, die-cut white border, and real size set by typing, a preset, or marking a card or coin in the photo
- Export: 1:1 vector PDF (pdf-lib) with a cover page holding 100 mm checks on both axes, A4 or Letter tiling with overlap strips and crosshairs, a ruler on every sheet, a cut-out template mode, and a coordinate sheet. Also exports a PNG and a CSV.
- Saves locally (localStorage + IndexedDB) and makes share links (layout compressed into the URL hash)
- Thai and English (`next-intl`, `src/messages`), light and dark mode, landing page with scroll-scrubbed story (GSAP + Lenis)
- Lid lighting (`src/lib/lighting.ts`): aluminium falloff, a specular hotspot that follows the pointer, and a mirror-finish logo. Shared by the canvas and the SVG illustrations.

## Structure

```
src/
  app/[locale]/            landing (page.tsx), editor/, root layout with fonts
  config/                  laptops.ts (lid geometry + sources), references.ts (card/coin sizes)
  lib/
    scale.ts               unit conversions (tested)
    geometry.ts            affine maths, rotated-rect overlap (tested)
    snap.ts                snap guides (tested)
    placement.ts           free-spot finder for new stickers (tested)
    warnings.ts            overlap / logo / edge checks (tested)
    layout.ts              layout + asset types, coordinate rows
    pdf/                   tiling.ts + exportPdf.ts (tested)
    image/                 mask.ts pixel ops (tested), browser.ts DOM helpers
  features/editor/         zustand store, persistence, UI components
  components/              header, wordmark, LidArt, landing sections
  stickers/library.ts      original in-house SVG stickers
  messages/                en.json, th.json (+ parity test)
```

## Scripts

```
pnpm dev         # dev server
pnpm test        # unit tests (Vitest)
pnpm typecheck
pnpm lint
pnpm build
```

## Accounts (Google sign-in + onboarding)

Without Supabase keys the app runs fully local and the login page says accounts aren't configured. To turn accounts on:

1. Create a Supabase project. Copy the Project URL and anon key into `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. Run `supabase/migrations/0001_profiles_shops.sql` in the Supabase SQL editor, or with `supabase db push`.
3. In Google Cloud Console, create an OAuth client (type: Web). Add the redirect URI that Supabase shows under Authentication → Providers → Google.
4. In Supabase, enable the Google provider and paste in the client ID and secret.
5. Under Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (plus your production URL) to the redirect allow-list.

Database writes with rules (birth date, consent, shop application) go through the `complete_onboarding` RPC. Clients can only edit cosmetic columns directly. The public shop directory is the `shops_public` view, which never exposes owner names. `delete_my_account()` covers the PDPA right to erasure.

Flow: Google sign-in → `/auth/callback` → `/[locale]/onboarding` (name, birth date, "are you a shop?"; shops also give shop name, owner's full name, product types, and a description) → editor. Age rules (13+ to register, 20+ to own a shop) are enforced both in the server action and by database triggers. Shops start as `pending`, and only the service role can change that status.

## Demo-only artwork

`NEXT_PUBLIC_DEMO_ASSETS=true` (set in `.env.local`, which is gitignored) turns on the Apple-style lid logo, the character fan-art stickers (`CHARACTERS` in `src/stickers/library.ts`), and the 60 stickers cut from founder-supplied sheets (Mickey, Hello Kitty, programming brands). Those live in `public/stickers/demo` and are listed in `src/stickers/sheets.ts`. These are trademarked or copyrighted and exist for private mockups only. Leave the variable unset on any public deployment unless you've licensed the rights.

## Before launch

- Corner radius and logo size/position in `src/config/laptops.ts` are marked `verified: false`. The manufacturer doesn't publish them. Measure a real unit with calipers and update.
- Lid width and height are the manufacturer's closed-chassis footprint. Confirm with a ruler that the lid face matches.
- PDF labels are English-only (standard Helvetica can't render Thai). Embedding a Thai font through `@pdf-lib/fontkit` is a follow-up.
- The landing marquee uses fictional example shops, labelled as placeholders on the page.
