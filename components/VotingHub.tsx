"use client";

/* The effects below synchronise asynchronous Supabase reads and form drafts. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";

type Player = {
  id: string;
  name: string;
  psn_id: string;
  shirt_number: number;
  position: string;
  status: string;
};

type MatchItem = {
  id: string;
  name: string;
  event_date: string;
  event_time: string | null;
};

type MatchRating = {
  id: string;
  match_id: string;
  player_id: string;
  admin_id: string;
  week_start: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

type Competition = { id: string; name: string; type: string; status: string };
type CompetitionEventMatch = { id: string; competition_id: string; event_id: string; match_number: number };

type WeeklyRating = {
  id: string;
  week_start: string;
  player_id: string | null;
  player_name: string;
  position: string;
  average_rating: number;
  votes_count: number;
  matches_count: number;
  performance_score: number;
};

type TopSlot = {
  id: string;
  week_start: string;
  player_id: string | null;
  player_name: string | null;
  position: string;
  average_rating: number | null;
  votes_count: number | null;
  matches_count: number | null;
  performance_score: number | null;
};

type WeeklyMvp = TopSlot;

type Draft = { rating: string; comment: string };

const officialRoles = [
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

function weekStartFromDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}

function formatWeek(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return `Settimana del ${new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)}`;
}

function average(items: MatchRating[]) {
  if (!items.length) return null;
  return items.reduce((total, item) => total + Number(item.rating), 0) / items.length;
}

function PlayerAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-black text-emerald-300">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function VoteScore({ value }: { value: number | null }) {
  return (
    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-mono text-sm font-black text-emerald-300">
      {value === null ? "—" : value.toFixed(2)}
    </span>
  );
}

function TopCard({ slot }: { slot: TopSlot }) {
  if (!slot.player_id || !slot.player_name) {
    return (
      <div className="min-w-0 rounded-xl border border-dashed border-white/20 bg-slate-950/70 p-2.5 text-center">
        <p className="text-[10px] font-black text-amber-300">{slot.position}</p>
        <p className="mt-1 text-xs text-slate-500">Posto libero</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-emerald-300/30 bg-slate-950/90 p-2.5 shadow-lg">
      <div className="flex items-center gap-2">
        <PlayerAvatar name={slot.player_name} />
        <div className="min-w-0 text-left">
          <p className="truncate text-xs font-black">{slot.player_name}</p>
          <p className="text-[10px] font-bold text-amber-300">🏆 {slot.position}</p>
        </div>
      </div>
      <p className="mt-2 text-center font-mono text-sm font-black text-emerald-300">
        {slot.average_rating?.toFixed(2)}
      </p>
    </div>
  );
}

export default function VotingHub({
  players,
  matches,
  isAdmin,
  view,
}: {
  players: Player[];
  matches: MatchItem[];
  isAdmin: boolean;
  view: "votes" | "mvp";
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<MatchRating[]>([]);
  const [weeklyRatings, setWeeklyRatings] = useState<WeeklyRating[]>([]);
  const [topSlots, setTopSlots] = useState<TopSlot[]>([]);
  const [mvps, setMvps] = useState<WeeklyMvp[]>([]);
  const [minimumVotes, setMinimumVotes] = useState(2);
  const [minimumDraft, setMinimumDraft] = useState("2");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionMatches, setCompetitionMatches] = useState<CompetitionEventMatch[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [newMatchName, setNewMatchName] = useState("");
  const [newMatchDate, setNewMatchDate] = useState("");
  const [newMatchTime, setNewMatchTime] = useState("21:00");
  const [savingMatch, setSavingMatch] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(() => weekStartFromDate(new Date().toISOString().slice(0, 10)));
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantRoles, setParticipantRoles] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ratingsResult, weeklyResult, topResult, mvpResult, settingsResult, userResult, competitionsResult, competitionMatchesResult] =
      await Promise.all([
        supabase
          .from("match_ratings")
          .select("id, match_id, player_id, admin_id, week_start, rating, comment, created_at, updated_at"),
        supabase
          .from("weekly_player_ratings")
          .select("id, week_start, player_id, player_name, position, average_rating, votes_count, matches_count, performance_score"),
        supabase
          .from("weekly_top_11")
          .select("id, week_start, player_id, player_name, position, average_rating, votes_count, matches_count, performance_score"),
        supabase
          .from("weekly_mvp")
          .select("id, week_start, player_id, player_name, position, average_rating, votes_count, matches_count, performance_score"),
        supabase.from("weekly_rating_settings").select("minimum_votes").eq("id", "default").maybeSingle(),
        supabase.auth.getUser(),
        supabase.from("competitions").select("id, name, type, status").order("created_at", { ascending: false }),
        supabase.from("competition_event_matches").select("id, competition_id, event_id, match_number").order("match_number", { ascending: true }),
      ]);

    if (ratingsResult.error || weeklyResult.error || topResult.error || mvpResult.error) {
      console.error("Errore caricamento votazioni", {
        ratings: ratingsResult.error,
        weekly: weeklyResult.error,
        top: topResult.error,
        mvp: mvpResult.error,
      });
    }

    setRatings((ratingsResult.data || []) as MatchRating[]);
    setWeeklyRatings((weeklyResult.data || []) as WeeklyRating[]);
    setTopSlots((topResult.data || []) as TopSlot[]);
    setMvps((mvpResult.data || []) as WeeklyMvp[]);
    const configuredMinimum = settingsResult.data?.minimum_votes || 2;
    setMinimumVotes(configuredMinimum);
    setMinimumDraft(String(configuredMinimum));
    setViewerId(userResult.data.user?.id || null);
    setCompetitions((competitionsResult.data || []) as Competition[]);
    setCompetitionMatches((competitionMatchesResult.data || []) as CompetitionEventMatch[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tournamentMatches = useMemo(() => {
    if (!selectedCompetitionId) return matches;
    const numbered = competitionMatches
      .filter((item) => item.competition_id === selectedCompetitionId)
      .map((item) => ({ item, match: matches.find((match) => match.id === item.event_id) }))
      .filter((entry): entry is { item: CompetitionEventMatch; match: MatchItem } => Boolean(entry.match))
      .sort((a, b) => a.item.match_number - b.item.match_number);
    return numbered.map((entry) => entry.match);
  }, [competitionMatches, matches, selectedCompetitionId]);

  useEffect(() => {
    if (!tournamentMatches.length) {
      setSelectedMatchId("");
      return;
    }
    if (!tournamentMatches.some((match) => match.id === selectedMatchId)) {
      setSelectedMatchId(tournamentMatches[tournamentMatches.length - 1].id);
    }
  }, [selectedMatchId, tournamentMatches]);

  useEffect(() => {
    if (!selectedMatchId) {
      setParticipants([]);
      setParticipantRoles({});
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from("presences")
        .select("player_id, event_role")
        .eq("event_id", selectedMatchId)
        .eq("status", "Presente");
      if (error) {
        console.error("Errore partecipanti partita", error);
        setParticipants([]);
        setParticipantRoles({});
        return;
      }
      const rows = data || [];
      setParticipants(rows.map((item) => item.player_id));
      setParticipantRoles(Object.fromEntries(rows.map((item) => [item.player_id, item.event_role || ""])));
    })();
  }, [selectedMatchId]);

  useEffect(() => {
    if (!viewerId || !selectedMatchId) return;
    const next: Record<string, Draft> = {};
    for (const playerId of participants) {
      const existing = ratings.find(
        (rating) =>
          rating.match_id === selectedMatchId &&
          rating.player_id === playerId &&
          rating.admin_id === viewerId
      );
      next[playerId] = {
        rating: existing ? String(existing.rating) : "",
        comment: existing?.comment || "",
      };
    }
    setDrafts(next);
  }, [participants, ratings, selectedMatchId, viewerId]);

  const weeks = useMemo(() => {
    const values = new Set<string>([
      ...ratings.map((rating) => rating.week_start),
      ...weeklyRatings.map((rating) => rating.week_start),
      ...topSlots.map((slot) => slot.week_start),
      ...matches.map((match) => weekStartFromDate(match.event_date)),
    ]);
    return [...values].sort().reverse();
  }, [matches, ratings, topSlots, weeklyRatings]);

  useEffect(() => {
    if (weeks.length && !weeks.includes(selectedWeek)) setSelectedWeek(weeks[0]);
  }, [selectedWeek, weeks]);

  const selectedMatchRatings = ratings.filter((rating) => rating.match_id === selectedMatchId);
  const selectedWeekRatings = weeklyRatings
    .filter((rating) => rating.week_start === selectedWeek)
    .sort(
      (a, b) =>
        b.performance_score - a.performance_score ||
        b.votes_count - a.votes_count ||
        b.average_rating - a.average_rating
    );
  const selectedCompetition = competitions.find((competition) => competition.id === selectedCompetitionId) || null;
  const tournamentMatchIds = new Set(tournamentMatches.map((match) => match.id));
  const tournamentRanking = selectedCompetition
    ? [...new Map(
        ratings
          .filter((rating) => tournamentMatchIds.has(rating.match_id))
          .reduce((map, rating) => {
            const current = map.get(rating.player_id) || { total: 0, votes: 0, matches: new Set<string>() };
            current.total += Number(rating.rating);
            current.votes += 1;
            current.matches.add(rating.match_id);
            map.set(rating.player_id, current);
            return map;
          }, new Map<string, { total: number; votes: number; matches: Set<string> }>())
      ).entries()].map(([playerId, value]) => {
        const player = playersById.get(playerId);
        return player ? { player, average: value.total / value.votes, total: value.total, votes: value.votes, matches: value.matches.size } : null;
      }).filter((item): item is { player: Player; average: number; total: number; votes: number; matches: number } => Boolean(item)).sort((a, b) => b.average - a.average || b.matches - a.matches || b.votes - a.votes)
    : [];
  const tournamentMvp = tournamentRanking[0] || null;
  const selectedTopSlots = officialRoles.map(
    (position) =>
      topSlots.find((slot) => slot.week_start === selectedWeek && slot.position === position) || {
        id: `${selectedWeek}-${position}`,
        week_start: selectedWeek,
        player_id: null,
        player_name: null,
        position,
        average_rating: null,
        votes_count: null,
        matches_count: null,
        performance_score: null,
      }
  );
  const selectedMvp = mvps.find((mvp) => mvp.week_start === selectedWeek) || null;
  const matchParticipants = participants
    .map((playerId) => {
      const player = playersById.get(playerId);
      return player ? { ...player, eventRole: participantRoles[playerId] || player.position } : null;
    })
    .filter((player): player is Player & { eventRole: string } => Boolean(player));

  async function callManager(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("manage-votazioni", { body });
    const payload = data as { error?: string } | null;
    if (error || payload?.error) {
      throw new Error(payload?.error || error?.message || "Operazione non riuscita.");
    }
  }

  async function saveRating(player: Player) {
    const draft = drafts[player.id] || { rating: "", comment: "" };
    const value = Number(draft.rating);
    if (!Number.isFinite(value) || value < 1 || value > 10) {
      alert("Inserisci un voto compreso tra 1 e 10.");
      return;
    }
    setSavingPlayerId(player.id);
    try {
      await callManager({
        action: "save_rating",
        match_id: selectedMatchId,
        player_id: player.id,
        rating: value,
        comment: draft.comment,
      });
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore salvataggio voto.");
    } finally {
      setSavingPlayerId(null);
    }
  }

  async function deleteRating(player: Player) {
    if (!window.confirm(`Eliminare il tuo voto per ${player.name}?`)) return;
    setSavingPlayerId(player.id);
    try {
      await callManager({
        action: "delete_rating",
        match_id: selectedMatchId,
        player_id: player.id,
      });
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore eliminazione voto.");
    } finally {
      setSavingPlayerId(null);
    }
  }

  async function addTournamentMatch() {
    if (!selectedCompetition) return;
    if (!newMatchName.trim() || !newMatchDate || !newMatchTime) {
      alert("Inserisci nome, data e ora della partita.");
      return;
    }
    setSavingMatch(true);
    try {
      const nextNumber = competitionMatches.filter((item) => item.competition_id === selectedCompetition.id).length + 1;
      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert({ name: newMatchName.trim(), event_date: newMatchDate, event_time: newMatchTime })
        .select("id")
        .single();
      if (eventError || !event) throw new Error(eventError?.message || "Impossibile creare la partita.");
      const { error: linkError } = await supabase.from("competition_event_matches").insert({
        competition_id: selectedCompetition.id,
        event_id: event.id,
        match_number: nextNumber,
      });
      if (linkError) throw new Error(linkError.message);
      setNewMatchName("");
      setNewMatchDate("");
      await loadData();
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore creazione partita.");
    } finally {
      setSavingMatch(false);
    }
  }

  async function recalculateWeek() {
    setRecalculating(true);
    try {
      await callManager({ action: "recalculate", week_start: selectedWeek });
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore ricalcolo.");
    } finally {
      setRecalculating(false);
    }
  }

  async function saveMinimumVotes() {
    setRecalculating(true);
    try {
      await callManager({
        action: "update_settings",
        minimum_votes: Number(minimumDraft),
        week_start: selectedWeek,
      });
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore impostazione.");
    } finally {
      setRecalculating(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-slate-400">Caricamento votazioni…</div>;
  }

  const currentMatch = matches.find((match) => match.id === selectedMatchId);

  if (view === "mvp") {
    const mvpComments = selectedMvp?.player_id
      ? ratings.filter((rating) => rating.week_start === selectedWeek && rating.player_id === selectedMvp.player_id && rating.comment)
      : [];
    const byPosition = new Map(selectedTopSlots.map((slot) => [slot.position, slot]));

    return (
      <div className="space-y-7">
        <section className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-slate-900 to-emerald-500/10 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Image src="/calcio-totale-2026-logo.png" alt="Logo ufficiale Calcio Totale 2026" width={96} height={96} unoptimized className="h-20 w-20 shrink-0 object-contain mix-blend-screen sm:h-24 sm:w-24" />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">CALCIO TOTALE</p>
                <h2 className="mt-2 text-3xl font-black">👑 MVP e Top 11</h2>
                <p className="mt-2 text-sm text-slate-400">Storico reale delle prestazioni settimanali.</p>
              </div>
            </div>
            <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold">
              {weeks.map((week) => <option key={week} value={week}>{formatWeek(week)}</option>)}
            </select>
          </div>
        </section>

        {isAdmin && (
          <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Minimo voti affidabili</label>
              <input type="number" min="1" max="50" value={minimumDraft} onChange={(event) => setMinimumDraft(event.target.value)} className="mt-2 block min-h-11 w-36 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
              <p className="mt-2 text-xs text-slate-500">Attuale: {minimumVotes}. Sotto questa soglia un giocatore resta in classifica ma non entra in Top 11/MVP.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveMinimumVotes} disabled={recalculating} className="min-h-11 rounded-xl border border-amber-300/30 px-4 py-3 text-sm font-bold text-amber-300 disabled:opacity-50">Salva soglia</button>
              <button type="button" onClick={recalculateWeek} disabled={recalculating} className="min-h-11 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{recalculating ? "⏳ Ricalcolo…" : "↻ Ricalcola"}</button>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-amber-400/30 bg-slate-900 p-6 text-center shadow-[0_0_50px_rgba(251,191,36,0.08)]">
          <p className="text-sm font-black tracking-[0.2em] text-amber-300">MVP DELLA SETTIMANA</p>
          {selectedMvp?.player_id && selectedMvp.player_name ? (
            <div className="mx-auto mt-5 max-w-xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-400/10 text-4xl">👑</div>
              <h3 className="mt-4 text-3xl font-black">{selectedMvp.player_name}</h3>
              <p className="mt-1 font-bold text-emerald-300">{selectedMvp.position}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Media" value={selectedMvp.average_rating?.toFixed(2) || "—"} />
                <Metric label="Voti" value={String(selectedMvp.votes_count || 0)} />
                <Metric label="Partite" value={String(selectedMvp.matches_count || 0)} />
                <Metric label="Rendimento" value={selectedMvp.performance_score?.toFixed(2) || "—"} />
              </div>
              {mvpComments.length > 0 && <div className="mt-5 text-left"><p className="text-sm font-black text-amber-300">Commenti</p>{mvpComments.map((rating) => <p key={rating.id} className="mt-2 rounded-xl bg-slate-950 p-3 text-sm text-slate-300">“{rating.comment}”</p>)}</div>}
            </div>
          ) : <p className="mt-5 text-slate-400">Nessun MVP idoneo: servono voti reali e almeno {minimumVotes} votazioni.</p>}
        </section>

        <section className="rounded-3xl border border-emerald-400/25 bg-slate-900 p-4 sm:p-7">
          <div className="mb-5 flex flex-col items-center text-center"><Image src="/calcio-totale-2026-logo.png" alt="Logo ufficiale Calcio Totale 2026" width={64} height={64} unoptimized className="mb-2 h-16 w-16 object-contain" /><p className="text-sm font-black tracking-[0.2em] text-emerald-300">🏆 TOP 11 DELLA SETTIMANA</p><h3 className="mt-1 text-2xl font-black">Modulo ufficiale 3-5-2</h3></div>
          <div className="rounded-3xl border border-emerald-200/15 bg-gradient-to-b from-emerald-700/35 via-emerald-800/25 to-emerald-950 p-3 sm:p-6">
            <div className="mx-auto grid max-w-3xl gap-4 text-center">
              <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3"><TopCard slot={byPosition.get("ATT (PS)")!} /><TopCard slot={byPosition.get("ATT (PD)")!} /></div>
              <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3"><TopCard slot={byPosition.get("ES")!} /><TopCard slot={byPosition.get("ED")!} /></div>
              <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3"><TopCard slot={byPosition.get("CCS")!} /><TopCard slot={byPosition.get("CCD")!} /></div>
              <div className="mx-auto w-full max-w-40"><TopCard slot={byPosition.get("CDC")!} /></div>
              <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-3"><TopCard slot={byPosition.get("DCS")!} /><TopCard slot={byPosition.get("DCC")!} /><TopCard slot={byPosition.get("DCD")!} /></div>
              <div className="mx-auto w-full max-w-40"><TopCard slot={byPosition.get("POR")!} /></div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-400/10 via-slate-900 to-slate-900 p-6 sm:p-8">
        <div className="flex items-center gap-4"><Image src="/calcio-totale-2026-logo.png" alt="Logo ufficiale Calcio Totale 2026" width={96} height={96} unoptimized className="h-20 w-20 shrink-0 object-contain mix-blend-screen sm:h-24 sm:w-24" /><div><p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">CALCIO TOTALE</p><h2 className="mt-2 text-3xl font-black">⭐ Votazioni partita</h2><p className="mt-2 text-sm text-slate-400">Voti, commenti, media e classifica sono salvati nel database.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <select value={selectedCompetitionId} onChange={(event) => setSelectedCompetitionId(event.target.value)} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold">
            <option value="">Partite singole / senza torneo</option>
            {competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}
          </select>
          <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold">
            <option value="">Seleziona una partita</option>
            {tournamentMatches.map((match, index) => <option key={match.id} value={match.id}>{selectedCompetition ? `Partita ${index + 1} — ` : ""}{match.name} — {match.event_date}</option>)}
          </select>
          <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold">
            {weeks.map((week) => <option key={week} value={week}>{formatWeek(week)}</option>)}
          </select>
        </div>
        {selectedCompetition && <p className="mt-3 text-sm text-emerald-200">🏆 {selectedCompetition.name}: {tournamentMatches.length} {tournamentMatches.length === 1 ? "partita" : "partite"} con votazioni separate.</p>}
      </section>

      {isAdmin && selectedCompetition && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <h3 className="text-xl font-black">⚽ Partite di {selectedCompetition.name}</h3>
          <p className="mt-1 text-sm text-slate-500">Ogni partita creata qui avrà presenze e votazioni indipendenti.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-[1.3fr_1fr_120px_auto]">
            <input value={newMatchName} onChange={(event) => setNewMatchName(event.target.value)} placeholder={`Es. ${selectedCompetition.name} — Partita ${tournamentMatches.length + 1}`} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <input type="date" value={newMatchDate} onChange={(event) => setNewMatchDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <input type="time" value={newMatchTime} onChange={(event) => setNewMatchTime(event.target.value)} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <button type="button" onClick={() => void addTournamentMatch()} disabled={savingMatch} className="min-h-11 rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950 disabled:opacity-50">{savingMatch ? "⏳" : "➕ Partita"}</button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tournamentMatches.map((match, index) => <button type="button" key={match.id} onClick={() => setSelectedMatchId(match.id)} className={`rounded-xl border p-3 text-left ${match.id === selectedMatchId ? "border-emerald-400 bg-emerald-400/10" : "border-slate-700 bg-slate-950"}`}><p className="font-black">⚽ Partita {index + 1}</p><p className="mt-1 text-sm text-slate-300">{match.name}</p><p className="mt-1 text-xs text-slate-500">{match.event_date}</p></button>)}</div>
        </section>
      )}

      {isAdmin && currentMatch && (
        <section className="rounded-3xl border border-emerald-400/25 bg-slate-900 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black">Inserisci i voti</h3><p className="mt-1 text-sm text-slate-500">Solo i giocatori segnati “Presente” in {currentMatch.name} possono essere votati.</p></div><button type="button" onClick={recalculateWeek} disabled={recalculating} className="min-h-11 rounded-xl border border-emerald-400/30 px-4 py-3 text-sm font-bold text-emerald-300 disabled:opacity-50">{recalculating ? "⏳ Ricalcolo…" : "↻ Ricalcola settimana"}</button></div>
          {matchParticipants.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-slate-400">Non risultano giocatori presenti: prima registra le presenze per questa partita.</p> : <div className="mt-5 space-y-4">{matchParticipants.map((player) => {
            const draft = drafts[player.id] || { rating: "", comment: "" };
            const hasOwnRating = selectedMatchRatings.some((rating) => rating.player_id === player.id && rating.admin_id === viewerId);
            return <div key={player.id} className="rounded-2xl bg-slate-950 p-4"><div className="flex items-center gap-3"><PlayerAvatar name={player.name} /><div><p className="font-black">{player.name}</p><p className="text-sm text-emerald-300">{player.eventRole}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-[130px_1fr_auto_auto]"><input aria-label={`Voto ${player.name}`} type="number" min="1" max="10" step="0.5" value={draft.rating} onChange={(event) => setDrafts((current) => ({...current, [player.id]: {...draft, rating: event.target.value}}))} placeholder="Voto 1-10" className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3" /><input aria-label={`Commento ${player.name}`} value={draft.comment} onChange={(event) => setDrafts((current) => ({...current, [player.id]: {...draft, comment: event.target.value}}))} maxLength={1000} placeholder="Commento facoltativo" className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3" /><button type="button" onClick={() => saveRating(player)} disabled={savingPlayerId === player.id} className="min-h-11 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{savingPlayerId === player.id ? "⏳" : "Salva"}</button>{hasOwnRating && <button type="button" onClick={() => deleteRating(player)} disabled={savingPlayerId === player.id} className="min-h-11 rounded-xl border border-red-400/30 px-4 py-3 text-sm font-bold text-red-300 disabled:opacity-50">Elimina</button>}</div></div>;
          })}</div>}
        </section>
      )}

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
        <h3 className="text-xl font-black">Voti e commenti della partita</h3>
        {!currentMatch ? <p className="mt-4 text-sm text-slate-500">Seleziona una partita per vedere i risultati.</p> : matchParticipants.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nessun giocatore presente registrato.</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">{matchParticipants.map((player) => {
          const entries = selectedMatchRatings.filter((rating) => rating.player_id === player.id);
          return <div key={player.id} className="rounded-2xl bg-slate-950 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><PlayerAvatar name={player.name} /><div><p className="font-bold">{player.name}</p><p className="text-sm text-emerald-300">{player.eventRole}</p></div></div><VoteScore value={average(entries)} /></div><p className="mt-3 text-xs text-slate-500">{entries.length} votazioni ricevute</p>{entries.filter((entry) => entry.comment).map((entry) => <p key={entry.id} className="mt-2 rounded-xl bg-slate-900 p-3 text-sm text-slate-300">“{entry.comment}”</p>)}</div>;
        })}</div>}
      </section>

      {selectedCompetition && (
        <section className="rounded-3xl border border-amber-400/25 bg-slate-900 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-xl font-black">🏆 Classifica {selectedCompetition.name}</h3><p className="mt-1 text-sm text-slate-500">Media calcolata solo sulle partite del torneo in cui il giocatore ha ricevuto un voto.</p></div>{tournamentMvp && <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm"><p className="font-black text-amber-200">👑 MVP torneo</p><p className="mt-1 font-bold">{tournamentMvp.player.name} — {tournamentMvp.average.toFixed(2)}</p><p className="text-slate-400">{tournamentMvp.matches} partite · totale {tournamentMvp.total.toFixed(1)}</p></div>}</div>
          {tournamentRanking.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-slate-500">Nessun voto ancora inserito per questo torneo.</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-700 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">#</th><th className="px-3 py-3">Giocatore</th><th className="px-3 py-3">Ruolo</th><th className="px-3 py-3">Media</th><th className="px-3 py-3">Partite</th><th className="px-3 py-3">Somma</th></tr></thead><tbody>{tournamentRanking.map((rating, index) => <tr key={rating.player.id} className="border-b border-slate-800"><td className="px-3 py-4 font-black text-amber-300">{index + 1}</td><td className="px-3 py-4 font-bold">{rating.player.name}</td><td className="px-3 py-4 text-emerald-300">{rating.player.position}</td><td className="px-3 py-4 font-black">{rating.average.toFixed(2)}</td><td className="px-3 py-4">{rating.matches}</td><td className="px-3 py-4">{rating.total.toFixed(1)}</td></tr>)}</tbody></table></div>}
        </section>
      )}

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black">📊 Classifica settimanale</h3><p className="mt-1 text-sm text-slate-500">Rendimento = media voto con fattore di affidabilità su voti e partite.</p></div><span className="rounded-xl bg-slate-950 px-3 py-2 text-sm text-slate-400">Minimo Top 11/MVP: {minimumVotes} voti</span></div>
        {selectedWeekRatings.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-slate-500">Nessun voto salvato per {formatWeek(selectedWeek)}.</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-700 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">#</th><th className="px-3 py-3">Giocatore</th><th className="px-3 py-3">Ruolo</th><th className="px-3 py-3">Media</th><th className="px-3 py-3">Voti</th><th className="px-3 py-3">Partite</th><th className="px-3 py-3">Rendimento</th></tr></thead><tbody>{selectedWeekRatings.map((rating, index) => <tr key={rating.id} className="border-b border-slate-800"><td className="px-3 py-4 font-black text-amber-300">{index + 1}</td><td className="px-3 py-4 font-bold">{rating.player_name}</td><td className="px-3 py-4 text-emerald-300">{rating.position}</td><td className="px-3 py-4">{rating.average_rating.toFixed(2)}</td><td className="px-3 py-4">{rating.votes_count}</td><td className="px-3 py-4">{rating.matches_count}</td><td className="px-3 py-4 font-black">{rating.performance_score.toFixed(2)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-950 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}
