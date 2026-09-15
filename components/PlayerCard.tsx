"use client";

import { forwardRef, useRef } from "react";

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
  "extra_photo_1",
  "extra_photo_2",
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
  extra_photo_1: { x: 22, y: 52, scale: 100 },
  extra_photo_2: { x: 78, y: 52, scale: 100 },
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
  extra_photo_1_url: string | null;
  extra_photo_2_url: string | null;
  display_name: string | null;
  display_id: string | null;
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
  extra_photo_1_url: null,
  extra_photo_2_url: null,
  display_name: null,
  display_id: null,
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


export const extraPhotoSlots = ["extra_photo_1", "extra_photo_2"] as const;
export type ExtraPhotoSlot = (typeof extraPhotoSlots)[number];

export async function drawExtraCardPhotos(
  context: CanvasRenderingContext2D,
  card: PlayerCardData,
  loadImage: (source: string) => Promise<HTMLImageElement>,
) {
  const layout = resolvePlayerCardLayout(card.layout);
  for (const key of extraPhotoSlots) {
    const source = card[`${key}_url`];
    if (!source) continue;
    const image = await loadImage(source);
    const position = layout[key];
    const size = context.canvas.width * 0.24 * position.scale / 100;
    const ratio = Math.min(size / image.width, size / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    context.drawImage(image,
      context.canvas.width * position.x / 100 - width / 2,
      context.canvas.height * position.y / 100 - height / 2,
      width, height);
  }
}

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

function CardItem({
  editable,
  layoutKey,
  value,
  onChange,
  style,
  className,
  children,
}: {
  editable?: boolean;
  layoutKey: CardLayoutKey;
  value: CardLayoutValue;
  onChange?: (key: CardLayoutKey, update: Partial<CardLayoutValue>) => void;
  style: Record<string, string>;
  className: string;
  children: React.ReactNode;
}) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({
    x: value.x,
    y: value.y,
    scale: value.scale,
    pointX: 0,
    pointY: 0,
    distance: 0,
  });
  const clamp = (number: number, min: number, max: number) =>
    Math.max(min, Math.min(max, number));
  const begin = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !onChange) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const values = [...pointers.current.values()];
    start.current = {
      x: value.x,
      y: value.y,
      scale: value.scale,
      pointX: values[0].x,
      pointY: values[0].y,
      distance:
        values.length > 1
          ? Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)
          : 0,
    };
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !onChange || !pointers.current.has(event.pointerId))
      return;
    event.preventDefault();
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const values = [...pointers.current.values()];
    if (values.length > 1 && start.current.distance > 0) {
      const distance = Math.hypot(
        values[0].x - values[1].x,
        values[0].y - values[1].y,
      );
      onChange(layoutKey, {
        scale: clamp(
          (start.current.scale * distance) / start.current.distance,
          35,
          220,
        ),
      });
      return;
    }
    const card = event.currentTarget.parentElement;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    onChange(layoutKey, {
      x: clamp(
        start.current.x +
          ((event.clientX - start.current.pointX) / rect.width) * 100,
        0,
        100,
      ),
      y: clamp(
        start.current.y +
          ((event.clientY - start.current.pointY) / rect.height) * 100,
        0,
        100,
      ),
    });
  };
  const finish = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };
  return (
    <div
      style={style}
      className={`${className} ${editable ? "cursor-move touch-none outline outline-1 outline-cyan-300/60 hover:outline-cyan-200" : ""}`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onWheel={(event) => {
        if (!editable || !onChange) return;
        event.preventDefault();
        onChange(layoutKey, {
          scale: clamp(value.scale + (event.deltaY < 0 ? 5 : -5), 35, 220),
        });
      }}
    >
      {children}
    </div>
  );
}

const PlayerCard = forwardRef<
  HTMLDivElement,
  {
    player: CardPlayer;
    card: PlayerCardData;
    className?: string;
    editable?: boolean;
    onLayoutChange?: (
      key: CardLayoutKey,
      update: Partial<CardLayoutValue>,
    ) => void;
  }
>(({ player, card, className = "", editable = false, onLayoutChange }, ref) => {
  const ovr = calculateOvr(card);
  const displayName = card.display_name?.trim() || player.name;
  const displayId = card.display_id?.trim() || player.psn_id;
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
        <CardItem
          editable={editable}
          layoutKey="photo"
          value={layout.photo}
          onChange={onLayoutChange}
          style={photoStyle}
          className="absolute z-20"
        >
          {card.photo_url ? (
            <img
              src={card.photo_url}
              alt="Foto giocatore"
              className="h-full w-full object-contain object-bottom"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[clamp(3rem,14vw,6rem)] font-black text-white/80">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </CardItem>
      )}
      {extraPhotoSlots.map((key, index) => card[`${key}_url`] ? (
        <CardItem
          key={key}
          editable={editable}
          layoutKey={key}
          value={layout[key]}
          onChange={onLayoutChange}
          style={{
            left: `${layout[key].x}%`,
            top: `${layout[key].y}%`,
            width: `${24 * layout[key].scale / 100}%`,
            height: `${16 * layout[key].scale / 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          className="absolute z-20"
        >
          <img
            src={card[`${key}_url`]!}
            alt={`Immagine aggiuntiva ${index + 1}`}
            draggable={false}
            className="pointer-events-none h-full w-full object-contain"
          />
        </CardItem>
      ) : null)}
      {card.show_ovr && (
        <CardItem
          editable={editable}
          layoutKey="ovr"
          value={layout.ovr}
          onChange={onLayoutChange}
          style={itemStyle("ovr")}
          className="absolute z-30 text-[clamp(2.2rem,11vw,4.4rem)] font-black leading-none text-[#fff6d5] [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          {ovr}
        </CardItem>
      )}
      {card.show_role && (
        <CardItem
          editable={editable}
          layoutKey="role"
          value={layout.role}
          onChange={onLayoutChange}
          style={itemStyle("role")}
          className="absolute z-30 text-[clamp(.75rem,3vw,1.25rem)] font-black leading-none text-[#fff6d5] [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          {player.position}
        </CardItem>
      )}
      {card.show_name && (
        <CardItem
          editable={editable}
          layoutKey="name"
          value={layout.name}
          onChange={onLayoutChange}
          style={itemStyle("name")}
          className="absolute z-30 whitespace-nowrap text-[clamp(1.15rem,5vw,2.1rem)] font-black uppercase leading-none tracking-tight text-white [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          {displayName}
        </CardItem>
      )}
      {card.show_id && (
        <CardItem
          editable={editable}
          layoutKey="id"
          value={layout.id}
          onChange={onLayoutChange}
          style={itemStyle("id")}
          className="absolute z-30 whitespace-nowrap text-[clamp(.58rem,2.3vw,.9rem)] font-bold tracking-wide text-white [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          ID EA: {displayId}
        </CardItem>
      )}
      {card.show_number && (
        <CardItem
          editable={editable}
          layoutKey="number"
          value={layout.number}
          onChange={onLayoutChange}
          style={itemStyle("number")}
          className="absolute z-30 text-[clamp(1rem,4.6vw,1.85rem)] font-black leading-none text-[#fff6d5] [text-shadow:0_2px_5px_rgba(15,23,42,.95)]"
        >
          #{player.shirt_number}
        </CardItem>
      )}
      {stats.map(
        ([visible, label, key, value]) =>
          card[visible] && (
            <CardItem
              key={label}
              editable={editable}
              layoutKey={key}
              value={layout[key]}
              onChange={onLayoutChange}
              style={itemStyle(key)}
              className="absolute z-30 text-center leading-none text-[#fff6d5] [text-shadow:0_2px_4px_rgba(15,23,42,.95)]"
            >
              <span className="block text-[clamp(.86rem,3.8vw,1.55rem)] font-black">
                {card[value] as number}
              </span>
              <span className="mt-1 block text-[clamp(.42rem,1.7vw,.68rem)] font-black tracking-tight text-white">
                {label}
              </span>
            </CardItem>
          ),
      )}
    </div>
  );
});

PlayerCard.displayName = "PlayerCard";
export default PlayerCard;
