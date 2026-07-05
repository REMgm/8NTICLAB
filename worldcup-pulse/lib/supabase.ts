import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Anon client — read-only under RLS. Server components use this too; the
// client bundle never talks to the football providers directly.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // demo mode: lib/data.ts falls back to seed
  return createClient(url, key, { auth: { persistSession: false } });
}

// Service-role client — cron ingest only. Never imported by client code.
export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getConfig<T>(key: string): Promise<T | null> {
  const db = getServiceSupabase() ?? getSupabase();
  if (!db) return null;
  const { data } = await db.from("config").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const db = getServiceSupabase();
  if (!db) return;
  await db.from("config").upsert({ key, value });
}
