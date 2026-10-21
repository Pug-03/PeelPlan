"use client";

import { Download, FileText, ImageDown, ImageIcon, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getLaptopModel, hasEstimatedGeometry, lidGeometry } from "@/config/laptops";
import { downloadBlob } from "@/lib/image/browser";
import { coordinateRows, csvCell } from "@/lib/layout";
import type { PdfMode, PdfText } from "@/lib/pdf/exportPdf";
import { roundMm } from "@/lib/scale";
import { useEditor } from "../store";
import { Button, Segmented, Toggle } from "./controls";
import { Dialog } from "./Dialog";
import { stageHandle } from "./LidStage";
import { renderLid, saveShareImage } from "./shareCard";

/** PNG export density; independent of screen calibration. */
const PNG_PX_PER_MM = 8;

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("export");
  const te = useTranslations("editor");
  // Always mounted: subscribe only to what the export needs, not every zoom or selection change.
  const { modelId, colorId, items, assets } = useEditor(useShallow((s) => ({ modelId: s.modelId, colorId: s.colorId, items: s.items, assets: s.assets })));
  // A4 everywhere: English is also the language of English-speaking Thailand, and Letter paper is
  // the exception, not the default for a locale.
  const [paper, setPaper] = useState<"a4" | "letter">("a4");
  const [mode, setMode] = useState<PdfMode>("guide");
  const [images, setImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  const model = getLaptopModel(modelId);
  const rows = coordinateRows(items);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportPdf = async () => {
    setBusy(true);
    setError(false);
    setSkipped(0);
    try {
      const [{ exportLayoutPdf }, { loadPdfFonts }] = await Promise.all([import("@/lib/pdf/exportPdf"), import("@/lib/pdf/fonts")]);
      // The Thai-capable font carries the localised copy; if it fails to load the PDF falls back to ASCII English.
      const fonts = await loadPdfFonts();
      const text: PdfText = {
        coverTitle: t("doc.coverTitle"),
        coverSummary: (v) => t("doc.coverSummary", v),
        beforePrint: t("doc.beforePrint"),
        stepScale: t("doc.stepScale"),
        stepPaper: (v) => t("doc.stepPaper", v),
        stepMeasure: t("doc.stepMeasure"),
        stepJoin: t("doc.stepJoin"),
        paperA4: t("a4"),
        paperLetter: t("letter"),
        landscape: t("doc.landscape"),
        square: t("doc.square"),
        mm: t("doc.mm"),
        rulerNote: t("doc.rulerNote"),
        hingeNote: (model) => t("doc.hingeNote", { model }),
        sheetFooter: (v) => t("doc.sheetFooter", v),
        templateNote: t("doc.templateNote"),
        coordTitle: t("doc.coordTitle"),
        colIndex: t("colIndex"),
        colName: t("colName"),
        colX: t("doc.colX"),
        colY: t("doc.colY"),
        colSize: t("doc.colSize"),
        colRotation: t("doc.colRotation"),
        rotationCw: (deg) => t("doc.rotationCw", { deg }),
        flipped: t("doc.flipped"),
        estimateNote: t("doc.estimateNote"),
      };
      const unreadable = new Set<string>();
      const bytes = await exportLayoutPdf({ modelName: model.name, ...lidGeometry(model), estimated: hasEstimatedGeometry(model) }, items, assets, {
        paper,
        mode,
        includeImages: images,
        text,
        fonts,
        onSkippedAsset: (id) => unreadable.add(id),
      });
      setSkipped(items.filter((i) => unreadable.has(i.assetId)).length);
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `peelplan-${model.id}-${mode}-${stamp}.pdf`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const exportPng = () => {
    // Selection, warnings and guides are hidden for the render; the layout itself is untouched.
    renderLid(PNG_PX_PER_MM / stageHandle.pxPerMm)?.toBlob((b) => b && downloadBlob(b, `peelplan-${model.id}-${stamp}.png`), "image/png");
  };

  const saveImage = async () => {
    setImageBusy(true);
    setImageError(false);
    setImageError(!(await saveShareImage(model, colorId)));
    setImageBusy(false);
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
            {hasEstimatedGeometry(model) && <p className="text-xs leading-relaxed text-muted">{te("estimateNote")}</p>}
            <Button variant="dark" onClick={exportPdf} disabled={busy}>
              <Download className="size-4" strokeWidth={2} aria-hidden="true" />
              {busy ? t("working") : t("download")}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-[#C62F35]">
                {t("failed")}
              </p>
            )}
            {skipped > 0 && (
              <p role="status" className="text-sm text-[#C62F35]">
                {t("skippedAssets", { count: skipped })}
              </p>
            )}

            <div className="mt-2 flex flex-col gap-3 border-t border-hairline pt-5">
              <div className="flex items-start gap-3">
                <ImageIcon className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <div className="flex-1">
                  <h3 className="font-semibold">{te("saveImage")}</h3>
                  <p className="text-sm text-muted">{te("saveImageBody")}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={saveImage} disabled={imageBusy}>
                  <ImageDown className="size-4" strokeWidth={2} aria-hidden="true" />
                  {imageBusy ? te("savingImage") : te("saveImage")}
                </Button>
                <Button variant="ghost" onClick={exportPng}>
                  {te("lidOnlyPng")}
                </Button>
              </div>
              {imageError && (
                <p role="alert" className="text-sm text-[#C62F35]">
                  {te("saveImageFailed")}
                </p>
              )}
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
