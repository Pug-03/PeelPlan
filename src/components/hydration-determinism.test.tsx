/**
 * Safari hydration guard. ECMA-262 leaves the last bits of Math.hypot/sin/cos/exp/... to the engine, so V8 (SSR)
 * and JavaScriptCore (Safari) can stringify the same maths differently and React refuses to hydrate.
 * We re-render with each of those functions nudged by one ulp (what another engine might return): the markup must not move.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// sqrt, abs, floor, round, min, max and + - * / are exact on every engine and stay untouched.
const ENGINE_MATH = ["hypot", "sin", "cos", "tan", "atan", "atan2", "asin", "acos", "exp", "expm1", "log", "log1p", "log2", "log10", "pow", "cbrt", "sinh", "cosh", "tanh"] as const;

const view = new DataView(new ArrayBuffer(8));
const nudge = (x: number, dir: 1 | -1) => {
  if (!Number.isFinite(x) || x === 0) return x;
  view.setFloat64(0, x);
  view.setBigInt64(0, view.getBigInt64(0) + BigInt(x > 0 ? dir : -dir));
  return view.getFloat64(0);
};

async function withNudgedMath<T>(dir: 1 | -1, fn: () => Promise<T>) {
  const m = Math as unknown as Record<string, (...a: number[]) => number>;
  const saved = ENGINE_MATH.map((k) => [k, m[k]] as const);
  for (const [k, f] of saved) m[k] = (...a) => nudge(f(...a), dir);
  try {
    return await fn();
  } finally {
    for (const [k, f] of saved) m[k] = f;
  }
}

/** Fresh module graph per run, so module-level constants (GLOSS_DIR) are recomputed under the nudged Math too. */
async function renderAll() {
  vi.resetModules();
  const { LidArt } = await import("@/components/LidArt");
  const { PeelScene } = await import("@/components/landing/PeelScene");
  const { ALL_MODELS, lidGeometry } = await import("@/config/laptops");
  const lids = ALL_MODELS.flatMap((m) => {
    const g = lidGeometry(m);
    return m.colors.map((c) =>
      renderToStaticMarkup(
        <LidArt widthMm={g.widthMm} heightMm={g.heightMm} radiusMm={g.cornerRadiusMm} color={c.hex} logo={g.logo} logoFinish={m.logoFinish} camera={g.camera} stickers={[]} />,
      ),
    );
  });
  return [...lids, renderToStaticMarkup(<PeelScene title="t" titleB="t" body="b" peelLabel="p" />)];
}

/** The first differing stretch, so a failure names the attribute instead of dumping two SVGs. */
const around = (s: string, k: number) => s.slice(Math.max(0, k - 60), k + 40);

describe("SSR markup is identical on every JS engine", () => {
  it.each([1, -1] as const)("survives Math results one ulp %s", async (dir) => {
    const base = await renderAll();
    const nudged = await withNudgedMath(dir, renderAll);
    expect(base.length).toBeGreaterThan(10);
    nudged.forEach((html, i) => {
      let k = 0;
      while (k < html.length && html[k] === base[i][k]) k++;
      expect(around(html, k), `render #${i}`).toBe(around(base[i], k));
    });
  });
});
