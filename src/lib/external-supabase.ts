import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EXTERNAL_SUPABASE_ANON_KEY, EXTERNAL_SUPABASE_URL } from "./external-supabase-config";

function getExternalSupabaseConfig() {
  return { url: EXTERNAL_SUPABASE_URL, anonKey: EXTERNAL_SUPABASE_ANON_KEY };
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
