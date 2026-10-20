"use client";

import Konva from "konva";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KImage, Layer, Line, Path, Rect, Stage, Text, Transformer } from "react-konva";
import useImage from "use-image";
import { useShallow } from "zustand/react/shallow";
import { DEMO_ASSETS, LOGO_PATH, logoTransform } from "@/config/demo";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { boundingBox, corners } from "@/lib/geometry";
import type { LayoutItem } from "@/lib/layout";
import { DEFAULT_LIGHT, flatStops, lidLighting, type Light, type Radial } from "@/lib/lighting";
import { fitPxPerMm, roundMm } from "@/lib/scale";
import { computeSnap, type Box, type Guide } from "@/lib/snap";
import { LOGO_CLEARANCE_MM, type LayoutWarnings } from "@/lib/warnings";
import { useEditor, useLiveReadout } from "../store";

/** Room around the lid for the mm rulers, in mm. */
export const STAGE_PAD_MM = 16;
const SNAP_PX = 6;
const ROTATION_SNAPS = Array.from({ length: 24 }, (_, i) => i * 15);
/** iOS Safari refuses canvases above ~16.7 M pixels; stay under it with headroom. */
const MAX_CANVAS_PIXELS = 14_000_000;

/** Lets the export dialog render the stage without prop drilling. Editing chrome is named "overlay" so exports can hide it. */
export const stageHandle: { stage: Konva.Stage | null; lidRectPx: { x: number; y: number; width: number; height: number }; pxPerMm: number } = {
  stage: null,
  lidRectPx: { x: 0, y: 0, width: 0, height: 0 },
  pxPerMm: 1,
};

const prefersReducedMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function scaledStops(r: Radial, alpha: number) {
  return flatStops(alpha === 1 ? r.stops : r.stops.map(([o, c]) => [o, c.replace(/,([\d.]+)\)$/, (_, a) => `,${Number(a) * alpha})`)] as [number, string]));
}

type StickerHandlers = {
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: () => void;
  register: (id: string, node: Konva.Image | null) => void;
};

/** One sticker. Memoised: re-renders only when its own item or image changes. */
const Sticker = memo(function Sticker({ item, src, h }: { item: LayoutItem; src?: string; h: StickerHandlers }) {
  const [img] = useImage(src ?? "", "anonymous");
  const finish = item.finish;
  return (
    <KImage
      ref={(n) => h.register(item.id, n)}
      id={item.id}
      name="sticker"
      image={img}
      x={item.xMm}
      y={item.yMm}
      width={item.widthMm}
      height={item.heightMm}
      offsetX={item.widthMm / 2}
      offsetY={item.heightMm / 2}
      rotation={item.rotationDeg}
      scaleX={item.flipX ? -1 : 1}
      draggable={!item.locked}
      opacity={finish === "transparent" ? 0.88 : 1}
      globalCompositeOperation={finish === "transparent" ? "multiply" : "source-over"}
      shadowColor="#000"
      shadowBlur={1.4}
      shadowOffsetY={0.5}
      shadowOpacity={finish === "glossy" ? 0.28 : 0.16}
      shadowEnabled={finish !== "transparent"}
      onMouseDown={h.onSelect}
      onTap={h.onSelect}
      onDragStart={h.onDragStart}
      onDragMove={h.onDragMove}
      onDragEnd={h.onDragEnd}
      perfectDrawEnabled={false}
    />
  );
});

/** Millimetre rulers along the top and left edges. Static per lid size. */
const Rulers = memo(function Rulers({ widthMm, heightMm, strokePx }: { widthMm: number; heightMm: number; strokePx: number }) {
  const ticks = useMemo(() => {
    const out: { pts: number[]; label?: string; lx?: number; ly?: number }[] = [];
    const len = (mm: number) => (mm % 50 === 0 ? 4 : mm % 10 === 0 ? 2.6 : 1.4);
    for (let mm = 0; mm <= widthMm; mm += 5)
      out.push({ pts: [mm, -2, mm, -2 - len(mm)], ...(mm % 50 === 0 ? { label: String(mm), lx: mm + 0.8, ly: -9.5 } : {}) });
    for (let mm = 0; mm <= heightMm; mm += 5)
      out.push({ pts: [-2, mm, -2 - len(mm), mm], ...(mm % 50 === 0 && mm > 0 ? { label: String(mm), lx: -14, ly: mm + 0.8 } : {}) });
    return out;
  }, [widthMm, heightMm]);
  return (
    <Group listening={false}>
      {ticks.map((t, i) => (
        <Group key={i}>
          <Line points={t.pts} stroke="#8a8a92" strokeWidth={strokePx} />
          {t.label && <Text x={t.lx} y={t.ly} text={t.label} fontSize={3.2} fill="#8a8a92" />}
        </Group>
      ))}
    </Group>
  );
});

const guidesKey = (g: Guide[]) => g.map((x) => (x.kind === "line" ? `${x.axis}${x.at.toFixed(2)}` : `g${x.axis}${x.a.toFixed(2)}`)).join("|");

export function LidStage({ warnings }: { warnings: LayoutWarnings }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const lidRef = useRef<Konva.Rect>(null);
  const specRef = useRef<Konva.Rect>(null);
  const specTopRef = useRef<Konva.Rect>(null);
  const logoRef = useRef<Konva.Path>(null);
  const nodes = useRef(new Map<string, Konva.Image>());
  const drag = useRef<{ start: Map<string, { x: number; y: number }>; others: Box[]; moving: LayoutItem[]; guides: string } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [shift, setShift] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const { modelId, colorId, keepLogoClear, items, assets, selectedIds, calibratedPxPerMm, viewMode, zoom } = useEditor(
    useShallow((s) => ({
      modelId: s.modelId,
      colorId: s.colorId,
      keepLogoClear: s.keepLogoClear,
      items: s.items,
      assets: s.assets,
      selectedIds: s.selectedIds,
      calibratedPxPerMm: s.calibratedPxPerMm,
      viewMode: s.viewMode,
      zoom: s.zoom,
    })),
  );
  const model = getLaptopModel(modelId);
  const lid = useMemo(() => lidGeometry(model), [model]);
  const lidColor = model.colors.find((c) => c.id === colorId)?.hex ?? model.colors[0].hex;
  const isDarkLid = parseInt(lidColor.slice(1, 3), 16) < 110;

  // Mirror changing values into refs so the stable handlers below always read fresh state.
  const live = useRef({ items, selectedIds, lid, k: 1, shift, ox: 0, oy: 0, lidColor, logoFinish: model.logoFinish });

  /* ---------- Lighting: animated imperatively, never through React state ---------- */
  const lightNow = useRef<Light>(DEFAULT_LIGHT);
  const lightTarget = useRef<Light>(DEFAULT_LIGHT);
  const lightRaf = useRef(0);
  // Render with the default light; paintLight() applies the live position imperatively.
  const initialLighting = lidLighting(lidColor, lid, DEFAULT_LIGHT, model.logoFinish);

  const paintLight = useCallback((light: Light) => {
    const { lidColor: color, lid: g } = live.current;
    const L = lidLighting(color, g, light, live.current.logoFinish);
    lidRef.current?.setAttrs({
      fillLinearGradientStartPoint: L.base.start,
      fillLinearGradientEndPoint: L.base.end,
      fillLinearGradientColorStops: flatStops(L.base.stops),
    });
    for (const [node, alpha] of [
      [specRef.current, 1],
      [specTopRef.current, 0.5],
    ] as const)
      node?.setAttrs({
        fillRadialGradientStartPoint: L.specular.center,
        fillRadialGradientEndPoint: L.specular.center,
        fillRadialGradientEndRadius: L.specular.radius,
        fillRadialGradientColorStops: scaledStops(L.specular, alpha),
      });
    logoRef.current?.setAttrs({
      fillLinearGradientStartPoint: L.logo.start,
      fillLinearGradientEndPoint: L.logo.end,
      fillLinearGradientColorStops: flatStops(L.logo.stops),
    });
    layerRef.current?.batchDraw();
  }, []);

  const aimLight = useCallback(
    (target: Light) => {
      if (prefersReducedMotion()) return;
      lightTarget.current = target;
      if (lightRaf.current) return;
      const step = () => {
        const c = lightNow.current;
        const t = lightTarget.current;
        const next = { u: c.u + (t.u - c.u) * 0.14, v: c.v + (t.v - c.v) * 0.14 };
        lightNow.current = next;
        paintLight(next);
        lightRaf.current = Math.abs(t.u - next.u) + Math.abs(t.v - next.v) > 0.002 ? requestAnimationFrame(step) : 0;
      };
      lightRaf.current = requestAnimationFrame(step);
    },
    [paintLight],
  );
  useEffect(() => () => cancelAnimationFrame(lightRaf.current), []);

  /* ---------- Layout ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === "Shift" && setShift(true);
    const up = (e: KeyboardEvent) => e.key === "Shift" && setShift(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const totalW = lid.widthMm + STAGE_PAD_MM * 2;
  const totalH = lid.heightMm + STAGE_PAD_MM * 2;
  const base = viewMode === "actual" && calibratedPxPerMm ? calibratedPxPerMm : fitPxPerMm(totalW, totalH, size, 8);
  const k = base * zoom;
  const stageW = Math.max(size.width, totalW * k);
  const stageH = Math.max(size.height, totalH * k);
  const ox = (stageW - totalW * k) / 2 + STAGE_PAD_MM * k;
  const oy = (stageH - totalH * k) / 2 + STAGE_PAD_MM * k;
  const strokePx = 1 / k;

  useEffect(() => {
    live.current = { items, selectedIds, lid, k, shift, ox, oy, lidColor, logoFinish: model.logoFinish };
    stageHandle.stage = stageRef.current;
    stageHandle.lidRectPx = { x: ox, y: oy, width: lid.widthMm * k, height: lid.heightMm * k };
    stageHandle.pxPerMm = k;
  });

  /* ---------- Pinch zoom (trackpad), anchored under the cursor ---------- */
  const zoomAnchor = useRef<{ mmX: number; mmY: number; cx: number; cy: number } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const zoomAt = (factor: number, clientX: number, clientY: number) => {
      const { k: kNow, ox: oxNow, oy: oyNow } = live.current;
      const r = el.getBoundingClientRect();
      const cx = clientX - r.left;
      const cy = clientY - r.top;
      zoomAnchor.current = { mmX: (el.scrollLeft + cx - oxNow) / kNow, mmY: (el.scrollTop + cy - oyNow) / kNow, cx, cy };
      const st = useEditor.getState();
      st.setZoom(st.zoom * factor);
    };
    // Chrome, Firefox and Edge report a trackpad pinch as a wheel event with ctrlKey set.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    // Safari sends its own gesture events instead.
    type Gesture = UIEvent & { scale: number; clientX: number; clientY: number };
    let last = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      last = 1;
    };
    const onGestureChange = (e: Event) => {
      const g = e as Gesture;
      e.preventDefault();
      zoomAt(g.scale / last, g.clientX, g.clientY);
      last = g.scale;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
  }, []);
  // After a pinch re-renders the stage, scroll so the point under the fingers stays put.
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const el = wrapRef.current;
    if (!a || !el) return;
    zoomAnchor.current = null;
    // Next frame: react-konva resizes the stage after this commit, and scrolling earlier gets clamped.
    const id = requestAnimationFrame(() => {
      el.scrollLeft = a.mmX * k + ox - a.cx;
      el.scrollTop = a.mmY * k + oy - a.cy;
    });
    return () => cancelAnimationFrame(id);
  }, [k, ox, oy]);

  // Keep the backing store under the iOS canvas limit when zoomed in on a big lid.
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const ratio = Math.min(dpr, Math.sqrt(MAX_CANVAS_PIXELS / (stageW * stageH)));
    const canvas = layerRef.current?.getCanvas();
    if (canvas && Math.abs(canvas.getPixelRatio() - ratio) > 0.01) {
      canvas.setPixelRatio(ratio);
      layerRef.current?.batchDraw();
    }
  }, [stageW, stageH]);

  // Repaint lighting when the lid itself changes (model, colour).
  useEffect(() => paintLight(lightNow.current), [lidColor, lid, paintLight]);

  // Attach the transformer to selected, unlocked stickers.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const sel = items
      .filter((i) => selectedIds.includes(i.id) && !i.locked)
      .map((i) => nodes.current.get(i.id))
      .filter(Boolean) as Konva.Image[];
    tr.nodes(sel);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, items]);

  // Pop-in for stickers that appear after the first paint (added, duplicated, redone).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const known = seen.current;
    seen.current = new Set(items.map((i) => i.id));
    if (!known || prefersReducedMotion()) return;
    for (const it of items) {
      if (known.has(it.id)) continue;
      const n = nodes.current.get(it.id);
      if (!n) continue;
      const sx = it.flipX ? -1 : 1;
      n.opacity(0);
      n.scale({ x: sx * 1.18, y: 1.18 });
      n.to({ opacity: it.finish === "transparent" ? 0.88 : 1, scaleX: sx, scaleY: 1, duration: 0.32, easing: Konva.Easings.BackEaseOut });
    }
  }, [items]);

  /* ---------- Stable sticker handlers (read state via refs) ---------- */
  const boxOf = (it: LayoutItem, x = it.xMm, y = it.yMm): Box => boundingBox(corners({ ...it, xMm: x, yMm: y }));

  const handlers = useMemo<StickerHandlers>(
    () => ({
      register: (id, n) => {
        if (n) nodes.current.set(id, n);
        else nodes.current.delete(id);
      },
      onSelect: (e) => {
        e.cancelBubble = true;
        const id = e.target.id();
        const { select, toggleSelect, selectedIds: sel } = useEditor.getState();
        const additive = "shiftKey" in e.evt && (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey);
        if (additive) toggleSelect(id);
        else if (!sel.includes(id)) select([id]);
      },
      onDragStart: (e) => {
        const id = e.target.id();
        const { items: all, selectedIds: sel } = live.current;
        setDragging(true);
        if (!sel.includes(id)) useEditor.getState().select([id]);
        // Locked stickers in a mixed selection stay where they are.
        const ids = new Set((sel.includes(id) ? sel : [id]).filter((sid) => !all.find((i) => i.id === sid)?.locked));
        ids.add(id);
        const moving = all.filter((i) => ids.has(i.id));
        drag.current = {
          start: new Map(moving.map((m) => [m.id, { x: m.xMm, y: m.yMm }])),
          others: all.filter((i) => !ids.has(i.id)).map((o) => boxOf(o)),
          moving,
          guides: "",
        };
      },
      onDragMove: (e) => {
        const d = drag.current;
        if (!d) return;
        const start = d.start.get(e.target.id());
        if (!start) return;
        const { lid: g, k: scale, shift: noSnap } = live.current;
        let dx = e.target.x() - start.x;
        let dy = e.target.y() - start.y;
        const union = d.moving
          .map((m) => boxOf(m, m.xMm + dx, m.yMm + dy))
          .reduce((a, b) => ({
            minX: Math.min(a.minX, b.minX),
            minY: Math.min(a.minY, b.minY),
            maxX: Math.max(a.maxX, b.maxX),
            maxY: Math.max(a.maxY, b.maxY),
          }));
        const snap = noSnap ? { dx: 0, dy: 0, guides: [] } : computeSnap(union, d.others, g, SNAP_PX / scale);
        dx += snap.dx;
        dy += snap.dy;
        const key = guidesKey(snap.guides);
        if (key !== d.guides) {
          d.guides = key;
          setGuides(snap.guides);
        }
        for (const [sid, p] of d.start) nodes.current.get(sid)?.position({ x: p.x + dx, y: p.y + dy });
      },
      onDragEnd: () => {
        const d = drag.current;
        setDragging(false);
        setGuides([]);
        if (!d) return;
        const pos = new Map([...d.start.keys()].map((sid) => [sid, nodes.current.get(sid)!.position()]));
        useEditor.getState().updateItems([...pos.keys()], (it) => ({ xMm: pos.get(it.id)!.x, yMm: pos.get(it.id)!.y }));
        drag.current = null;
      },
    }),
    [],
  );

  const onTransform = () => {
    const n = trRef.current?.nodes()[0];
    if (!n) return;
    useLiveReadout.getState().set({ w: n.width() * Math.abs(n.scaleX()), h: n.height() * Math.abs(n.scaleY()), r: n.rotation() });
  };

  const onTransformEnd = () => {
    const tr = trRef.current;
    if (!tr) return;
    const patch = new Map<string, Partial<LayoutItem>>();
    for (const n of tr.nodes() as Konva.Image[]) {
      const sx = Math.abs(n.scaleX());
      const sy = Math.abs(n.scaleY());
      const flip = n.scaleX() < 0;
      patch.set(n.id(), { widthMm: n.width() * sx, heightMm: n.height() * sy, xMm: n.x(), yMm: n.y(), rotationDeg: n.rotation(), flipX: flip });
      n.scale({ x: flip ? -1 : 1, y: 1 });
    }
    useEditor.getState().updateItems([...patch.keys()], (it) => patch.get(it.id)!);
    useLiveReadout.getState().set(null);
  };

  /* ---------- Marquee selection (mouse only; touch scrolls the view) ---------- */
  const finishMarquee = useCallback((m: { x0: number; y0: number; x1: number; y1: number }) => {
    const { ox: x0, oy: y0, k: scale, items: all } = live.current;
    const mm = (p: { x: number; y: number }) => ({ x: (p.x - x0) / scale, y: (p.y - y0) / scale });
    const a = mm({ x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1) });
    const b = mm({ x: Math.max(m.x0, m.x1), y: Math.max(m.y0, m.y1) });
    if (b.x - a.x > 1 || b.y - a.y > 1) {
      const hit = all.filter((it) => {
        const bb = boundingBox(corners(it));
        return bb.maxX > a.x && bb.minX < b.x && bb.maxY > a.y && bb.minY < b.y;
      });
      const sel = useEditor.getState().selectedIds;
      useEditor.getState().select([...new Set([...sel, ...hit.map((h) => h.id)])]);
    }
    setMarquee(null);
  }, []);
  // Releasing outside the canvas still ends the marquee.
  useEffect(() => {
    if (!marquee) return;
    // Finish outside the state updater: it updates the store, which must not happen during render.
    const up = () => finishMarquee(marquee);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [marquee, finishMarquee]);

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target.name() === "sticker" || e.target.getParent()?.className === "Transformer") return;
    const p = stageRef.current!.getPointerPosition()!;
    if (!e.evt.shiftKey) useEditor.getState().select([]);
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onStageMouseMove = () => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    if (!dragging) {
      // The hotspot leans towards the pointer rather than sitting under it.
      const u = Math.min(1.3, Math.max(-0.3, (pos.x - ox) / (lid.widthMm * k)));
      const v = Math.min(1.3, Math.max(-0.3, (pos.y - oy) / (lid.heightMm * k)));
      aimLight({ u: 0.5 + (u - 0.5) * 0.85, v: 0.5 + (v - 0.5) * 0.85 });
    }
    if (marquee) setMarquee({ ...marquee, x1: pos.x, y1: pos.y });
  };

  const warned = (id: string) => warnings.overlapping.has(id) || warnings.onLogo.has(id);
  const logoT = logoTransform(lid.logo);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-auto overscroll-contain">
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseLeave={() => aimLight(DEFAULT_LIGHT)}
        onTap={(e) => {
          if (e.target === e.target.getStage() || e.target.name() === "lid") useEditor.getState().select([]);
        }}
      >
        <Layer ref={layerRef}>
          <Group x={ox} y={oy} scaleX={k} scaleY={k}>
            <Rulers widthMm={lid.widthMm} heightMm={lid.heightMm} strokePx={strokePx} />
            <Rect
              ref={lidRef}
              name="lid"
              width={lid.widthMm}
              height={lid.heightMm}
              cornerRadius={lid.cornerRadiusMm}
              fillLinearGradientStartPoint={initialLighting.base.start}
              fillLinearGradientEndPoint={initialLighting.base.end}
              fillLinearGradientColorStops={flatStops(initialLighting.base.stops)}
              shadowColor="#000"
              shadowBlur={6}
              shadowOffsetY={2}
              shadowOpacity={0.18}
              stroke={initialLighting.rim}
              strokeWidth={0.6}
            />
            <Rect
              ref={specRef}
              listening={false}
              width={lid.widthMm}
              height={lid.heightMm}
              cornerRadius={lid.cornerRadiusMm}
              fillRadialGradientStartPoint={initialLighting.specular.center}
              fillRadialGradientEndPoint={initialLighting.specular.center}
              fillRadialGradientStartRadius={0}
              fillRadialGradientEndRadius={initialLighting.specular.radius}
              fillRadialGradientColorStops={scaledStops(initialLighting.specular, 1)}
            />
            {DEMO_ASSETS && (
              <Path
                ref={logoRef}
                listening={false}
                data={LOGO_PATH}
                x={logoT.x}
                y={logoT.y}
                scaleX={logoT.scale}
                scaleY={logoT.scale}
                fillLinearGradientStartPoint={initialLighting.logo.start}
                fillLinearGradientEndPoint={initialLighting.logo.end}
                fillLinearGradientColorStops={flatStops(initialLighting.logo.stops)}
                // Pale Air mirror needs a faint dark lip to read; black Pro gloss gets a light one.
                shadowColor={model.logoFinish === "mirror-light" || initialLighting.dark ? "#000" : "#fff"}
                shadowOpacity={model.logoFinish === "mirror-light" ? 0.22 : initialLighting.dark ? 0.35 : 0.6}
                shadowBlur={0.4}
                shadowOffsetY={model.logoFinish === "mirror-light" ? 0.15 : initialLighting.dark ? -0.15 : 0.2}
              />
            )}
            {/* The no-go box stands in for the logo; when the demo logo is drawn, it marks the zone itself. */}
            {keepLogoClear && !DEMO_ASSETS && (
              <Rect
                name="overlay"
                listening={false}
                x={lid.logo.x - lid.logo.width / 2 - LOGO_CLEARANCE_MM}
                y={lid.logo.y - lid.logo.height / 2 - LOGO_CLEARANCE_MM}
                width={lid.logo.width + 2 * LOGO_CLEARANCE_MM}
                height={lid.logo.height + 2 * LOGO_CLEARANCE_MM}
                cornerRadius={6}
                fill={isDarkLid ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}
                stroke={isDarkLid ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.28)"}
                strokeWidth={strokePx}
                dash={[4 / k, 4 / k]}
              />
            )}
            {items.map((it) => (
              <Sticker key={it.id} item={it} src={assets[it.assetId]?.src} h={handlers} />
            ))}
            {/* The same light falls on the stickers, at half strength. */}
            <Rect
              ref={specTopRef}
              listening={false}
              width={lid.widthMm}
              height={lid.heightMm}
              cornerRadius={lid.cornerRadiusMm}
              fillRadialGradientStartPoint={initialLighting.specular.center}
              fillRadialGradientEndPoint={initialLighting.specular.center}
              fillRadialGradientStartRadius={0}
              fillRadialGradientEndRadius={initialLighting.specular.radius}
              fillRadialGradientColorStops={scaledStops(initialLighting.specular, 0.5)}
            />
            {/* Overlap/logo warnings and locked markers */}
            {!dragging &&
              items.map((it) =>
                warned(it.id) || (it.locked && selectedIds.includes(it.id)) ? (
                  <Rect
                    key={`w-${it.id}`}
                    name="overlay"
                    listening={false}
                    x={it.xMm}
                    y={it.yMm}
                    width={it.widthMm + 2}
                    height={it.heightMm + 2}
                    offsetX={it.widthMm / 2 + 1}
                    offsetY={it.heightMm / 2 + 1}
                    rotation={it.rotationDeg}
                    stroke={warned(it.id) ? "#E5484D" : "#8a8a92"}
                    strokeWidth={1.5 * strokePx}
                    dash={[5 / k, 3 / k]}
                  />
                ) : null,
              )}
            {guides.map((g, i) =>
              g.kind === "line" ? (
                <Line
                  key={i}
                  name="overlay"
                  listening={false}
                  points={g.axis === "x" ? [g.at, g.from - 4, g.at, g.to + 4] : [g.from - 4, g.at, g.to + 4, g.at]}
                  stroke="#2F5BFF"
                  strokeWidth={strokePx}
                  dash={[3 / k, 3 / k]}
                />
              ) : (
                <Group key={i} name="overlay" listening={false}>
                  <Line points={g.axis === "x" ? [g.a, g.cross, g.b, g.cross] : [g.cross, g.a, g.cross, g.b]} stroke="#2F5BFF" strokeWidth={strokePx} />
                  <Text
                    x={g.axis === "x" ? (g.a + g.b) / 2 - 6 : g.cross + 1.5}
                    y={g.axis === "x" ? g.cross - 5 : (g.a + g.b) / 2 - 1.5}
                    text={`${roundMm(g.gapMm)} mm`}
                    fontSize={3}
                    fill="#2F5BFF"
                  />
                </Group>
              ),
            )}
          </Group>
          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            rotationSnaps={shift ? ROTATION_SNAPS : []}
            rotationSnapTolerance={8}
            anchorSize={14}
            anchorCornerRadius={7}
            anchorStroke="#111"
            anchorFill="#fff"
            borderStroke="#111"
            borderDash={[4, 3]}
            rotateAnchorOffset={28}
            padding={4}
            flipEnabled={false}
            boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 5 * k || Math.abs(newBox.height) < 5 * k ? oldBox : newBox)}
            onTransform={onTransform}
            onTransformEnd={onTransformEnd}
          />
          {marquee && (
            <Rect
              name="overlay"
              listening={false}
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(47,91,255,0.08)"
              stroke="#2F5BFF"
              strokeWidth={1}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
