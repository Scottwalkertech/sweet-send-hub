/**
 * External Supabase project credentials.
 *
 * These are intentionally hardcoded under CUSTOM variable names
 * (VITE_EXTERNAL_PROJECT_URL / VITE_EXTERNAL_PROJECT_ANON_KEY) so the
 * Lovable Cloud hosting environment — which auto-injects VITE_SUPABASE_URL
 * and VITE_SUPABASE_ANON_KEY at build time — cannot override them.
 *
 * The literals below are the single source of truth for the external
 * Supabase project the app authenticates against.
 */

export const VITE_EXTERNAL_PROJECT_URL = "https://dlcmrygwwagpfsybccbo.supabase.co";

export const VITE_EXTERNAL_PROJECT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsY21yeWd3d2FncGZzeWJjY2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDIyNDEsImV4cCI6MjA5ODk3ODI0MX0.abUYXRVKypndmt1Qa-d9MJdeuj6b5UFXSTmGc2XLcnc";

// Back-compat aliases for existing imports.
export const EXTERNAL_SUPABASE_URL = VITE_EXTERNAL_PROJECT_URL;
export const EXTERNAL_SUPABASE_ANON_KEY = VITE_EXTERNAL_PROJECT_ANON_KEY;
