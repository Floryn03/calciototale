"use client";

import { forwardRef } from "react";

export type CardPlayer = {
  id: string;
  name: string;
  psn_id: string;
  shirt_number: number;
  position: string;
};
export const cardLayoutKeys = [
  "photo",
  "ovr",
  "role",
  "name",
  "id",
  "number",
  "velocity",
  "shooting",
  "passing",
  "dribbling",
  "defending",
  "physical",
] as const;
export type CardLayoutKey = (typeof cardLayoutKeys)[number];
export type CardLayoutValue = { x: number; y: number; scale: number };
export type PlayerCardLayout = Partial<Record<CardLayoutKey, CardLayoutValue>>;

export const defaultPlayerCardLayout = (): Record<
  CardLayoutKey,
  CardLayoutValue
> => ({
  photo: { x: 50, y: 39, scale: 100 },
  ovr: { x: 16, y: 23, scale: 100 },
  role: { x: 16, y: 30, scale: 100 },
  name: { x: 39, y: 76, scale: 100 },
  id: { x: 31, y: 80, scale: 100 },
  number: { x: 87, y: 76, scale: 100 },
  velocity: { x: 15, y: 88.5, scale: 100 },
  shooting: { x: 30, y: 88.5, scale: 100 },
  passing: { x: 45, y: 88.5, scale: 100 },
  dribbling: { x: 60, y: 88.5, scale: 100 },
  defending: { x: 75, y: 88.5, scale: 100 },
  physical: { x: 90, y: 88.5, scale: 100 },
});

export function resolvePlayerCardLayout(layout?: PlayerCardLayout | null) {
  const defaults = defaultPlayerCardLayout();
  return cardLayoutKeys.reduce(
    (result, key) => ({
      ...result,
      [key]: { ...defaults[key], ...(layout?.[key] || {}) },
    }),
    {} as Record<CardLayoutKey, CardLayoutValue>,
  );
}

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
  layout: PlayerCardLayout;
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
  layout: defaultPlayerCardLayout(),
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

const stats: Array<
  [keyof PlayerCardData, string, CardLayoutKey, keyof PlayerCardData]
> = [
  ["show_velocity", "VEL", "velocity", "velocity"],
  ["show_shooting", "TIR", "shooting", "shooting"],
  ["show_passing", "PAS", "passing", "passing"],
  ["show_dribbling", "DRI", "dribbling", "dribbling"],
  ["show_defending", "DIF", "defending", "defending"],
  ["show_physical", "FIS", "physical", "physical"],
];

const PlayerCard = forwardRef<
  HTMLDivElement,
  { player: CardPlayer; card: PlayerCardData; className?: string }
>(({ player, card, className = "" }, ref) => {
  const ovr = calculateOvr(card);
  const layout = resolvePlayerCardLayout(card.layout);
  const itemStyle = (key: CardLayoutKey) => ({
    left: `${layout[key].x}%`,
    top: `${layout[key].y}%`,
    transform: `translate(-50%, -50%) scale(${layout[key].scale / 100})`,
  });
  const photoStyle = {
    left: `${layout.photo.x}%`,
    top: `${layout.photo.y}%`,
    width: `${(86 * layout.photo.scale) / 100}%`,
    height: `${(68 * layout.photo.scale) / 100}%`,
    transform: "translate(-50%, -50%)",
  };
  return (
    <div
      ref={ref}
      className={`relative aspect-[2/3] w-full select-none ${className}`}
    >
      <img
        src="/calcio-totale-player-card-2026.png"
        alt="Player Card Calcio Totale 2026"
        className="absolute inset-0 z-10 h-full w-full object-fill"
      />
      {card.show_photo && (
        <div style={photoStyle} className="pointer-events-none absolute z-20">
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
      {card.show_ovr && (
        <span
          style={itemStyle("ovr")}
          className="absolute z-30 text-[clamp(2.2rem,11vw,4.4rem)] font-black leading-none text-[#fff6d5] [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          {ovr}
        </span>
      )}
      {card.show_role && (
        <span
          style={itemStyle("role")}
          className="absolute z-30 text-[clamp(.75rem,3vw,1.25rem)] font-black leading-none text-[#fff6d5] [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          {player.position}
        </span>
      )}
      {card.show_name && (
        <p
          style={itemStyle("name")}
          className="absolute z-30 max-w-[76%] truncate text-[clamp(1.15rem,5vw,2.1rem)] font-black uppercase leading-none tracking-tight text-white [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          {player.name}
        </p>
      )}
      {card.show_id && (
        <p
          style={itemStyle("id")}
          className="absolute z-30 max-w-[76%] truncate text-[clamp(.58rem,2.3vw,.9rem)] font-bold tracking-wide text-white [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          ID EA: {player.psn_id}
        </p>
      )}
      {card.show_number && (
        <span
          style={itemStyle("number")}
          className="absolute z-30 text-[clamp(1rem,4.6vw,1.85rem)] font-black leading-none text-[#fff6d5] [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          #{player.shirt_number}
        </span>
      )}
      {stats.map(
        ([visible, label, key, value]) =>
          card[visible] && (
            <div
              key={label}
              style={itemStyle(key)}
              className="absolute z-30 text-center leading-none text-[#fff6d5] [text-shadow:0_2px_4px_rgba(15,23,42,.95)]"
            >
              <span className="block text-[clamp(.86rem,3.8vw,1.55rem)] font-black">
                {card[value] as number}
              </span>
              <span className="mt-1 block text-[clamp(.42rem,1.7vw,.68rem)] font-black tracking-tight text-white">
                {label}
              </span>
            </div>
          ),
      )}
    </div>
  );
});

PlayerCard.displayName = "PlayerCard";
export default PlayerCard;
