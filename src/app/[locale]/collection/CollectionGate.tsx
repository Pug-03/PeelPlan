"use client";

import { AuthGate } from "@/components/AuthGate";
import { CollectionView } from "./CollectionView";

export function CollectionGate() {
  return <AuthGate>{(session) => <CollectionView session={session} />}</AuthGate>;
}
