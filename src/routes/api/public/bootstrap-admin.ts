import { createFileRoute } from "@tanstack/react-router";

// One-click admin bootstrap. Idempotent: refuses to run once any admin exists.
// Creates the auth user (email-confirmed) if missing and grants the admin role.
export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { email?: string; password?: string } = {};
        try { body = await request.json(); } catch { /* allow empty */ }
        const email = (body.email ?? "gerhardjames1@gmail.com").trim().toLowerCase();
        const password = body.password ?? "Grapefruit23";

        if (!email || !password || password.length < 8) {
          return Response.json({ ok: false, error: "Invalid email or password" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Guard: if an admin already exists, do nothing.
        const { data: existingAdmins, error: roleErr } = await supabaseAdmin
          .from("user_roles").select("user_id").eq("role", "admin").limit(1);
        if (roleErr) return Response.json({ ok: false, error: roleErr.message }, { status: 500 });
        if (existingAdmins && existingAdmins.length > 0) {
          return Response.json({ ok: true, alreadyBootstrapped: true });
        }

        // Find or create the auth user.
        let userId: string | null = null;
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (listErr) return Response.json({ ok: false, error: listErr.message }, { status: 500 });
        const found = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (found) {
          userId = found.id;
          // Ensure the password matches what the caller provided and the email is confirmed.
          await supabaseAdmin.auth.admin.updateUserById(found.id, { password, email_confirm: true });
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email, password, email_confirm: true,
          });
          if (createErr || !created.user) {
            return Response.json({ ok: false, error: createErr?.message ?? "Failed to create user" }, { status: 500 });
          }
          userId = created.user.id;
        }

        // Grant admin role (customer role is added by handle_new_user trigger).
        const { error: insErr } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
        if (insErr) return Response.json({ ok: false, error: insErr.message }, { status: 500 });

        return Response.json({ ok: true, userId, email });
      },
    },
  },
});
