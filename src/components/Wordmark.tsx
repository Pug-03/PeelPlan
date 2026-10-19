/**
 * PeelPlan mark ("peeling dot"): a round lime sticker with its edge lifting to show the white
 * backing. `tone="inverse"` drops the dark outline for use on the dark intro sheet.
 */
export function RulerMark({ className = "", tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  // Fixed brand colours rather than theme tokens: the mark looks the same on light and dark grounds.
  const ink = tone === "inverse" ? "#ffffff" : "#1B1B1F";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M27.6 19.1A12 12 0 1 1 19.1 4.4Z" fill="#D7FF3A" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19.1 4.4Q18.4 16.8 27.6 19.1Z" fill="#000" opacity=".18" transform="translate(-.6 1)" />
      <path d="M19.1 4.4Q18.4 16.8 27.6 19.1Z" fill="#fff" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <RulerMark className="size-7" />
      <span className="text-[1.15rem]">PeelPlan</span>
    </span>
  );
}
