"use client";

/* Reads only the existing public team data; no player profile data is invented. */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Player = {
  id: string;
  name: string;
  psn_id: string;
  shirt_number: number;
  position: string;
  status: string;
};

type WeeklyHistory = {
  id: string;
  week_start: string;
  average_rating: number;
  votes_count: number;
  matches_count: number;
  performance_score: number;
};

function formatWeek(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function PlayerProfileModal({
  player,
  onClose,
}: {
  player: Player;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [presences, setPresences] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [top11Count, setTop11Count] = useState(0);
  const [mvpCount, setMvpCount] = useState(0);
  const [history, setHistory] = useState<WeeklyHistory[]>([]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      const [presenceResult, ratingResult, top11Result, mvpResult, historyResult] =
        await Promise.all([
          supabase.from("presences").select("status").eq("player_id", player.id),
          supabase.from("match_ratings").select("rating").eq("player_id", player.id),
          supabase.from("weekly_top_11").select("id").eq("player_id", player.id),
          supabase.from("weekly_mvp").select("id").eq("player_id", player.id),
          supabase
            .from("weekly_player_ratings")
            .select("id, week_start, average_rating, votes_count, matches_count, performance_score")
            .eq("player_id", player.id)
            .order("week_start", { ascending: false }),
        ]);

      if (!active) return;
      const presenceRows = presenceResult.data || [];
      setPresences(presenceRows.length);
      setPresentCount(presenceRows.filter((item) => item.status === "Presente").length);
      setRatings((ratingResult.data || []).map((item) => Number(item.rating)));
      setTop11Count((top11Result.data || []).length);
      setMvpCount((mvpResult.data || []).length);
      setHistory((historyResult.data || []) as WeeklyHistory[]);
      setLoading(false);
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [player.id]);

  const averageRating = useMemo(() => {
    if (!ratings.length) return null;
    return ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
  }, [ratings]);

  const overall = averageRating === null ? "—" : String(Math.round(averageRating * 10));

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-emerald-400/30 bg-slate-900 p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <p className="font-black uppercase tracking-[0.2em] text-emerald-300">Calcio Totale 2026</p>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-xl border border-slate-700 text-xl text-slate-300 hover:bg-slate-800" aria-label="Chiudi profilo giocatore">✕</button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="overflow-hidden rounded-3xl border border-amber-300/35 bg-gradient-to-br from-amber-400/20 via-slate-900 to-emerald-500/15 p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-300/30 bg-slate-950/80 text-2xl font-black text-emerald-300">
                {player.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="rounded-2xl border border-amber-300/40 bg-slate-950/80 px-4 py-2 text-center"><p className="text-[10px] font-bold uppercase text-amber-200">Overall</p><p className="text-3xl font-black text-amber-300">{overall}</p></div>
            </div>
            <p className="mt-6 text-sm font-black tracking-[0.2em] text-emerald-300">{player.position}</p>
            <h2 className="mt-2 text-3xl font-black uppercase">{player.name}</h2>
            <p className="mt-2 text-sm text-slate-400">PSN: {player.psn_id} · Maglia #{player.shirt_number}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-center">
              <CardMetric label="Presenze" value={`${presentCount}/${presences}`} />
              <CardMetric label="Media voto" value={averageRating?.toFixed(2) || "—"} />
              <CardMetric label="Top 11" value={String(top11Count)} />
              <CardMetric label="MVP" value={String(mvpCount)} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-700 bg-slate-950 p-5 sm:p-7">
            <h3 className="text-xl font-black">Attributi giocatore</h3>
            <p className="mt-1 text-sm text-slate-500">Velocità, fisico, tiro, passaggio, dribbling e difesa saranno mostrati qui quando verranno registrati dati reali.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["VEL", "Velocità"], ["FIS", "Fisico"], ["TIR", "Tiro"],
                ["PAS", "Passaggio"], ["DRI", "Dribbling"], ["DIF", "Difesa"],
              ].map(([short, label]) => <TechnicalMetric key={short} short={short} label={label} />)}
            </div>
            <div className="mt-7 border-t border-slate-800 pt-5">
              <h3 className="text-xl font-black">Storico rendimento</h3>
              {loading ? <p className="mt-3 text-sm text-slate-500">Caricamento dati reali…</p> : history.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nessun rendimento settimanale ancora calcolato.</p> : <div className="mt-4 space-y-2">{history.map((week) => <div key={week.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl bg-slate-900 p-3 text-sm"><span className="font-bold">{formatWeek(week.week_start)}</span><span className="font-mono text-emerald-300">Media {Number(week.average_rating).toFixed(2)}</span><span className="font-black text-amber-300">{Number(week.performance_score).toFixed(2)}</span></div>)}</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-950/80 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}

function TechnicalMetric({ short, label }: { short: string; label: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><p className="text-xs font-black text-emerald-300">{short} <span className="text-slate-400">—</span></p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}
