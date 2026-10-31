"use client";

import { useEffect } from "react";

/** How fast the light's head travels along a pricing card's edge, in px per second. */
const SPEED = 680;
/** Keyframe samples per lap: enough that the eased angle reads as one smooth curve. */
const STEPS = 72;
/** The gradient's bright head sits this far round from its start angle (~97% of the turn). */
const HEAD = 349;

/**
 * The pricing cards' running light is a conic gradient, and a gradient sweeps by angle: on a wide card
 * equal angles cover very different lengths of edge, so the light raced round the corners and crawled
 * along the long sides. This measures each `.price-card` and writes keyframes that move the start angle
 * so the head covers equal lengths of edge in equal time, plus a lap duration in proportion to the
 * perimeter, so every card runs at the same pace. Re-measured when a card changes size.
 */
export function PriceRunPace() {
  useEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>(".price-card")];
    if (!cards.length) return;
    const sheet = document.createElement("style");
    document.head.append(sheet);
    const rules = new Map<HTMLElement, string>();

    const pace = (card: HTMLElement, i: number) => {
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      if (!w || !h) return;
      const per = 2 * (w + h);
      // Walk the edge clockwise from the top centre; record the angle (0 = up, clockwise) at each step.
      const pointAt = (d: number): [number, number] => {
        const half = w / 2;
        d = ((d % per) + per) % per;
        if (d < half) return [d, -h / 2];
        d -= half;
        if (d < h) return [w / 2, -h / 2 + d];
        d -= h;
        if (d < w) return [w / 2 - d, h / 2];
        d -= w;
        if (d < h) return [-w / 2, h / 2 - d];
        d -= h;
        return [-w / 2 + d, -h / 2];
      };
      let prev = 0;
      let turns = 0;
      const frames: string[] = [];
      for (let k = 0; k <= STEPS; k++) {
        const [x, y] = pointAt((k / STEPS) * per);
        let a = (Math.atan2(x, -y) * 180) / Math.PI; // -180..180, 0 = up, clockwise
        if (a < 0) a += 360;
        if (k > 0 && a < prev - 180) turns++;
        prev = a;
        const head = k === STEPS ? 360 : a + turns * 360;
        frames.push(`${((k / STEPS) * 100).toFixed(3)}%{--price-run:${(head - HEAD).toFixed(2)}deg}`);
      }
      const name = `price-run-${i}`;
      rules.set(card, `@keyframes ${name}{${frames.join("")}}`);
      card.style.setProperty("--price-kf", name);
      card.style.setProperty("--price-dur", `${(per / SPEED).toFixed(2)}s`);
    };

    const write = () => (sheet.textContent = [...rules.values()].join("\n"));
    cards.forEach(pace);
    write();
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) pace(e.target as HTMLElement, cards.indexOf(e.target as HTMLElement));
      write();
    });
    cards.forEach((c) => ro.observe(c));
    return () => {
      ro.disconnect();
      sheet.remove();
      cards.forEach((c) => {
        c.style.removeProperty("--price-kf");
        c.style.removeProperty("--price-dur");
      });
    };
  }, []);
  return null;
}
