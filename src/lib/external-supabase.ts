import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function getExternalSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "External Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for this project.",
    );
  }

  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

function createExternalSupabaseClient() {
  const { url, anonKey } = getExternalSupabaseConfig();

  return createClient<Database>(url, anonKey, {
    auth: {
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey: `dbw-external-auth-${new URL(url).host}`,
    },
  });
}

let externalSupabase: ReturnType<typeof createExternalSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createExternalSupabaseClient>, {
  get(_, prop, receiver) {
    if (!externalSupabase) externalSupabase = createExternalSupabaseClient();
    return Reflect.get(externalSupabase, prop, receiver);
  },
});
