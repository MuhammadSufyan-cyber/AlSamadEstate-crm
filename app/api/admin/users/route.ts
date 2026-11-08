import { createClient } from "@supabase/supabase-js";

// Creates a consultant login. Runs only on the server because it needs the
// service-role key, which must never reach the browser. Only an active admin may call it.
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "The server is missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const { data: profile } = await admin.from("profiles").select("role,is_active").eq("id", caller.user.id).single();
  if (profile?.role !== "admin" || !profile.is_active) return Response.json({ error: "Only an admin can add consultants." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const full_name = String(body?.full_name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!full_name || !email || password.length < 8) return Response.json({ error: "Name, email and an 8+ character password are required." }, { status: 400 });

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ id: data.user.id, full_name, email });
}
