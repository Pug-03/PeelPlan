"use client";

import { MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChatGate } from "./ChatGate";
import { Conversation } from "./Conversation";
import { Inbox } from "./Inbox";

/**
 * /messages and /messages/[id]. Desktop: inbox on the left, conversation on the right.
 * Phones: the inbox alone at /messages, the conversation alone (with a back button) at /messages/[id].
 * The panes fill the viewport under the header so the composer stays pinned to the bottom.
 */
export function MessagesApp({ threadId }: { threadId?: string }) {
  const t = useTranslations("chat");
  return (
    <ChatGate>
      {(session) => (
        <div className="mx-auto flex h-[calc(100dvh-76px-env(safe-area-inset-top,0px))] max-w-7xl gap-4 sm:px-8 lg:pb-6">
          <aside
            aria-label={t("title")}
            className={`min-h-0 w-full flex-col overflow-hidden lg:flex lg:w-80 lg:shrink-0 lg:rounded-2xl lg:border lg:border-hairline ${threadId ? "hidden" : "flex"}`}
          >
            <Inbox userId={session.user.id} activeId={threadId} />
          </aside>
          <section
            className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:rounded-t-2xl sm:border sm:border-b-0 sm:border-hairline lg:flex lg:rounded-2xl lg:border-b ${threadId ? "flex" : "hidden"}`}
          >
            {threadId ? (
              <Conversation key={threadId} id={threadId} session={session} />
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div className="flex max-w-xs flex-col items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-full bg-surface" aria-hidden="true">
                    <MessagesSquare className="size-6" strokeWidth={1.75} />
                  </span>
                  <p className="font-semibold">{t("pick.title")}</p>
                  <p className="text-sm text-muted">{t("pick.body")}</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </ChatGate>
  );
}
