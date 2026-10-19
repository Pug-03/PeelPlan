import { notFound } from "next/navigation";

/** Any unknown path under a locale renders `[locale]/not-found.tsx`, inside the localised layout. */
export default function CatchAll() {
  notFound();
}
