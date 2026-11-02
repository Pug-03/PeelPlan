import { ViewTransition } from "react";

/**
 * A template remounts on every navigation (a layout doesn't), so wrapping the page here gives each route
 * change an exit for the old page and an enter for the new one. The browser's View Transitions API runs
 * them; where it isn't supported, pages simply swap as before. Animations live in globals.css.
 *
 * The plain <div> is the element the transition names and tracks. Without it the page's own top-level
 * nodes are tracked, and a page that swaps one of them mid-animation (the editor replaces its loading
 * placeholder once its client code arrives) makes the browser abort the transition outright. A wrapper
 * stays put while its contents change.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
