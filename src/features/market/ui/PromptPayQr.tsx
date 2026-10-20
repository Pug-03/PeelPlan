"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { normalizePromptPayId, promptPayPayload } from "../promptpay";

/**
 * PromptPay QR for an exact amount. Renders nothing for an invalid ID.
 * `example` shops get a crossed-out placeholder instead: they must never show a payable code.
 */
export function PromptPayQr({ id, amountThb, size = 220, example = false, label }: { id?: string; amountThb?: number; size?: number; example?: boolean; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const valid = !example && !!id && !!normalizePromptPayId(id);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    QRCode.toString(promptPayPayload(id!, amountThb), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }).then(
      (s) => alive && setSvg(s),
      () => alive && setSvg(null),
    );
    return () => {
      alive = false;
    };
  }, [valid, id, amountThb]);

  if (!valid) {
    return (
      <div
        role="img"
        aria-label={label}
        className="grid place-items-center rounded-2xl border border-dashed border-hairline bg-surface p-4 text-center text-xs text-muted"
        style={{ width: size, height: size }}
      >
        {label}
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={label}
      className="rounded-2xl bg-white p-2 shadow-soft [&_svg]:h-full [&_svg]:w-full"
      style={{ width: size, height: size }}
      // The SVG comes from the qrcode library, built from digits and a fixed AID only.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
