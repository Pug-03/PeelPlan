import { ViewTransition } from "react";

/**
 * A template remounts on every navigation (a layout doesn't), so wrapping the page here gives each route
 * change an exit for the old page and an enter for the new one. The browser's View Transitions API runs
 * them; where it isn't supported, pages simply swap as before. Animations live in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
