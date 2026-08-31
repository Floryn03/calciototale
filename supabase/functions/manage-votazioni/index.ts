import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const formationRoles = [
  "POR",
  "DCD",
  "DCC",
  "DCS",
  "CDC",
  "CCS",
  "CCD",
  "ES",
  "ED",
  "ATT (PS)",
  "ATT (PD)",
];

type WeeklyStat = {
  player_id: string;
  player_name: string;
  position: string;
  average_rating: number;
  votes_count: number;
  matches_count: number;
  performance_score: number;
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

function weekStartFromDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}

function isWeekStart(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function requireAdmin(
  client: ReturnType<typeof createClient>,
  authorization: string | null
) {
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(token);

  if (userError || !user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? user : null;
}

async function recalculateWeek(
  client: ReturnType<typeof createClient>,
  weekStart: string,
  minimumVotes: number
) {
  const { data: ratings, error: ratingsError } = await client
    .from("match_ratings")
    .select("player_id, match_id, rating")
    .eq("week_start", weekStart);

  if (ratingsError) throw ratingsError;

  const playerIds = [...new Set((ratings || []).map((rating) => rating.player_id))];
  const { data: players, error: playersError } = playerIds.length
    ? await client
        .from("players")
        .select("id, name, position")
        .in("id", playerIds)
    : { data: [], error: null };

  if (playersError) throw playersError;

  const playersById = new Map((players || []).map((player) => [player.id, player]));
  const grouped = new Map<string, { total: number; votes: number; matches: Set<string> }>();

  for (const rating of ratings || []) {
    if (!playersById.has(rating.player_id)) continue;
    const current = grouped.get(rating.player_id) || {
      total: 0,
      votes: 0,
      matches: new Set<string>(),
    };
    current.total += Number(rating.rating);
    current.votes += 1;
    current.matches.add(rating.match_id);
    grouped.set(rating.player_id, current);
  }

  const stats: WeeklyStat[] = [...grouped.entries()]
    .map(([playerId, values]) => {
      const player = playersById.get(playerId)!;
      const average = values.total / values.votes;
      const reliability = Math.min(values.votes / minimumVotes, 1);
      const matchCoverage = Math.min(values.matches.size / 2, 1);
      const performance = average * (0.65 + reliability * 0.25 + matchCoverage * 0.1);

      return {
        player_id: playerId,
        player_name: player.name,
        position: player.position,
        average_rating: Number(average.toFixed(2)),
        votes_count: values.votes,
        matches_count: values.matches.size,
        performance_score: Number(performance.toFixed(2)),
      };
    })
    .sort(
      (a, b) =>
        b.performance_score - a.performance_score ||
        b.votes_count - a.votes_count ||
        b.average_rating - a.average_rating ||
        a.player_name.localeCompare(b.player_name)
    );

  const { error: deleteRatingsError } = await client
    .from("weekly_player_ratings")
    .delete()
    .eq("week_start", weekStart);
  if (deleteRatingsError) throw deleteRatingsError;

  if (stats.length) {
    const { error: insertRatingsError } = await client
      .from("weekly_player_ratings")
      .insert(stats.map((stat) => ({ ...stat, week_start: weekStart })));
    if (insertRatingsError) throw insertRatingsError;
  }

  const eligible = stats.filter((stat) => stat.votes_count >= minimumVotes);
  const topSlots = formationRoles.map((position) => {
    const best = eligible.find((stat) => stat.position === position);
    return best
      ? { ...best, week_start: weekStart }
      : {
          week_start: weekStart,
          position,
          player_id: null,
          player_name: null,
          average_rating: null,
          votes_count: null,
          matches_count: null,
          performance_score: null,
        };
  });

  const { error: deleteTop11Error } = await client
    .from("weekly_top_11")
    .delete()
    .eq("week_start", weekStart);
  if (deleteTop11Error) throw deleteTop11Error;

  const { error: insertTop11Error } = await client.from("weekly_top_11").insert(topSlots);
  if (insertTop11Error) throw insertTop11Error;

  const { error: deleteMvpError } = await client
    .from("weekly_mvp")
    .delete()
    .eq("week_start", weekStart);
  if (deleteMvpError) throw deleteMvpError;

  const mvp = eligible[0];
  const { error: insertMvpError } = await client.from("weekly_mvp").insert(
    mvp
      ? { ...mvp, week_start: weekStart }
      : {
          week_start: weekStart,
          player_id: null,
          player_name: null,
          position: null,
          average_rating: null,
          votes_count: null,
          matches_count: null,
          performance_score: null,
        }
  );
  if (insertMvpError) throw insertMvpError;

  return { stats, topSlots, mvp: mvp || null };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Metodo non consentito." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configurazione non disponibile." }, 500);

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const user = await requireAdmin(client, request.headers.get("Authorization"));
  if (!user) return json({ error: "Operazione riservata all’amministratore." }, 403);

  let body: {
    action?: "save_rating" | "delete_rating" | "recalculate" | "update_settings";
    match_id?: string;
    player_id?: string;
    rating?: number;
    comment?: string;
    week_start?: string;
    minimum_votes?: number;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Richiesta non valida." }, 400);
  }

  if (!body.action) return json({ error: "Azione non valida." }, 400);

  const { data: settings } = await client
    .from("weekly_rating_settings")
    .select("minimum_votes")
    .eq("id", "default")
    .single();
  let minimumVotes = settings?.minimum_votes || 2;

  try {
    if (body.action === "update_settings") {
      const value = Number(body.minimum_votes);
      if (!Number.isInteger(value) || value < 1 || value > 50) {
        return json({ error: "Il minimo voti deve essere compreso tra 1 e 50." }, 400);
      }
      minimumVotes = value;
      const { error } = await client.from("weekly_rating_settings").upsert({
        id: "default",
        minimum_votes: value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }

    if (body.action === "save_rating" || body.action === "delete_rating") {
      if (!body.match_id || !body.player_id) {
        return json({ error: "Partita o giocatore non validi." }, 400);
      }

      const { data: match } = await client
        .from("events")
        .select("id, event_date")
        .eq("id", body.match_id)
        .maybeSingle();
      if (!match) return json({ error: "Partita non trovata." }, 404);

      const { data: presence } = await client
        .from("presences")
        .select("id")
        .eq("event_id", body.match_id)
        .eq("player_id", body.player_id)
        .eq("status", "Presente")
        .maybeSingle();
      if (!presence) return json({ error: "Puoi votare solo un giocatore presente alla partita." }, 400);

      const weekStart = weekStartFromDate(match.event_date);

      if (body.action === "save_rating") {
        const rating = Number(body.rating);
        if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
          return json({ error: "Il voto deve essere compreso tra 1 e 10." }, 400);
        }
        const comment = body.comment?.trim().slice(0, 1000) || null;
        const { error } = await client.from("match_ratings").upsert(
          {
            match_id: body.match_id,
            player_id: body.player_id,
            admin_id: user.id,
            week_start: weekStart,
            rating,
            comment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "match_id,player_id,admin_id" }
        );
        if (error) throw error;
      } else {
        const { error } = await client
          .from("match_ratings")
          .delete()
          .eq("match_id", body.match_id)
          .eq("player_id", body.player_id)
          .eq("admin_id", user.id);
        if (error) throw error;
      }

      const result = await recalculateWeek(client, weekStart, minimumVotes);
      return json({ week_start: weekStart, ...result });
    }

    if (body.action === "recalculate" || body.action === "update_settings") {
      if (!body.week_start || !isWeekStart(body.week_start)) {
        return json({ error: "Settimana non valida." }, 400);
      }
      const result = await recalculateWeek(client, body.week_start, minimumVotes);
      return json({ week_start: body.week_start, minimum_votes: minimumVotes, ...result });
    }

    return json({ error: "Azione non supportata." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Impossibile aggiornare votazioni e classifica." }, 500);
  }
});
