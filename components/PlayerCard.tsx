"use client";

import { forwardRef } from "react";

export type CardPlayer = {
  id: string;
  name: string;
  psn_id: string;
  shirt_number: number;
  position: string;
};

export type PlayerCardData = {
  photo_url: string | null;
  ovr_mode: "automatic" | "manual";
  manual_ovr: number | null;
  velocity: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  show_photo: boolean;
  show_name: boolean;
  show_id: boolean;
  show_number: boolean;
  show_role: boolean;
  show_ovr: boolean;
  show_velocity: boolean;
  show_shooting: boolean;
  show_passing: boolean;
  show_dribbling: boolean;
  show_defending: boolean;
  show_physical: boolean;
};

export const emptyPlayerCard = (): PlayerCardData => ({
  photo_url: null,
  ovr_mode: "automatic",
  manual_ovr: null,
  velocity: 50,
  shooting: 50,
  passing: 50,
  dribbling: 50,
  defending: 50,
  physical: 50,
  show_photo: true,
  show_name: true,
  show_id: true,
  show_number: true,
  show_role: true,
  show_ovr: true,
  show_velocity: true,
  show_shooting: true,
  show_passing: true,
  show_dribbling: true,
  show_defending: true,
  show_physical: true,
});

export function calculateOvr(card: PlayerCardData) {
  if (card.ovr_mode === "manual" && card.manual_ovr !== null) return card.manual_ovr;
  return Math.round((card.velocity + card.shooting + card.passing + card.dribbling + card.defending + card.physical) / 6);
}

const stats: Array<[keyof PlayerCardData, string, keyof PlayerCardData]> = [
  ["show_velocity", "VEL", "velocity"],
  ["show_shooting", "TIR", "shooting"],
  ["show_passing", "PAS", "passing"],
  ["show_dribbling", "DRI", "dribbling"],
  ["show_defending", "DIF", "defending"],
  ["show_physical", "FIS", "physical"],
];

const PlayerCard = forwardRef<HTMLDivElement, { player: CardPlayer; card: PlayerCardData; className?: string }>(
  ({ player, card, className = "" }, ref) => {
    const ovr = calculateOvr(card);
    return (
      <div ref={ref} className={`relative aspect-[2/3] w-full overflow-hidden ${className}`}>
        {/* Template ufficiale: è un asset fisso e non viene mai modificato dall'editor. */}
        <img
          src="/calcio-totale-player-card-template.png"
          alt="Player Card ufficiale Calcio Totale"
          className="absolute inset-0 h-full w-full object-contain"
        />

        {card.show_photo && (
          <div className="absolute left-1/2 top-[12%] h-[27%] w-[48%] -translate-x-1/2 overflow-hidden rounded-full border-4 border-amber-500/70 bg-slate-900 shadow-[0_0_24px_rgba(180,120,20,.35)]">
            {card.photo_url ? (
              <img src={card.photo_url} alt="Foto giocatore" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-950 text-5xl font-black text-amber-300">
                {player.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className="absolute left-[10%] top-[43%] flex max-w-[80%] items-end gap-3 text-slate-900">
          {card.show_ovr && <span className="text-5xl font-black leading-none drop-shadow-sm">{ovr}</span>}
          {card.show_role && <span className="mb-1 rounded bg-amber-500/85 px-2 py-1 text-sm font-black">{player.position}</span>}
        </div>
        {card.show_name && <p className="absolute left-[10%] top-[51%] max-w-[80%] truncate text-2xl font-black uppercase tracking-tight text-slate-900">{player.name}</p>}
        {card.show_id && <p className="absolute left-[10%] top-[56%] max-w-[80%] truncate text-sm font-bold tracking-wide text-slate-700">{player.psn_id}</p>}
        {card.show_number && <p className="absolute right-[10%] top-[55%] text-xl font-black text-amber-700">#{player.shirt_number}</p>}

        <div className="absolute left-[10%] right-[10%] top-[63%] grid grid-cols-3 gap-x-2 gap-y-3 text-slate-900">
          {stats.map(([visible, label, value]) => card[visible] && (
            <div key={label} className="text-center leading-none">
              <span className="block text-xl font-black">{card[value] as number}</span>
              <span className="mt-1 block text-[10px] font-black tracking-[0.16em] text-amber-800">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

PlayerCard.displayName = "PlayerCard";
export default PlayerCard;
