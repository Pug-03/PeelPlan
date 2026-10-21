import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_ASSETS } from "@/config/demo";

/**
 * Demo-only character stickers (see src/stickers/sheets.ts). They are third-party artwork, so they live
 * outside public/ and this route answers 404 on any deploy where NEXT_PUBLIC_DEMO_ASSETS is off.
 */
/** Each file is content-addressed by name and never changes, like /stickers/<id>.svg. */
const FOREVER = "public, max-age=31536000, immutable";
/** A miss is deterministic per deploy (the flag is off, or the name is not ours): worth caching too. */
const MISS = "public, max-age=3600";
const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": MISS } });

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!DEMO_ASSETS || !/^[a-z]+-\d{2}\.png$/.test(file)) return notFound();
  try {
    const png = await readFile(path.join(process.cwd(), "demo-assets", "stickers", file));
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": FOREVER },
    });
  } catch {
    return notFound();
  }
}
