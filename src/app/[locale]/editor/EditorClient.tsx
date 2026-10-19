"use client";

import dynamic from "next/dynamic";
import { AuthGate } from "@/components/AuthGate";

// Konva needs the DOM, so the editor renders client-side only.
const Editor = dynamic(() => import("@/features/editor/ui/Editor"), {
  ssr: false,
  loading: () => <div className="h-dvh bg-surface" />,
});

export function EditorClient() {
  return <AuthGate>{() => <Editor />}</AuthGate>;
}
