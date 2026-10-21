import type { PdfFontBytes } from "./exportPdf";

async function fetchBytes(url: URL): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Anuphan (Thai + Latin) for the PDF. The bundler emits the TTFs as static assets from these
 * `new URL(…, import.meta.url)` references. Resolves to null if they can't be loaded, so the
 * export can still fall back to the built-in ASCII font.
 */
export async function loadPdfFonts(): Promise<PdfFontBytes | null> {
  try {
    const [regular, bold] = await Promise.all([
      fetchBytes(new URL("./fonts/Anuphan-Medium.ttf", import.meta.url)),
      fetchBytes(new URL("./fonts/Anuphan-Bold.ttf", import.meta.url)),
    ]);
    return { regular, bold };
  } catch {
    return null;
  }
}
