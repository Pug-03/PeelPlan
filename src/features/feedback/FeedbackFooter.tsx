import { FeedbackLink } from "./FeedbackLink";

/** A "found a problem?" link as the last block of a page that has no footer of its own. */
export function FeedbackFooter({ width = "max-w-7xl" }: { width?: string }) {
  return (
    <footer className={`mx-auto ${width} px-5 pb-16 sm:px-8`}>
      <div className="border-t border-hairline pt-10">
        <FeedbackLink />
      </div>
    </footer>
  );
}
