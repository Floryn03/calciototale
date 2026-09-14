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
  if (card.ovr_mode === "manual" && card.manual_ovr !== null)
    return card.manual_ovr;
  return Math.round(
    (card.velocity +
      card.shooting +
      card.passing +
      card.dribbling +
      card.defending +
      card.physical) /
      6,
  );
}

const stats: Array<[keyof PlayerCardData, string, keyof PlayerCardData]> = [
  ["show_velocity", "VEL", "velocity"],
  ["show_shooting", "TIR", "shooting"],
  ["show_passing", "PAS", "passing"],
  ["show_dribbling", "DRI", "dribbling"],
  ["show_defending", "DIF", "defending"],
  ["show_physical", "FIS", "physical"],
];

const PlayerCard = forwardRef<
  HTMLDivElement,
  { player: CardPlayer; card: PlayerCardData; className?: string }
>(({ player, card, className = "" }, ref) => {
  const ovr = calculateOvr(card);
  return (
    <div
      ref={ref}
      className={`relative aspect-[2/3] w-full select-none ${className}`}
    >
      {/* Template grafico ufficiale fornito da Calcio Totale: sempre mantenuto nelle sue proporzioni originali. */}
      <img
        src="/calcio-totale-player-card-2026.png"
        alt="Player Card Calcio Totale 2026"
        className="absolute inset-0 z-10 h-full w-full object-fill"
      />

      {card.show_photo && (
        <div className="pointer-events-none absolute inset-x-[7%] top-[7%] z-20 h-[64%]">
          {card.photo_url ? (
            <img
              src={card.photo_url}
              alt="Foto giocatore"
              className="h-full w-full object-contain object-bottom"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[clamp(3rem,14vw,6rem)] font-black text-white/80">
              {player.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="absolute left-[10%] top-[17%] z-30 flex min-w-[22%] flex-col items-center text-[#fff6d5] [text-shadow:0_2px_5px_rgba(15,23,42,.95)]">
        {card.show_ovr && (
          <span className="text-[clamp(2.2rem,11vw,4.4rem)] font-black leading-none">
            {ovr}
          </span>
        )}
        {card.show_role && (
          <span className="mt-1 text-[clamp(.75rem,3vw,1.25rem)] font-black leading-none">
            {player.position}
          </span>
        )}
      </div>

      <div className="absolute inset-x-[10%] top-[73%] z-30 text-white [text-shadow:0_2px_5px_rgba(15,23,42,.95)]">
        <div className="flex items-end justify-between gap-2">
          {card.show_name ? (
            <p className="min-w-0 truncate text-[clamp(1.15rem,5vw,2.1rem)] font-black uppercase leading-none tracking-tight">
              {player.name}
            </p>
          ) : (
            <span />
          )}
          {card.show_number && (
            <span className="shrink-0 text-[clamp(1rem,4.6vw,1.85rem)] font-black leading-none text-[#fff6d5]">
              #{player.shirt_number}
            </span>
          )}
        </div>
        {card.show_id && (
          <p className="mt-[3%] truncate text-[clamp(.58rem,2.3vw,.9rem)] font-bold tracking-wide text-white/95">
            ID EA: {player.psn_id}
          </p>
        )}
      </div>

      <div className="absolute inset-x-[8%] top-[86%] z-30 grid grid-cols-6 divide-x divide-fuchsia-200/70 text-center text-[#fff6d5] [text-shadow:0_2px_4px_rgba(15,23,42,.95)]">
        {stats.map(([visible, label, value]) => (
          <div
            key={label}
            className={`min-w-0 px-[3%] leading-none ${card[visible] ? "" : "invisible"}`}
          >
            <span className="block text-[clamp(.86rem,3.8vw,1.55rem)] font-black">
              {card[value] as number}
            </span>
            <span className="mt-1 block text-[clamp(.42rem,1.7vw,.68rem)] font-black tracking-tight text-white">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

PlayerCard.displayName = "PlayerCard";
export default PlayerCard;
