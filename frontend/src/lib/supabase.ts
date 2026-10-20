import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/rest\/v1$/, "");
}

export function serverSupabaseUrl(): string {
  return normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function serverSupabaseKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
}

export function hasServerSupabaseConfig(): boolean {
  return Boolean(serverSupabaseUrl() && serverSupabaseKey());
}

export function getServerSupabase(): SupabaseClient {
  const url = serverSupabaseUrl();
  const key = serverSupabaseKey();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the server runtime.",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Browser client. The anon key is public; the service-role key stays on the server. */
export function getBrowserSupabase(): SupabaseClient | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key || key.startsWith("your-")) {
    return null;
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
