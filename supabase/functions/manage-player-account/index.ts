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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

function randomText(length: number, alphabet: string) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;
  const required = [
    randomText(1, upper),
    randomText(1, lower),
    randomText(1, digits),
    randomText(1, symbols),
    randomText(10, all),
  ].join("");

  return required
    .split("")
    .map((character) => ({ character, order: crypto.getRandomValues(new Uint32Array(1))[0] }))
    .sort((a, b) => a.order - b.order)
    .map(({ character }) => character)
    .join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo non consentito." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !serviceRoleKey || !authorization?.startsWith("Bearer ")) {
    return json({ error: "Accesso non autorizzato." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return json({ error: "Sessione non valida." }, 401);
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return json({ error: "Operazione riservata all’amministratore." }, 403);
  }

  let body: { action?: string; player_id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Richiesta non valida." }, 400);
  }

  if (!body.player_id || !["create", "reset_password"].includes(body.action || "")) {
    return json({ error: "Azione o giocatore non validi." }, 400);
  }

  const { data: player } = await adminClient
    .from("players")
    .select("id, name")
    .eq("id", body.player_id)
    .maybeSingle();

  if (!player) {
    return json({ error: "Giocatore non trovato." }, 404);
  }

  const password = generatePassword();

  if (body.action === "reset_password") {
    const { data: account } = await adminClient
      .from("player_accounts")
      .select("user_id, login_id")
      .eq("player_id", player.id)
      .maybeSingle();

    if (!account) {
      return json({ error: "Accesso giocatore non trovato." }, 404);
    }

    const { error } = await adminClient.auth.admin.updateUserById(
      account.user_id,
      { password }
    );

    if (error) {
      return json({ error: "Impossibile aggiornare la password." }, 500);
    }

    return json({ login_id: account.login_id, password });
  }

  const { data: existingAccount } = await adminClient
    .from("player_accounts")
    .select("login_id")
    .eq("player_id", player.id)
    .maybeSingle();

  if (existingAccount) {
    return json({ error: "Questo giocatore ha già un accesso." }, 409);
  }

  let loginId = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `CT-${randomText(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")}`;
    const { data: collision } = await adminClient
      .from("player_accounts")
      .select("user_id")
      .eq("login_id", candidate)
      .maybeSingle();

    if (!collision) {
      loginId = candidate;
      break;
    }
  }

  if (!loginId) {
    return json({ error: "Impossibile generare un ID univoco." }, 500);
  }

  const email = `${loginId.toLowerCase()}@players.calciototale.invalid`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "player" },
  });

  if (createError || !created.user) {
    return json({ error: "Impossibile creare l’account Supabase." }, 500);
  }

  const { error: linkError } = await adminClient.from("player_accounts").insert({
    user_id: created.user.id,
    player_id: player.id,
    login_id: loginId,
  });

  if (linkError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: "Impossibile collegare l’account al giocatore." }, 500);
  }

  return json({ login_id: loginId, password }, 201);
});
