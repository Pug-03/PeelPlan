"use client";

import { ArrowRight, MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** Compact "found a problem?" row for page bottoms; the form itself lives on /feedback. */
export function FeedbackLink({ className = "" }: { className?: string }) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-ink">{t("title")}</p>
          <p className="max-w-[52ch] text-sm leading-relaxed text-muted">{t("linkBody")}</p>
        </div>
      </div>
      <Link
        href={{ pathname: "/feedback", query: { from: pathname } }}
        className="group inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border border-hairline bg-bg px-5 text-sm font-medium text-ink transition-colors hover:border-ink sm:self-auto"
      >
        {t("cta")}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}
