import { VISIBLE_LIBRARY } from "@/stickers/library";

/**
 * Serves each library sticker as a cacheable static SVG (`/stickers/<id>.svg`), so pages reference
 * a URL instead of inlining the same data-URL artwork many times.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return VISIBLE_LIBRARY.filter((s) => s.svg).map((s) => ({ file: `${s.id}.svg` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const def = VISIBLE_LIBRARY.find((s) => `${s.id}.svg` === file);
  if (!def?.svg) return new Response("Not found", { status: 404 });
  return new Response(def.svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
