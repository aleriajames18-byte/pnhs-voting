// =====================================================================
// Edge Function: import-roster
// Bulk-creates voter auth accounts (synthetic email) + voter profile rows.
// Caller must be an authenticated admin. Uses the service_role key, which
// NEVER leaves the server.
//
// Request body:
//   { "rows": [{ "lrn": "...", "full_name": "...", "grade_level": 7, "section": "Rizal" }, ...],
//     "temp_password": "PNHSvote2026" }
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const EMAIL_DOMAIN = "voters.polanconhs.local";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // --- Verify the caller is an admin ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Not signed in" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin
      .from("admin_users").select("id").eq("id", u.user.id).maybeSingle();
    if (!isAdmin) return json({ error: "Not authorized" }, 403);

    // --- Process the roster ---
    const { rows, temp_password } = await req.json();
    if (!Array.isArray(rows) || !temp_password)
      return json({ error: "rows[] and temp_password are required" }, 400);

    let created = 0;
    const errors: { lrn: string; reason: string }[] = [];

    for (const r of rows) {
      const lrn = String(r.lrn ?? "").trim();
      if (!lrn) { errors.push({ lrn: "(blank)", reason: "missing LRN" }); continue; }

      const email = `${lrn}@${EMAIL_DOMAIN}`;
      const { data: u2, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: temp_password,
        email_confirm: true,
        user_metadata: { lrn },
      });
      if (cErr || !u2?.user) {
        errors.push({ lrn, reason: cErr?.message ?? "createUser failed" });
        continue;
      }

      const { error: pErr } = await admin.from("voters").insert({
        id: u2.user.id,
        lrn,
        full_name: r.full_name ?? "",
        grade_level: Number(r.grade_level),
        section: String(r.section ?? "").trim(),
      });
      if (pErr) {
        // roll back the orphan auth user
        await admin.auth.admin.deleteUser(u2.user.id);
        errors.push({ lrn, reason: pErr.message });
        continue;
      }
      created++;
    }

    return json({ status: "ok", created, failed: errors.length, errors });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
