"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { CSS_PX_PER_MM, ID1_CARD_MM, pxPerMmFromReference } from "@/lib/scale";
import { saveCalibration } from "../persist";
import { useEditor } from "../store";
import { Button } from "./controls";
import { Dialog } from "./Dialog";

export function CalibrateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("calibrate");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} wide closeLabel={t("cancel")}>
      <CalibrateBody onClose={onClose} />
    </Dialog>
  );
}

/** Mounted fresh on every open, so the slider starts from the saved calibration. */
function CalibrateBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("calibrate");
  const { calibratedPxPerMm, setCalibration } = useEditor();
  const [widthPx, setWidthPx] = useState(() => (calibratedPxPerMm ?? CSS_PX_PER_MM) * ID1_CARD_MM.width);
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const heightPx = widthPx * (ID1_CARD_MM.height / ID1_CARD_MM.width);
  const pxPerMm = pxPerMmFromReference(widthPx);

  return (
    <>
      <p className="max-w-[60ch] text-sm leading-relaxed text-muted">{t("body")}</p>
      <div className="mt-6 overflow-x-auto pb-2">
        <div className="relative" style={{ width: widthPx + 40, height: heightPx + 8 }}>
          {/* Card outline: top-left corner is the anchor so the user can butt the card against it. */}
          <div
            className="absolute top-0 left-0 rounded-[3.18mm] border-2 border-accent bg-accent-soft"
            style={{ width: widthPx, height: heightPx, borderRadius: pxPerMm * 3.18 }}
          >
            <span className="absolute bottom-3 left-4 text-xs text-muted">{t("cardLabel")}</span>
            <span className="absolute top-3 left-4 h-[22%] w-[16%] rounded-md bg-hairline" aria-hidden="true" />
          </div>
          <button
            type="button"
            aria-label={t("slider")}
            className="absolute top-1/2 grid h-14 w-8 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full border border-hairline bg-bg shadow-soft"
            style={{ left: widthPx - 16 }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { startX: e.clientX, startW: widthPx };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setWidthPx(Math.min(1200, Math.max(120, drag.current.startW + e.clientX - drag.current.startX)));
            }}
            onPointerUp={() => (drag.current = null)}
            // A system gesture or lost capture would otherwise leave the handle following the finger.
            onPointerCancel={() => (drag.current = null)}
            onLostPointerCapture={() => (drag.current = null)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 5 : 0.5;
              if (e.key === "ArrowRight") setWidthPx((w) => Math.min(1200, w + step));
              if (e.key === "ArrowLeft") setWidthPx((w) => Math.max(120, w - step));
            }}
          >
            <span className="h-6 w-1 rounded-full bg-ink/40" />
          </button>
        </div>
      </div>
      <label className="mt-5 flex flex-col gap-2 text-sm">
        <span className="flex justify-between text-muted">
          <span>{t("slider")}</span>
          <span className="tabular-nums">{t("result", { value: pxPerMm.toFixed(3) })}</span>
        </span>
        <input
          type="range"
          min={120}
          max={1200}
          step={0.25}
          value={widthPx}
          onChange={(e) => setWidthPx(Number(e.target.value))}
          className="accent-[var(--accent)]"
        />
      </label>
      <p className="mt-4 text-xs text-muted">{t("hint")}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {calibratedPxPerMm && (
          <Button
            variant="ghost"
            onClick={() => {
              saveCalibration(null);
              setCalibration(null);
              onClose();
            }}
          >
            {t("reset")}
          </Button>
        )}
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button
          variant="dark"
          onClick={() => {
            saveCalibration(pxPerMm);
            setCalibration(pxPerMm);
            onClose();
          }}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}
