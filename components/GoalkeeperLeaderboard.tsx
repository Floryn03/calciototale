"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type GoalkeeperEntry = { player_id: string; player_name: string; matches_played: number; clean_sheets: number };

export function GoalkeeperLeaderboardCard({ entries, loading = false, error = false }: { entries: GoalkeeperEntry[]; loading?: boolean; error?: boolean }) {
  const ranked = [...entries].sort((a, b) => b.matches_played - a.matches_played || b.clean_sheets - a.clean_sheets || a.player_name.localeCompare(b.player_name, "it"));
  return <section className="rounded-3xl border border-emerald-500/30 bg-slate-900 p-5 sm:p-7 lg:col-span-2" aria-labelledby="goalkeeper-leaderboard-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="goalkeeper-leaderboard-title" className="text-xl font-bold">🧤 Classifica clean sheet portieri</h3>
        <p className="mt-1 text-sm text-slate-400">Partite senza subire gol, giocate nel ruolo POR nei referti registrati.</p></div>
      <span className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300">STAGIONE</span>
    </div>
    <p className="mt-3 text-xs text-slate-400">Prima chi ha più partite in porta; a parità di partite, chi ha più clean sheet.</p>
    <div className="mt-5" aria-live="polite" aria-busy={loading}>
      {error ? <p role="status" className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-400">Classifica temporaneamente non disponibile. Riprovo automaticamente.</p>
        : loading ? <p className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-400">Caricamento classifica portieri…</p>
        : ranked.length === 0 ? <p className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-400">Nessuna partita in porta registrata ancora.</p>
        : <ol className="space-y-2">{ranked.map((entry, index) => <li key={entry.player_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-slate-950 px-4 py-4 sm:px-5">
          <span className="text-lg font-black text-emerald-300">{index + 1}</span>
          <span className="min-w-0 flex-1 break-words text-sm font-bold sm:text-base">{entry.player_name}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="text-slate-400">{entry.matches_played} {Number(entry.matches_played) === 1 ? "partita" : "partite"} in porta</span>
            <span className="rounded-lg bg-emerald-500/10 px-3 py-1 font-black text-emerald-300">{entry.clean_sheets} clean sheet</span>
          </div>
        </li>)}</ol>}
    </div>
  </section>;
}

export default function GoalkeeperLeaderboard() {
  const [entries, setEntries] = useState<GoalkeeperEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const result = await supabase.rpc("dashboard_goalkeeper_totals");
        if (cancelled) return;
        setError(Boolean(result.error));
        if (!result.error) setEntries((result.data || []) as GoalkeeperEntry[]);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        pending = false;
        if (!cancelled) setLoading(false);
      }
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);
  return <GoalkeeperLeaderboardCard entries={entries} loading={loading} error={error} />;
}
