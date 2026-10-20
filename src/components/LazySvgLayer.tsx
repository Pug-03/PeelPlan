"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * SVG `<image>` can't lazy-load natively, so this group renders its children only once its section
 * (or the owning `<svg>` outside a section) comes within `margin` of the viewport. Watching the section
 * rather than the svg means lids clipped off sideways in a running row still load before they slide in.
 */
export function LazySvgLayer({ children, margin = "600px" }: { children: ReactNode; margin?: string }) {
  const ref = useRef<SVGGElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const g = ref.current;
    const target = g?.closest("section") ?? g?.ownerSVGElement;
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: `${margin} 0px` },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [margin]);

  return <g ref={ref}>{shown ? children : null}</g>;
}
