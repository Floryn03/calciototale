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
      <div ref={ref} className={`relative aspect-[374/508] w-full select-none overflow-hidden ${className}`}>
        {/* Template grafico ufficiale fornito da Calcio Totale: sempre mantenuto nelle sue proporzioni originali. */}
        <img src="/calcio-totale-player-card-2026.png" alt="Player Card Calcio Totale 2026" className="absolute inset-0 z-10 h-full w-full object-contain" />

        {card.show_photo && (
          <div className="absolute left-[14%] top-[15%] z-20 h-[45%] w-[72%] overflow-hidden rounded-[28%_28%_18%_18%] border border-fuchsia-200/55 bg-slate-950/45 shadow-[0_0_24px_rgba(236,72,153,.4)]">
            {card.photo_url ? <img src={card.photo_url} alt="Foto giocatore" className="h-full w-full object-cover object-top" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950 via-violet-950 to-fuchsia-950 text-5xl font-black text-white/90">{player.name.slice(0, 2).toUpperCase()}</div>}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-violet-950/80 to-transparent" />
          </div>
        )}

        <div className="absolute inset-x-[10%] top-[62%] z-30 text-white [text-shadow:0_2px_5px_rgba(15,23,42,.95)]">
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-end gap-2">
              {card.show_ovr && <span className="text-[clamp(2rem,10vw,4.1rem)] font-black leading-none">{ovr}</span>}
              {card.show_role && <span className="mb-1 rounded-md border border-white/35 bg-indigo-950/65 px-2 py-1 text-[clamp(.65rem,2.4vw,1rem)] font-black">{player.position}</span>}
            </div>
            {card.show_number && <span className="mb-1 text-[clamp(1.15rem,5vw,2rem)] font-black">#{player.shirt_number}</span>}
          </div>
          {card.show_name && <p className="mt-1 truncate text-[clamp(1rem,4.1vw,1.75rem)] font-black uppercase tracking-tight">{player.name}</p>}
          {card.show_id && <p className="mt-0.5 truncate text-[clamp(.58rem,2.2vw,.85rem)] font-bold tracking-wide text-fuchsia-100">ID EA · {player.psn_id}</p>}
        </div>

        <div className="absolute inset-x-[11%] top-[78%] z-30 grid grid-cols-3 gap-x-1 gap-y-2 text-center [text-shadow:0_2px_4px_rgba(15,23,42,.95)]">
          {stats.map(([visible, label, value]) => card[visible] && <div key={label} className="leading-none"><span className="block text-[clamp(.85rem,3.5vw,1.35rem)] font-black text-white">{card[value] as number}</span><span className="mt-0.5 block text-[clamp(.42rem,1.6vw,.62rem)] font-black tracking-[.15em] text-cyan-100">{label}</span></div>)}
        </div>
      </div>
    );
  }
);

PlayerCard.displayName = "PlayerCard";
export default PlayerCard;
