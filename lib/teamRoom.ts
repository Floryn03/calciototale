export type RoomRating = { match_id: string; player_id: string; rating: number };
export type RoomEvent = { id: string; event_date: string; event_time?: string | null };
export type RoomReport = { match_id: string; team_score: number; opponent_score: number };
export function roomWeek(date = new Date()) {
  const day = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  const monday = new Date(day + 'T12:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
export function weekEnd(start: string) { const d = new Date(start + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0,10); }
export function growthPlayers(ratings: RoomRating[], events: RoomEvent[], reports: RoomReport[]) {
  const recorded = new Set(reports.map(r => r.match_id));
  const dates = new Map(events.map(e => [e.id, e.event_date + (e.event_time || '')]));
  const players = new Map<string, Map<string, number[]>>();
  for (const r of ratings) {
    if (!recorded.has(r.match_id) || !dates.has(r.match_id) || !Number.isFinite(Number(r.rating))) continue;
    if (!players.has(r.player_id)) players.set(r.player_id, new Map());
    const games = players.get(r.player_id)!;
    games.set(r.match_id, [...(games.get(r.match_id) || []), Number(r.rating)]);
  }
  const mean = (values: number[]) => values.reduce((a,b)=>a+b,0)/values.length;
  return [...players].flatMap(([player_id,games]) => {
    const last = [...games].sort((a,b)=>dates.get(b[0])!.localeCompare(dates.get(a[0])!) || a[0].localeCompare(b[0])).slice(0,6);
    if(last.length<6) return [];
    const values=last.map(([,v])=>mean(v)); const recent=mean(values.slice(0,3)), previous=mean(values.slice(3));
    return recent-previous>0.005 ? [{player_id,recent,previous,improvement:recent-previous}] : [];
  }).sort((a,b)=>b.improvement-a.improvement || b.recent-a.recent || a.player_id.localeCompare(b.player_id));
}
export function goalProgress(metric: string, manual: number, start: string, events: RoomEvent[], reports: RoomReport[], stats: {match_id:string;goals:number;assists:number}[]) {
  if(metric==='manual') return manual;
  const dates=new Set(events.filter(e=>e.event_date>=start&&e.event_date<=weekEnd(start)).map(e=>e.id));
  const matches=reports.filter(r=>dates.has(r.match_id));
  if(metric==='wins') return matches.filter(r=>r.team_score>r.opponent_score).length;
  const saved=new Set(matches.map(r=>r.match_id));
  return stats.filter(s=>saved.has(s.match_id)).reduce((total,s)=>total+Number(metric==='goals'?s.goals:s.assists),0);
}
export function safeVideoUrl(value: string) { try { const url = new URL(value); return url.protocol==='https:' ? url.href : null; } catch { return null; } }
