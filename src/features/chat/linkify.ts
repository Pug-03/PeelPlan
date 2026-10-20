/** Split chat text into plain text and http(s) links, so links can be rendered as React elements (never HTML). */
export type Segment = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
/** Punctuation that usually ends a sentence rather than the URL. */
const TRAILING = /[.,;:!?)\]}'"…]+$/;

export function linkify(input: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of input.matchAll(URL_RE)) {
    let raw = m[0];
    const trail = raw.match(TRAILING)?.[0] ?? "";
    if (trail) raw = raw.slice(0, -trail.length);
    const start = m.index;
    let href: string;
    try {
      const u = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      href = u.href;
    } catch {
      continue;
    }
    if (start > last) out.push({ kind: "text", text: input.slice(last, start) });
    out.push({ kind: "link", text: raw, href });
    last = start + raw.length;
  }
  if (last < input.length) out.push({ kind: "text", text: input.slice(last) });
  return out;
}
