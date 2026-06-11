import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

/**
 * Service-role Supabase client. Server-only: used by API routes and the
 * background scripts. Lazily constructed so `next build` succeeds without env
 * vars, and a missing config surfaces as a clear 503 at request time instead
 * of an import-time crash.
 */
let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (client) return client;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (!url) requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "Use the service_role key from Supabase → Project Settings → API. Server-side only.",
  );
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * Page through an entire table/query 1,000 rows at a time.
 * `data` is typed loosely because supabase-js can't statically parse dynamic
 * select strings; callers declare the row shape via the type parameter.
 */
export async function fetchAllPages<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const from = page * pageSize;
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
