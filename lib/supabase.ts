import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);

// Browser client. Uses only the public anon key; the database security rules
// (supabase/schema.sql) decide what each signed-in user may read or write.
export const supabase = createClient(url ?? "http://localhost", anon ?? "missing-key");
