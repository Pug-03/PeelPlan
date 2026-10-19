"use client";

import { Download, FileText, ImageIcon, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getLaptopModel, lidGeometry } from "@/config/laptops";
import { downloadBlob } from "@/lib/image/browser";
import { coordinateRows, csvCell } from "@/lib/layout";
import type { PdfMode } from "@/lib/pdf/exportPdf";
import { roundMm } from "@/lib/scale";
import { useEditor } from "../store";
import { Button, Segmented, Toggle } from "./controls";
import { Dialog } from "./Dialog";
import { stageHandle } from "./LidStage";

/** PNG export density; independent of screen calibration. */
const PNG_PX_PER_MM = 8;

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("export");
  const locale = useLocale();
  // Always mounted: subscribe only to what the export needs, not every zoom or selection change.
  const { modelId, items, assets, select } = useEditor(useShallow((s) => ({ modelId: s.modelId, items: s.items, assets: s.assets, select: s.select })));
  const [paper, setPaper] = useState<"a4" | "letter">(locale === "en" ? "letter" : "a4");
  const [mode, setMode] = useState<PdfMode>("guide");
  const [images, setImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const model = getLaptopModel(modelId);
  const rows = coordinateRows(items);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportPdf = async () => {
    setBusy(true);
    setError(false);
    try {
      const { exportLayoutPdf } = await import("@/lib/pdf/exportPdf");
      const bytes = await exportLayoutPdf({ modelName: model.name, ...lidGeometry(model) }, items, assets, { paper, mode, includeImages: images });
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `peelplan-${model.id}-${mode}-${stamp}.pdf`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const exportPng = () => {
    const stage = stageHandle.stage;
    if (!stage) return;
    select([]);
    // Wait a frame so the transformer is detached before rendering.
    requestAnimationFrame(() => {
      const r = stageHandle.lidRectPx;
      const url = stage.toDataURL({ x: r.x, y: r.y, width: r.width, height: r.height, pixelRatio: PNG_PX_PER_MM / stageHandle.pxPerMm, mimeType: "image/png" });
      fetch(url)
        .then((res) => res.blob())
        .then((b) => downloadBlob(b, `peelplan-${model.id}-${stamp}.png`));
    });
  };

  const exportCsv = () => {
    const header = ["#", "name", "x_mm_from_left", "y_mm_from_top", "width_mm", "height_mm", "rotation_deg", "flipped"];
    const lines = rows.map((r) =>
      [r.index, r.label, roundMm(r.xMm), roundMm(r.yMm), roundMm(r.widthMm), roundMm(r.heightMm), roundMm(r.rotationDeg), r.flipped].map(csvCell).join(","),
    );
    downloadBlob(new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }), `peelplan-coordinates-${stamp}.csv`);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("title")} wide closeLabel={t("close")}>
      {!items.length ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          <section className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h3 className="font-semibold">{t("pdf")}</h3>
                <p className="text-sm text-muted">{t("pdfBody")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">{t("paper")}</span>
              <Segmented
                label={t("paper")}
                value={paper}
                onChange={setPaper}
                options={[
                  { value: "a4", label: t("a4") },
                  { value: "letter", label: t("letter") },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">{t("mode")}</span>
              <Segmented
                label={t("mode")}
                value={mode}
                onChange={setMode}
                options={[
                  { value: "guide", label: t("guide") },
                  { value: "template", label: t("template") },
                ]}
              />
              {mode === "template" && <p className="text-xs leading-relaxed text-muted">{t("templateHint")}</p>}
            </div>
            {mode === "guide" && <Toggle checked={images} onChange={setImages} label={t("images")} />}
            <p className="flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {t("printWarning")}
            </p>
            <Button variant="dark" onClick={exportPdf} disabled={busy}>
              <Download className="size-4" strokeWidth={2} aria-hidden="true" />
              {busy ? t("working") : t("download")}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-[#C62F35]">
                {t("failed")}
              </p>
            )}

            <div className="mt-2 flex items-start gap-3 border-t border-hairline pt-5">
              <ImageIcon className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex-1">
                <h3 className="font-semibold">{t("png")}</h3>
                <p className="text-sm text-muted">{t("pngBody")}</p>
              </div>
              <Button onClick={exportPng}>{t("downloadPng")}</Button>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{t("coordinates")}</h3>
                <p className="text-sm text-muted">{t("coordinatesBody")}</p>
              </div>
              <Button variant="ghost" onClick={exportCsv} className="shrink-0">
                {t("csv")}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    {[t("colIndex"), t("colName"), t("colX"), t("colY"), t("colSize"), t("colRot")].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((r) => (
                    <tr key={r.index}>
                      <td className="px-3 py-2 text-muted">{r.index}</td>
                      <td className="max-w-[9rem] truncate px-3 py-2">{r.label}</td>
                      <td className="px-3 py-2">{roundMm(r.xMm)}</td>
                      <td className="px-3 py-2">{roundMm(r.yMm)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {roundMm(r.widthMm)} × {roundMm(r.heightMm)}
                      </td>
                      <td className="px-3 py-2">{roundMm(r.rotationDeg)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}
