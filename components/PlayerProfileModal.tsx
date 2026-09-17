"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import PlayerCard, {
  cardLayoutKeys,
  extraPhotoSlots,
  ExtraPhotoSlot,
  drawExtraCardPhotos,
  CardLayoutKey,
  defaultPlayerCardLayout,
  resolvePlayerCardLayout,
  CardPlayer,
  calculateOvr,
  emptyPlayerCard,
  PlayerCardData,
} from "./PlayerCard";

type Player = CardPlayer & { status: string };
type WeeklyHistory = {
  id: string;
  week_start: string;
  average_rating: number;
  votes_count: number;
  matches_count: number;
  performance_score: number;
};
type StatKey =
  "velocity" | "shooting" | "passing" | "dribbling" | "defending" | "physical";
type ToggleKey =
  | "show_photo"
  | "show_name"
  | "show_id"
  | "show_number"
  | "show_role"
  | "show_ovr"
  | "show_velocity"
  | "show_shooting"
  | "show_passing"
  | "show_dribbling"
  | "show_defending"
  | "show_physical";

const statFields: Array<{ key: StatKey; label: string; visible: ToggleKey }> = [
  { key: "velocity", label: "VEL", visible: "show_velocity" },
  { key: "shooting", label: "TIR", visible: "show_shooting" },
  { key: "passing", label: "PAS", visible: "show_passing" },
  { key: "dribbling", label: "DRI", visible: "show_dribbling" },
  { key: "defending", label: "DIF", visible: "show_defending" },
  { key: "physical", label: "FIS", visible: "show_physical" },
];

function hydratePlayerCard(
  data: Record<string, unknown> | null,
): PlayerCardData {
  const empty = emptyPlayerCard();
  if (!data) return empty;
  return {
    ...empty,
    ...data,
    layout: {
      ...empty.layout,
      ...((data.layout as PlayerCardData["layout"] | null) || {}),
    },
  } as PlayerCardData;
}

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
  isAdmin,
  onClose,
  initialView = "profile",
}: {
  player: Player;
  isAdmin: boolean;
  onClose: () => void;
  initialView?: "profile" | "card";
}) {
  const [loading, setLoading] = useState(true);
  const [presences, setPresences] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [top11Count, setTop11Count] = useState(0);
  const [mvpCount, setMvpCount] = useState(0);
  const [history, setHistory] = useState<WeeklyHistory[]>([]);
  const [showCard, setShowCard] = useState(initialView === "card");
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [cardRevision, setCardRevision] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      const [
        presenceResult,
        ratingResult,
        top11Result,
        mvpResult,
        historyResult,
      ] = await Promise.all([
        supabase.from("presences").select("status").eq("player_id", player.id),
        supabase
          .from("match_ratings")
          .select("rating")
          .eq("player_id", player.id),
        supabase.from("weekly_top_11").select("id").eq("player_id", player.id),
        supabase.from("weekly_mvp").select("id").eq("player_id", player.id),
        supabase
          .from("weekly_player_ratings")
          .select(
            "id, week_start, average_rating, votes_count, matches_count, performance_score",
          )
          .eq("player_id", player.id)
          .order("week_start", { ascending: false }),
      ]);
      if (!active) return;
      const presenceRows = presenceResult.data || [];
      setPresences(presenceRows.length);
      setPresentCount(
        presenceRows.filter((item) => item.status === "Presente").length,
      );
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

  const averageRating = useMemo(
    () =>
      ratings.length
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : null,
    [ratings],
  );

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-emerald-400/30 bg-slate-900 p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <p className="font-black uppercase tracking-[0.2em] text-emerald-300">
            Calcio Totale 2026
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCard(true)}
              className="min-h-11 rounded-xl border border-fuchsia-300/40 px-3 text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-300/10"
            >
              🎴 Player Card
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowCardEditor(true)}
                className="min-h-11 rounded-xl bg-fuchsia-400 px-3 text-sm font-black text-slate-950 hover:bg-fuchsia-300"
              >
                ✏️ Modifica card
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 rounded-xl border border-slate-700 text-xl text-slate-300 hover:bg-slate-800"
              aria-label="Chiudi profilo giocatore"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="overflow-hidden rounded-3xl border border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/15 via-slate-900 to-cyan-500/15 p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-fuchsia-300/30 bg-slate-950/80 text-2xl font-black text-fuchsia-200">
                {player.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="rounded-2xl border border-cyan-300/40 bg-slate-950/80 px-4 py-2 text-center">
                <p className="text-[10px] font-bold uppercase text-cyan-100">
                  Media voto
                </p>
                <p className="text-3xl font-black text-cyan-200">
                  {averageRating?.toFixed(2) || "—"}
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm font-black tracking-[0.2em] text-fuchsia-200">
              {player.position}
            </p>
            <h2 className="mt-2 text-3xl font-black uppercase">
              {player.name}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              ID EA: {player.psn_id} · Maglia #{player.shirt_number}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-center">
              <CardMetric
                label="Presenze"
                value={`${presentCount}/${presences}`}
              />
              <CardMetric
                label="Media voto"
                value={averageRating?.toFixed(2) || "—"}
              />
              <CardMetric label="Top 11" value={String(top11Count)} />
              <CardMetric label="MVP" value={String(mvpCount)} />
            </div>
          </section>
          <section className="rounded-3xl border border-slate-700 bg-slate-950 p-5 sm:p-7">
            <h3 className="text-xl font-black">Storico rendimento</h3>
            {loading ? (
              <p className="mt-3 text-sm text-slate-500">
                Caricamento dati reali…
              </p>
            ) : history.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Nessun rendimento settimanale ancora calcolato.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {history.map((week) => (
                  <div
                    key={week.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl bg-slate-900 p-3 text-sm"
                  >
                    <span className="font-bold">
                      {formatWeek(week.week_start)}
                    </span>
                    <span className="font-mono text-emerald-300">
                      Media {Number(week.average_rating).toFixed(2)}
                    </span>
                    <span className="font-black text-fuchsia-200">
                      {Number(week.performance_score).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      {showCard && (
        <PlayerCardViewer
          key={cardRevision}
          player={player}
          isAdmin={isAdmin}
          onClose={initialView === "card" ? onClose : () => setShowCard(false)}
          onShowProfile={() => setShowCard(false)}
          onEdit={() => setShowCardEditor(true)}
        />
      )}
      {isAdmin && showCardEditor && (
        <PlayerCardEditor
          player={player}
          onSaved={() => setCardRevision((current) => current + 1)}
          onClose={() => setShowCardEditor(false)}
        />
      )}
    </div>
  );
}

function PlayerCardViewer({
  player,
  isAdmin,
  onClose,
  onShowProfile,
  onEdit,
}: {
  player: Player;
  isAdmin: boolean;
  onClose: () => void;
  onShowProfile: () => void;
  onEdit: () => void;
}) {
  const [card, setCard] = useState<PlayerCardData | null>(null);
  const [downloadMessage, setDownloadMessage] = useState("");

  async function downloadCard() {
    if (!card) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1536;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas non disponibile");
      const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
      });
      const template = await loadImage("/calcio-totale-player-card-2026.png");
      context.drawImage(template, 0, 0, canvas.width, canvas.height);
      const layout = resolvePlayerCardLayout(card.layout);
      const displayName = card.display_name?.trim() || player.name;
      const displayId = card.display_id?.trim() || player.psn_id;
      const drawText = (text: string, key: CardLayoutKey, font: string) => {
        const position = layout[key];
        context.save();
        context.translate((canvas.width * position.x) / 100, (canvas.height * position.y) / 100);
        context.scale(position.scale / 100, position.scale / 100);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = font;
        context.lineJoin = "round";
        context.strokeStyle = "#18213e";
        context.lineWidth = 12;
        context.fillStyle = key === "name" || key === "id" ? "#ffffff" : "#fff6d5";
        context.strokeText(text, 0, 0);
        context.fillText(text, 0, 0);
        context.restore();
      };
      if (card.show_photo) {
        if (card.photo_url) {
          const photo = await loadImage(card.photo_url);
          const position = layout.photo;
          const maxWidth = 900 * (position.scale / 100);
          const maxHeight = 1040 * (position.scale / 100);
          const ratio = Math.min(maxWidth / photo.width, maxHeight / photo.height);
          const width = photo.width * ratio;
          const height = photo.height * ratio;
          context.drawImage(photo, (canvas.width * position.x) / 100 - width / 2, (canvas.height * position.y) / 100 + maxHeight / 2 - height, width, height);
        } else {
          context.fillStyle = "#ffffff";
          context.font = "900 230px Arial";
          context.textAlign = "center";
          context.fillText(displayName.slice(0, 2).toUpperCase(), (canvas.width * layout.photo.x) / 100, (canvas.height * layout.photo.y) / 100);
        }
      }
      await drawExtraCardPhotos(context, card, loadImage);
      if (card.show_ovr) drawText(String(calculateOvr(card)), "ovr", "900 150px Arial");
      if (card.show_role) drawText(player.position, "role", "900 58px Arial");
      if (card.show_number) drawText("#" + player.shirt_number, "number", "900 64px Arial");
      if (card.show_name) drawText(displayName.toUpperCase(), "name", "900 68px Arial");
      if (card.show_id) drawText("ID EA: " + displayId, "id", "700 31px Arial");
      const metrics: Array<[boolean, string, number, CardLayoutKey]> = [
        [card.show_velocity, "VEL", card.velocity, "velocity"], [card.show_shooting, "TIR", card.shooting, "shooting"],
        [card.show_passing, "PAS", card.passing, "passing"], [card.show_dribbling, "DRI", card.dribbling, "dribbling"],
        [card.show_defending, "DIF", card.defending, "defending"], [card.show_physical, "FIS", card.physical, "physical"],
      ];
      for (const [visible, label, value, key] of metrics) {
        if (!visible) continue;
        const position = layout[key];
        context.save();
        context.translate((canvas.width * position.x) / 100, (canvas.height * position.y) / 100);
        context.scale(position.scale / 100, position.scale / 100);
        context.textAlign = "center";
        context.fillStyle = "#fff6d5";
        context.strokeStyle = "#18213e";
        context.lineWidth = 10;
        context.font = "900 59px Arial";
        context.strokeText(String(value), 0, 0);
        context.fillText(String(value), 0, 0);
        context.font = "900 29px Arial";
        context.strokeText(label, 0, 55);
        context.fillText(label, 0, 55);
        context.restore();
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG non creato");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "calcio-totale-" + (player.psn_id || "player-card") + ".png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadMessage("Card scaricata in PNG.");
    } catch {
      setDownloadMessage("La card sta ancora caricando: attendi un secondo e riprova.");
    }
  }

  useEffect(() => {
    void supabase
      .from("player_cards")
      .select("*")
      .eq("player_id", player.id)
      .maybeSingle()
      .then(({ data }) => setCard(hydratePlayerCard(data)));
  }, [player.id]);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/95 p-4">
      <div className="relative w-full max-w-[430px]">
        <div className="absolute -top-14 left-0 right-0 z-10 flex justify-between gap-2">
          <button
            type="button"
            onClick={onShowProfile}
            className="min-h-10 rounded-xl border border-white/20 bg-slate-950/90 px-3 text-sm font-bold text-white"
          >
            👤 Profilo
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void downloadCard()}
              className="min-h-10 rounded-xl border border-cyan-300/50 bg-slate-950/90 px-3 text-sm font-bold text-cyan-100"
            >
              📥 Scarica PNG
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={onEdit}
                className="min-h-10 rounded-xl bg-fuchsia-400 px-3 text-sm font-black text-slate-950"
              >
                ✏️ Modifica
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 min-w-10 rounded-xl bg-slate-950/90 text-xl text-white"
            >
              ✕
            </button>
          </div>
        </div>
        {card ? (
          <>
            <PlayerCard
              player={player}
              card={card}
              className="drop-shadow-[0_24px_45px_rgba(0,0,0,.55)]"
            />
            {downloadMessage && <p className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-center text-sm font-bold text-cyan-100">{downloadMessage}</p>}
          </>
        ) : (
          <div className="aspect-[374/508] animate-pulse rounded-3xl bg-slate-800" />
        )}
      </div>
    </div>
  );
}

function PlayerCardEditor({
  player,
  onClose,
  onSaved,
}: {
  player: Player;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [card, setCard] = useState<PlayerCardData>(emptyPlayerCard());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void supabase
      .from("player_cards")
      .select("*")
      .eq("player_id", player.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(`Errore lettura card: ${error.message}`);
        setCard(hydratePlayerCard(data));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [player.id]);
  const setStat = (key: StatKey, value: string) =>
    setCard((current) => ({
      ...current,
      [key]: Math.max(1, Math.min(99, Number(value) || 1)),
    }));
  const toggle = (key: ToggleKey) =>
    setCard((current) => ({ ...current, [key]: !current[key] }));
  const updateLayout = (
    key: CardLayoutKey,
    update: Partial<{ x: number; y: number; scale: number }>,
  ) =>
    setCard((current) => ({
      ...current,
      layout: {
        ...current.layout,
        [key]: {
          ...defaultPlayerCardLayout()[key],
          ...current.layout[key],
          ...update,
        },
      },
    }));
  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      setMessage("Carica il bot come PNG trasparente, senza sfondo.");
      return;
    }
    if (file.size > 2_000_000) {
      setMessage("La foto deve pesare al massimo 2 MB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setCard((current) => ({ ...current, photo_url: dataUrl }));
    setMessage("Bot PNG trasparente pronto: premi Salva Player Card.");
  }

  async function handleExtraPhoto(event: ChangeEvent<HTMLInputElement>, key: ExtraPhotoSlot) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("Per le immagini aggiuntive usa PNG, JPG o WebP.");
      return;
    }
    if (file.size > 5_000_000) {
      setMessage("Ogni immagine aggiuntiva deve pesare al massimo 5 MB.");
      return;
    }
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = source;
      });
      setCard((current) => ({ ...current, [`${key}_url`]: source }));
      setMessage("Immagine pronta: spostala o ridimensionala, poi premi Salva Player Card.");
    } catch {
      setMessage("Impossibile leggere questa immagine. Prova un altro file.");
    }
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("player_cards")
      .upsert(
        { player_id: player.id, ...card, updated_at: new Date().toISOString() },
        { onConflict: "player_id" },
      );
    setSaving(false);
    if (!error) onSaved();
    setMessage(
      error ? `Errore Player Card: ${error.message}` : "Player Card salvata.",
    );
  }
  async function removeCustomCard() {
    if (
      !window.confirm(
        `Eliminare solo i dati personalizzati della Player Card di ${player.name}? Il giocatore, presenze, voti e storico rimarranno invariati.`,
      )
    )
      return;
    setSaving(true);
    const { error } = await supabase
      .from("player_cards")
      .delete()
      .eq("player_id", player.id);
    setSaving(false);
    if (error) {
      setMessage(`Errore eliminazione dati card: ${error.message}`);
      return;
    }
    setCard(emptyPlayerCard());
    setMessage(
      "Dati personalizzati della card eliminati. Il giocatore non è stato modificato.",
    );
  }
  async function exportPng() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1536;
    const context = canvas.getContext("2d");
    if (!context) return;
    const load = (source: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
      });
    try {
      const template = await load("/calcio-totale-player-card-2026.png");
      context.drawImage(template, 0, 0, canvas.width, canvas.height);
      const layout = resolvePlayerCardLayout(card.layout);
      const displayName = card.display_name?.trim() || player.name;
      const displayId = card.display_id?.trim() || player.psn_id;
      const draw = (
        text: string,
        key: CardLayoutKey,
        font: string,
        align: CanvasTextAlign = "center",
      ) => {
        const position = layout[key];
        context.save();
        context.translate(
          (canvas.width * position.x) / 100,
          (canvas.height * position.y) / 100,
        );
        context.scale(position.scale / 100, position.scale / 100);
        context.font = font;
        context.textAlign = align;
        context.strokeText(text, 0, 0);
        context.fillText(text, 0, 0);
        context.restore();
      };
      if (card.show_photo) {
        if (card.photo_url) {
          const photo = await load(card.photo_url);
          const position = layout.photo;
          const maxWidth = 900 * (position.scale / 100);
          const maxHeight = 1040 * (position.scale / 100);
          const ratio = Math.min(
            maxWidth / photo.width,
            maxHeight / photo.height,
          );
          const width = photo.width * ratio;
          const height = photo.height * ratio;
          context.drawImage(
            photo,
            (canvas.width * position.x) / 100 - width / 2,
            (canvas.height * position.y) / 100 + maxHeight / 2 - height,
            width,
            height,
          );
        } else {
          context.fillStyle = "#ffffff";
          context.font = "900 230px Arial";
          context.textAlign = "center";
          context.fillText(
            displayName.slice(0, 2).toUpperCase(),
            (canvas.width * layout.photo.x) / 100,
            (canvas.height * layout.photo.y) / 100,
          );
        }
      }
      await drawExtraCardPhotos(context, card, load);
      const ovr = calculateOvr(card);
      context.fillStyle = "#fff6d5";
      context.strokeStyle = "#18213e";
      context.lineWidth = 14;
      if (card.show_ovr) {
        draw(String(ovr), "ovr", "900 150px Arial");
      }
      if (card.show_role) {
        draw(player.position, "role", "900 58px Arial");
      }
      if (card.show_number) {
        draw(`#${player.shirt_number}`, "number", "900 64px Arial");
      }
      if (card.show_name) {
        draw(displayName.toUpperCase(), "name", "900 68px Arial");
      }
      if (card.show_id) {
        draw(`ID EA: ${displayId}`, "id", "700 31px Arial");
      }
      const values: Array<[boolean, string, number]> = [
        [card.show_velocity, "VEL", card.velocity],
        [card.show_shooting, "TIR", card.shooting],
        [card.show_passing, "PAS", card.passing],
        [card.show_dribbling, "DRI", card.dribbling],
        [card.show_defending, "DIF", card.defending],
        [card.show_physical, "FIS", card.physical],
      ];
      context.textAlign = "center";
      values.forEach(([visible, label, value], index) => {
        if (!visible) return;
        const key = cardLayoutKeys[index + 6];
        const position = layout[key];
        context.save();
        context.translate(
          (canvas.width * position.x) / 100,
          (canvas.height * position.y) / 100,
        );
        context.scale(position.scale / 100, position.scale / 100);
        context.font = "900 59px Arial";
        context.strokeText(String(value), 0, 0);
        context.fillText(String(value), 0, 0);
        context.font = "900 29px Arial";
        context.strokeText(label, 0, 55);
        context.fillText(label, 0, 55);
        context.restore();
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("PNG non creato");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `calcio-totale-${player.psn_id || "player-card"}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("PNG esportato.");
    } catch {
      setMessage("La card sta ancora caricando: attendi un secondo e riprova.");
    }
  }
  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-slate-950/95 p-4 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-6 rounded-3xl border border-fuchsia-300/30 bg-slate-900 p-5 shadow-2xl lg:grid-cols-[1.1fr_.9fr] lg:p-8">
        <section>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black uppercase tracking-[.18em] text-fuchsia-200">
                Admin
              </p>
              <h2 className="text-2xl font-black">🎴 Player Card Editor</h2>
              <p className="mt-1 text-sm text-slate-400">
                Modifica solo i dati grafici della card.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 rounded-xl border border-slate-700 text-xl"
            >
              ✕
            </button>
          </div>
          {loading ? (
            <p className="mt-6 text-slate-400">Caricamento card…</p>
          ) : (
            <div className="mt-6 space-y-5">
              <fieldset className="rounded-2xl border border-slate-700 p-4">
                <legend className="px-2 font-bold text-fuchsia-200">
                  Foto Player Virtuale
                </legend>
                <label className="text-sm font-bold">
                  Carica bot PNG trasparente (massimo 2 MB)
                  <input
                    type="file"
                    accept="image/png"
                    onChange={handlePhoto}
                    className="mt-2 block w-full text-sm"
                  />
                </label>
                {card.photo_url && (
                  <button
                    type="button"
                    onClick={() => {
                      setCard({ ...card, photo_url: null });
                      setMessage("Foto rimossa: premi Salva Player Card.");
                    }}
                    className="mt-3 text-sm font-bold text-red-300"
                  >
                    Rimuovi foto
                  </button>
                )}
              </fieldset>
              <fieldset className="rounded-2xl border border-slate-700 p-4">
                <legend className="px-2 font-bold text-fuchsia-200">Due immagini aggiuntive</legend>
                <p className="mb-3 text-sm text-slate-400">Facoltative: logo o foto, PNG, JPG o WebP, massimo 5 MB ciascuna. Trascinale nell’anteprima; usa la rotellina o due dita per ridimensionarle.</p>
                {extraPhotoSlots.map((key, index) => (
                  <div key={key} className="mt-4">
                    <label className="text-sm font-bold">
                      Immagine aggiuntiva {index + 1}
                      <input type="file" accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => void handleExtraPhoto(event, key)}
                        className="mt-2 block w-full text-sm" />
                    </label>
                    {card[`${key}_url`] && <>
                      <label className="mt-3 block text-sm">
                        Dimensione immagine {index + 1}
                        <input type="range" min="35" max="220"
                          value={resolvePlayerCardLayout(card.layout)[key].scale}
                          onChange={(event) => updateLayout(key, { scale: Number(event.target.value) })}
                          className="mt-2 block w-full" />
                      </label>
                      <button type="button" className="mt-2 text-sm font-bold text-red-300"
                        onClick={() => {
                          setCard((current) => ({ ...current, [`${key}_url`]: null }));
                          setMessage("Immagine rimossa: premi Salva Player Card.");
                        }}>Rimuovi immagine {index + 1}</button>
                    </>}
                  </div>
                ))}
              </fieldset>
              <fieldset className="rounded-2xl border border-slate-700 p-4">
                <legend className="px-2 font-bold text-fuchsia-200">
                  Testi sulla card
                </legend>
                <p className="mb-3 text-xs text-slate-400">
                  Questi campi modificano solo la Player Card: non cambiano
                  profilo, ID di accesso o credenziali del giocatore.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    Nome sulla card
                    <input
                      value={card.display_name ?? ""}
                      onChange={(event) =>
                        setCard({ ...card, display_name: event.target.value })
                      }
                      placeholder={player.name}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    ID EA sulla card
                    <input
                      value={card.display_id ?? ""}
                      onChange={(event) =>
                        setCard({ ...card, display_id: event.target.value })
                      }
                      placeholder={player.psn_id}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset className="rounded-2xl border border-cyan-300/35 p-4">
                <legend className="px-2 font-bold text-cyan-100">
                  Modifica direttamente la card
                </legend>
                <p className="text-sm text-slate-300">
                  Nell’anteprima a destra: trascina con il mouse per spostare;
                  usa la rotellina per ingrandire/ridurre. Da telefono: un dito
                  per spostare, due dita per ingrandire o ridurre.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setCard((current) => ({
                      ...current,
                      layout: defaultPlayerCardLayout(),
                    }))
                  }
                  className="mt-3 rounded-lg border border-cyan-300/40 px-3 py-2 text-sm font-bold text-cyan-100"
                >
                  ↺ Ripristina tutte le posizioni
                </button>
              </fieldset>
              <fieldset className="rounded-2xl border border-slate-700 p-4">
                <legend className="px-2 font-bold text-fuchsia-200">
                  Overall
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="rounded-xl border border-slate-700 p-3 text-sm font-bold">
                    <input
                      type="radio"
                      checked={card.ovr_mode === "automatic"}
                      onChange={() =>
                        setCard({ ...card, ovr_mode: "automatic" })
                      }
                    />{" "}
                    Automatico ({calculateOvr(card)})
                  </label>
                  <label className="rounded-xl border border-slate-700 p-3 text-sm font-bold">
                    <input
                      type="radio"
                      checked={card.ovr_mode === "manual"}
                      onChange={() =>
                        setCard({
                          ...card,
                          ovr_mode: "manual",
                          manual_ovr: card.manual_ovr ?? 50,
                        })
                      }
                    />{" "}
                    Manuale
                  </label>
                </div>
                {card.ovr_mode === "manual" && (
                  <label className="mt-3 block text-sm font-bold">
                    OVR manuale
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={String(card.manual_ovr ?? 50)}
                      onChange={(event) =>
                        setCard({
                          ...card,
                          manual_ovr: Math.max(
                            1,
                            Math.min(99, Number(event.target.value) || 1),
                          ),
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"
                    />
                  </label>
                )}
              </fieldset>
              <fieldset className="rounded-2xl border border-slate-700 p-4">
                <legend className="px-2 font-bold text-fuchsia-200">
                  Statistiche
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {statFields.map((stat) => (
                    <label
                      key={stat.key}
                      className="flex items-center gap-3 rounded-xl bg-slate-950 p-3 text-sm font-bold"
                    >
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={card[stat.key]}
                        onChange={(event) =>
                          setStat(stat.key, event.target.value)
                        }
                        className="w-20 rounded-lg border border-slate-700 bg-slate-900 p-2 text-center"
                      />
                      {stat.label}
                      <input
                        aria-label={`Mostra ${stat.label}`}
                        type="checkbox"
                        checked={card[stat.visible]}
                        onChange={() => toggle(stat.visible)}
                        className="ml-auto h-5 w-5 accent-fuchsia-400"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="rounded-2xl border border-slate-700 p-4">
                <legend className="px-2 font-bold text-fuchsia-200">
                  Visibilità
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["show_photo", "Foto"],
                      ["show_name", "Nome"],
                      ["show_id", "ID EA"],
                      ["show_number", "Numero"],
                      ["show_role", "Ruolo"],
                      ["show_ovr", "OVR"],
                    ] as Array<[ToggleKey, string]>
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg bg-slate-950 p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={card[key]}
                        onChange={() => toggle(key)}
                        className="h-4 w-4 accent-fuchsia-400"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {message && (
                <p className="rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 p-3 text-sm text-fuchsia-100">
                  {message}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="min-h-12 rounded-xl bg-fuchsia-400 px-5 font-black text-slate-950 disabled:opacity-60"
                >
                  {saving ? "Salvataggio…" : "💾 Salva Player Card"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCard(emptyPlayerCard());
                    setMessage(
                      "Valori azzerati: premi Salva Player Card per confermare.",
                    );
                  }}
                  className="min-h-12 rounded-xl border border-cyan-300/40 px-5 font-bold text-cyan-100"
                >
                  ↺ Azzera valori
                </button>
                <button
                  type="button"
                  onClick={() => void exportPng()}
                  className="min-h-12 rounded-xl border border-fuchsia-300/40 px-5 font-bold text-fuchsia-100"
                >
                  📥 Esporta PNG
                </button>
                <button
                  type="button"
                  onClick={() => void removeCustomCard()}
                  disabled={saving}
                  className="min-h-12 rounded-xl border border-red-500/40 px-5 font-bold text-red-300"
                >
                  🗑️ Elimina dati card
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="flex flex-col items-center">
          <p className="mb-4 font-bold text-slate-400">ANTEPRIMA LIVE</p>
          <div className="w-full max-w-[390px]">
            <PlayerCard
              player={player}
              card={card}
              editable
              onLayoutChange={updateLayout}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/80 p-3">
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
