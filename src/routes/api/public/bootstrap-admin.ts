import { createFileRoute } from "@tanstack/react-router";

// The external Supabase project owns auth users and roles. This endpoint is
// intentionally disabled so the app cannot bootstrap users into the generated
// Lovable Cloud database instance by mistake.
export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => Response.json(
        { ok: false, error: "Admin bootstrap is disabled for external-auth configuration." },
        { status: 410 },
      ),
    },
  },
});
