"use client";

import { ArrowLeft, ArrowUp, Flag, ImagePlus, Package, ShieldCheck, Store, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fileToDataUrl, getStore, useMarketQuery } from "@/features/market/store";
import { LoadError } from "@/features/market/ui/buyer";
import type { Message, Order } from "@/features/market/types";
import { Link } from "@/i18n/navigation";
import type { Session } from "@/lib/session";
import { baht, dayKey, dayLabel, timeOfDay } from "./format";
import { Avatar, type Side } from "./Inbox";
import { linkify } from "./linkify";
import { Modal } from "./Modal";
import { ReportDialog } from "./ReportDialog";

const MAX = 2000;

function useConversation(id: string, userId: string) {
  return useMarketQuery(
    async (s) => {
      const thread = await s.getThread(id);
      if (!thread) return { thread: null } as const;
      const [shop, mine] = await Promise.all([s.getShopById(thread.shopId), s.myShop(userId)]);
      const side: Side | null = thread.buyerId === userId ? "buyer" : mine && mine.id === thread.shopId ? "shop" : null;
      if (!side) return { thread: null } as const;
      const messages = await s.messages(id);
      // Orders between this buyer and this shop, for the picker and for rendering order cards.
      const pairOrders = (side === "buyer" ? await s.buyerOrders(userId) : await s.shopOrders(thread.shopId))
        .filter((o) => o.shopId === thread.shopId && o.buyerId === thread.buyerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const orders = new Map<string, Order>(pairOrders.map((o) => [o.id, o]));
      for (const oid of new Set(messages.flatMap((m) => (m.orderId && !orders.has(m.orderId) ? [m.orderId] : [])))) {
        const o = await s.getOrder(oid);
        if (o) orders.set(oid, o);
      }
      return { thread, shop, side, messages, pairOrders, orders } as const;
    },
    [id, userId],
  );
}

function MessageText({ text }: { text: string }) {
  return (
    <p className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">
      {linkify(text).map((seg, i) =>
        seg.kind === "link" ? (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 break-all">
            {seg.text}
          </a>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </p>
  );
}

function OrderCard({ order, mine }: { order: Order | undefined; mine: boolean }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  if (!order)
    return (
      <span className="flex items-center gap-2 rounded-xl border border-hairline bg-bg px-3 py-2 text-sm text-muted">
        <Package className="size-4" strokeWidth={1.75} aria-hidden="true" />
        {t("order.missing")}
      </span>
    );
  return (
    <Link
      href={`/orders/${order.id}`}
      className={`flex min-w-56 items-center gap-3 rounded-xl border px-3 py-2.5 text-ink transition-colors ${mine ? "border-transparent bg-bg" : "border-hairline bg-bg hover:bg-surface-2"}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface" aria-hidden="true">
        <Package className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{t("order.label", { code: order.code })}</span>
        <span className="text-xs text-muted">
          {t("order.total", { total: baht(order.totalThb, locale) })} · {t(`status.${order.status}`)}
        </span>
        <span className="text-xs underline underline-offset-2">{t("order.open")}</span>
      </span>
    </Link>
  );
}

export function Conversation({ id, session }: { id: string; session: Session }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { data, error: loadError, retry } = useConversation(id, session.user.id);

  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ready = data && data.thread ? data : null;
  const count = ready?.messages.length ?? 0;
  const side = ready?.side;
  const unread = ready ? (ready.side === "buyer" ? ready.thread.unreadBuyer : ready.thread.unreadShop) : 0;

  // Stick to the newest message. Photos load after the first paint and push the list down, so
  // follow each one as it loads, unless the reader has scrolled up meanwhile.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    let pinned = true;
    const onScroll = () => {
      pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    };
    const onLoad = () => {
      if (pinned) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // `load` doesn't bubble; capture it from every <img> in the list.
    el.addEventListener("load", onLoad, true);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("load", onLoad, true);
    };
  }, [count]);

  // Opening the chat, or a message arriving while it is open, marks it read.
  useEffect(() => {
    if (!side || unread === 0) return;
    void getStore().then((s) => s.markRead(id, side));
  }, [id, side, unread]);

  // A new conversation starts with the cursor in the box.
  useEffect(() => {
    if (side) inputRef.current?.focus({ preventScroll: true });
  }, [id, side]);

  if (data === undefined && loadError)
    return (
      <div className="flex flex-1 flex-col p-6">
        <LoadError onRetry={retry} />
      </div>
    );
  if (data === undefined) return <div className="flex-1" aria-busy="true" />;
  if (!ready)
    return (
      <div className="flex flex-1 flex-col items-start gap-3 p-6">
        <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
        <p className="text-muted">{t("notFound.body")}</p>
        <Link href="/messages" className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">
          {t("notFound.back")}
        </Link>
      </div>
    );

  const { thread, shop, messages, pairOrders, orders } = ready;
  const role = ready.side;
  const otherName = role === "buyer" ? (shop?.name ?? "…") : thread.buyerName;

  /** `report` shows the error where the person is looking: the composer, or the open order picker. */
  const send = async (body: { text?: string; image?: string; orderId?: string }, report: (msg: string | null) => void = setError) => {
    setSending(true);
    report(null);
    try {
      const s = await getStore();
      await s.send(thread.id, role, body);
      return true;
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      report(code === "storage-full" ? t("composer.full") : code === "rate-limited" ? t("composer.rateLimited") : t("composer.failed"));
      return false;
    } finally {
      setSending(false);
    }
  };

  const trimmed = text.trim();
  const canSend = !sending && (trimmed.length > 0 || !!image);
  const submit = async () => {
    if (!canSend) return;
    const ok = await send({ ...(trimmed ? { text: trimmed.slice(0, MAX) } : {}), ...(image ? { image } : {}) });
    if (ok) {
      setText("");
      setImage(null);
      inputRef.current?.focus();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Thai and other IMEs use Enter to confirm a word; only send when not composing.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      setImage(await fileToDataUrl(f, 1200));
    } catch {
      setError(t("composer.badImage"));
    }
  };

  const mineFrom = (m: Message) => m.from === role;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 sm:px-4">
        <Link
          href="/messages"
          aria-label={t("back")}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink lg:hidden"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Avatar name={otherName} logo={role === "buyer" ? shop?.logo : undefined} tint={role === "buyer" ? shop?.tint : undefined} size="size-10" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-semibold">{otherName}</h1>
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted">
            {role === "shop" && <span>{t("buyer")}</span>}
            {role === "buyer" && shop?.example && <span className="truncate">{t("exampleShop")}</span>}
            {role === "buyer" && shop && (
              <Link href={`/shops/${shop.slug}`} className="inline-flex shrink-0 items-center gap-1 underline underline-offset-2 hover:text-ink">
                <Store className="size-3" strokeWidth={2} aria-hidden="true" />
                {t("viewShop")}
              </Link>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <Flag className="size-4" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-sm:sr-only">{t("report.button")}</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} role="log" aria-live="polite" aria-label={t("title")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        {messages.length === 0 && <p className="mx-auto mt-8 max-w-xs text-center text-sm text-muted">{t("start")}</p>}
        <ol className="flex flex-col gap-1.5">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
            const mine = mineFrom(m);
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <li className="my-3 text-center text-xs font-medium text-muted">
                    {dayLabel(m.at, locale, { today: t("today"), yesterday: t("yesterday") })}
                  </li>
                )}
                {m.from === "system" ? (
                  <li className="mx-auto my-1 max-w-sm rounded-full bg-surface px-3 py-1 text-center text-xs text-muted">
                    <span className="sr-only">{t("system")}: </span>
                    {m.text}
                  </li>
                ) : (
                  <li className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[70%] ${mine ? "items-end self-end" : "items-start self-start"}`}>
                    <div
                      className={`flex flex-col gap-2 rounded-2xl px-3.5 py-2 ${mine ? "rounded-br-md bg-ink text-bg" : "rounded-bl-md bg-surface text-ink"}`}
                    >
                      {m.image && (
                        <button
                          type="button"
                          onClick={() => setZoom(m.image!)}
                          className="-mx-1.5 mt-0.5 overflow-hidden rounded-xl"
                          aria-label={t("lightbox.alt")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- data URLs in test mode */}
                          <img src={m.image} alt="" className="max-h-64 w-auto max-w-full object-cover" />
                        </button>
                      )}
                      {m.orderId && <OrderCard order={orders.get(m.orderId)} mine={mine} />}
                      {m.text && <MessageText text={m.text} />}
                    </div>
                    <time dateTime={m.at} className="px-1 text-[0.6875rem] text-muted">
                      {timeOfDay(m.at, locale)}
                    </time>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </div>

      {/* Composer */}
      <div className="border-t border-hairline bg-bg px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        {image && (
          <div className="relative mb-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={image} alt="" className="h-20 w-auto rounded-xl border border-hairline object-cover" />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label={t("composer.removeImage")}
              className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-ink text-bg"
            >
              <X className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <form
          className="flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t("composer.attachImage")}
            title={t("composer.attachImage")}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <ImagePlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => setPicker(true)}
            aria-label={t("composer.attachOrder")}
            title={t("composer.attachOrder")}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <Package className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <label className="sr-only" htmlFor="chat-input">
            {t("composer.label")}
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            onKeyDown={onKey}
            maxLength={MAX}
            rows={1}
            placeholder={t("composer.placeholder")}
            aria-describedby="chat-hint"
            className="field-sizing-content max-h-36 min-h-10 min-w-0 flex-1 resize-none rounded-2xl border border-hairline bg-surface px-3.5 py-2 text-base leading-6 placeholder:text-muted focus:border-ink focus:outline-none focus-visible:outline-2"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={t("composer.send")}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D7FF3A] text-[#111] transition-transform active:scale-95 disabled:bg-surface disabled:text-muted"
          >
            <ArrowUp className="size-5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </form>
        <div className="mt-1.5 flex items-start justify-between gap-3 text-[0.6875rem] leading-snug text-muted">
          <p className="flex items-start gap-1">
            <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            {t("safety")}
          </p>
          <span id="chat-hint" className="sr-only">
            {t("composer.hint")}
          </span>
          {text.length > MAX - 200 && (
            <span className="shrink-0 tabular-nums" aria-live="polite">
              {t("composer.count", { count: text.length, max: MAX })}
            </span>
          )}
        </div>
      </div>

      {/* Image lightbox */}
      <Modal
        open={!!zoom}
        onClose={() => setZoom(null)}
        label={t("lightbox.alt")}
        closeLabel={t("lightbox.close")}
        className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl bg-bg p-2 shadow-soft"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URLs in test mode */}
        {zoom && <img src={zoom} alt={t("lightbox.alt")} className="max-h-[calc(100dvh-4rem)] w-auto max-w-full rounded-xl object-contain" />}
      </Modal>

      {/* Order picker */}
      <Modal
        open={picker}
        onClose={() => {
          setPicker(false);
          setPickerError(null);
        }}
        label={t("orders.title")}
        closeLabel={t("orders.cancel")}
      >
        <h2 className="pr-10 text-lg font-semibold">{t("orders.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("orders.body")}</p>
        {pickerError && (
          <p role="alert" className="mt-3 rounded-xl bg-[#FDECEA] px-3 py-2 text-sm text-[#8C1D18] dark:bg-[#3B1714] dark:text-[#FFB4AB]">
            {pickerError}
          </p>
        )}
        {pairOrders.length === 0 ? (
          <p className="mt-5 rounded-xl bg-surface px-4 py-3 text-sm text-muted">{t("orders.empty")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {pairOrders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={sending}
                  onClick={async () => {
                    if (await send({ orderId: o.id }, setPickerError)) setPicker(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-hairline px-3 py-2.5 text-left transition-colors hover:bg-surface"
                >
                  <Package className="size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{t("order.label", { code: o.code })}</span>
                    <span className="text-xs text-muted">
                      {t("orders.items", { count: o.items.reduce((n, it) => n + it.qty, 0) })} · {t("order.total", { total: baht(o.totalThb, locale) })}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs">{t(`status.${o.status}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ReportDialog open={reporting} onClose={() => setReporting(false)} threadId={thread.id} reporterId={session.user.id} side={role} />
    </div>
  );
}
