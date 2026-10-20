"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TEST_MODE } from "@/features/market/store";
import { Modal } from "./Modal";

const REASONS = ["scam", "spam", "harassment", "inappropriate", "other"] as const;
type Reason = (typeof REASONS)[number];
const KEY = "peelplan.reports.v1";

export type ChatReport = { id: string; threadId: string; reporterId: string; side: "buyer" | "shop"; reason: Reason; note: string; at: string };

/** No reports backend yet: reports are kept on this device (test mode) so the flow can be tried end to end. */
function saveReport(r: ChatReport) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]") as ChatReport[];
    localStorage.setItem(KEY, JSON.stringify([...list, r].slice(-100)));
  } catch {
    /* storage unavailable: the confirmation still shows */
  }
}

export function ReportDialog({ open, onClose, threadId, reporterId, side }: { open: boolean; onClose: () => void; threadId: string; reporterId: string; side: "buyer" | "shop" }) {
  const t = useTranslations("chat.report");
  const [reason, setReason] = useState<Reason>("scam");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const close = () => {
    onClose();
    setDone(false);
    setNote("");
    setReason("scam");
  };

  return (
    <Modal open={open} onClose={close} label={t("title")} closeLabel={t("close")}>
      {done ? (
        <div className="flex flex-col items-start gap-3" role="status">
          <CheckCircle2 className="size-8" strokeWidth={1.75} aria-hidden="true" />
          <h2 className="text-lg font-semibold">{t("doneTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted">{t("doneBody")}</p>
          {TEST_MODE && <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-muted">{t("testNote")}</p>}
          <button type="button" onClick={close} className="mt-2 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">
            {t("close")}
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveReport({ id: crypto.randomUUID(), threadId, reporterId, side, reason, note: note.trim().slice(0, 1000), at: new Date().toISOString() });
            setDone(true);
          }}
        >
          <div className="pr-10">
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t("intro")}</p>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">{t("reasonLabel")}</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-hairline px-3 py-2.5 text-sm has-checked:border-ink has-checked:bg-surface">
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--text)]" />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("noteLabel")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t("notePlaceholder")}
              className="resize-none rounded-xl border border-hairline bg-surface px-3 py-2 text-base font-normal placeholder:text-muted"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="h-10 rounded-full px-4 text-sm font-medium text-muted hover:bg-surface hover:text-ink">
              {t("cancel")}
            </button>
            <button type="submit" className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">
              {t("submit")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
