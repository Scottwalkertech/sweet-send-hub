import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  VITE_EXTERNAL_PROJECT_ANON_KEY,
  VITE_EXTERNAL_PROJECT_URL,
} from "./external-supabase-config";

// Exclusively use the hardcoded custom-named credentials. Do NOT fall back to
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — those are injected by the
// Lovable Cloud build and would silently point the client at the wrong project.
function getExternalSupabaseConfig() {
  return { url: VITE_EXTERNAL_PROJECT_URL, anonKey: VITE_EXTERNAL_PROJECT_ANON_KEY };
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
