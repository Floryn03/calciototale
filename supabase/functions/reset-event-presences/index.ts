import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !authorization?.startsWith("Bearer ")) {
    return json({ error: "Accesso non autorizzato." }, 401);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user) return json({ error: "Sessione non valida." }, 401);

  const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return json({ error: "Operazione riservata all'Admin." }, 403);

  let body: { event_id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Richiesta non valida." }, 400);
  }
  if (!body.event_id) return json({ error: "Evento non valido." }, 400);

  const { data: event } = await client.from("events").select("id").eq("id", body.event_id).maybeSingle();
  if (!event) return json({ error: "Evento non trovato." }, 404);

  const { data, error } = await client
    .from("presences")
    .update({ status: "Da confermare" })
    .eq("event_id", event.id)
    .neq("status", "Da confermare")
    .select("id");
  if (error) return json({ error: error.message }, 500);

  return json({ reset_count: data?.length || 0 });
});
