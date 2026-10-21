// Removes orphaned private files: slips of purged orders, replaced / never-submitted slips (after 30
// days), and chat images no message uses. Which files are orphaned is decided in SQL by
// public.storage_orphans() (migration 0004); this function only deletes them through the Storage API,
// because deleting storage.objects rows from SQL is blocked and would not remove the file anyway.
//
// Deploy:   supabase functions deploy storage-cleanup
// Run:      POST with `Authorization: Bearer <service role key>` (anything else gets 401). Daily from
//           pg_cron + pg_net, with the key stored in Vault as 'service_role_key':
//             select cron.schedule('storage-cleanup', '45 3 * * *', $$
//               select net.http_post(
//                 url := 'https://<project-ref>.supabase.co/functions/v1/storage-cleanup',
//                 headers := jsonb_build_object('Authorization', 'Bearer ' ||
//                   (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')))
//             $$);
// Env:      SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge runtime.
//
// The bare import is mapped to JSR by deno.json next to this file. The repo's tsconfig also type-checks
// this file (it includes **/*.ts), where the same import resolves to node_modules, so the little of the
// Deno global used here is declared locally instead of pulling in Deno types.

import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const BATCH = 1000; // storage_orphans() page size
const REMOVE_CHUNK = 100; // paths per Storage API remove() call
const MAX_ROUNDS = 20; // stop after this many pages per run; the next run picks up the rest

type Orphan = { bucket_id: string; name: string };

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "missing-env" }, 500);
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) return json({ error: "unauthorized" }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const removed: Record<string, number> = {};
  const errors: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await db.rpc("storage_orphans", { p_limit: BATCH });
    if (error) return json({ error: error.message, removed }, 500);
    const rows = (data ?? []) as Orphan[];
    if (rows.length === 0) break;

    const byBucket = new Map<string, string[]>();
    for (const r of rows) byBucket.set(r.bucket_id, [...(byBucket.get(r.bucket_id) ?? []), r.name]);

    let progressed = false;
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += REMOVE_CHUNK) {
        const { data: gone, error: rmError } = await db.storage.from(bucket).remove(names.slice(i, i + REMOVE_CHUNK));
        if (rmError) {
          errors.push(`${bucket}: ${rmError.message}`);
          continue;
        }
        const n = gone?.length ?? 0;
        removed[bucket] = (removed[bucket] ?? 0) + n;
        if (n > 0) progressed = true;
      }
    }
    // Nothing could be removed this round: don't spin on the same rows.
    if (!progressed || rows.length < BATCH) break;
  }

  return json({ removed, errors }, errors.length ? 207 : 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
