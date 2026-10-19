# Product

<!-- impeccable:product-schema 1 -->

> Source: derived from the founder's build brief (2026-10-19). The founder opted out of an interview; every fact below comes from that brief.

## Platform

web

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, react-konva canvas, next-intl (th, en), pdf-lib. Supabase, payments, and paid APIs are undecided and require founder approval.

## Users

- **Buyer / planner**: owns a laptop, wants to decorate the lid, and needs to see placement at actual size before peeling anything. Often on a phone when photographing stickers, and on a desktop when printing.
- **Shop (seller)**: independent sticker maker who lists products with exact physical sizes (Phase 3).
- **Admin**: platform staff who approve shops, moderate listings, and handle payouts (Phase 4).

## Product Purpose

Plan sticker layouts on a true 1:1 laptop lid, print a placement guide that matches reality to within ±1 mm, and later buy the stickers from independent shops through an escrow marketplace.

## Positioning

"See it at actual size before you stick." / "เห็นขนาดจริง ก่อนติดจริง". The difference is physical accuracy: millimetre storage, screen calibration against an ID-1 card, and a 1:1 vector PDF with a calibration ruler.

## Operating Context

Thailand first, then global. Thai and English from day one. Mobile-first for photographing and placing; printing is mainly a desktop flow. Works without an account.

## Capabilities and Constraints

- All dimensions are stored in mm; pixels and points are render-time only.
- Laptop geometry is taken from manufacturer specs with cited sources; unpublished values (corner radius, logo size) are flagged as unverified.
- The PDF must print within ±1 mm at 100% scale.
- Only original, copyright-free sticker designs ship with the product.

## Brand Commitments

- Name: PeelPlan. No trademarked names or logos in PeelPlan's own branding; laptop model names appear only where needed for accuracy.
- Binding visual direction from the founder: white-dominant light UI, one playful accent, Thai-capable sans plus an italic/serif editorial accent, calm motion that respects reduced-motion, WCAG AA.

## Evidence on Hand

None yet: no real shops, reviews, photos, or sales figures. Landing marquee and review content is placeholder and must be clearly replaced before launch; never present it as genuine.

## Product Principles

1. Physical truth beats visual flourish: if it shows a size, the size is real.
2. Useful before sign-up: planning, saving, and printing need no account.
3. Bilingual parity: Thai is a first-class language, not a translation afterthought.
4. Honest provenance: every measurement can be traced to a source or is marked unverified.

## Accessibility & Inclusion

WCAG AA contrast, keyboard-operable editor, visible focus states, alt text, prefers-reduced-motion respected.
