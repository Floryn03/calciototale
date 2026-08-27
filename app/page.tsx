"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Player = {
  id: string;
  name: string;
  psn_id: string;
  shirt_number: number;
  position: string;
  status: string;
  created_at: string;
};

type Presence = {
  id: string;
  player_id: string;
  event_id: string | null;
  presence_date: string;
  status: string;
  note: string | null;
};

type EventItem = {
  id: string | number;
  name: string;
  date?: string;
  time?: string;
  event_date?: string;
  event_time?: string;
};

const positions = [
  { value: "POR", label: "🧤 POR — Portiere" },
  { value: "DCS", label: "🛡️ DCS — Difensore centrale sinistro" },
  { value: "DCC", label: "🛡️ DCC — Difensore centrale" },
  { value: "DCD", label: "🛡️ DCD — Difensore centrale destro" },
  { value: "ES", label: "🏃 ES — Esterno sinistro" },
  { value: "ED", label: "🏃 ED — Esterno destro" },
  { value: "CCS", label: "⚙️ CCS — Centrocampista sinistro" },
  { value: "CDC", label: "⚙️ CDC — Centrocampista difensivo" },
  { value: "CCD", label: "⚙️ CCD — Centrocampista destro" },
  { value: "ATT (PS)", label: "⚽ ATT (PS) — Attaccante punta sinistra" },
  { value: "ATT (PD)", label: "⚽ ATT (PD) — Attaccante punta destra" },
];

const menu = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "players", label: "Giocatori", icon: "👥" },
  { id: "presences", label: "Presenze", icon: "✅" },
  { id: "events", label: "Eventi", icon: "📅" },
  { id: "competitions", label: "Competizioni", icon: "🏆" },
  { id: "votes", label: "Votazioni", icon: "⭐" },
  { id: "mvp", label: "MVP", icon: "👑" },
  { id: "stats", label: "Statistiche", icon: "📊" },
  { id: "admin", label: "Amministrazione", icon: "⚙️" },
];

const today = new Date().toISOString().split("T")[0];

export default function Home() {
  const [activeSection, setActiveSection] = useState("dashboard");

  const [players, setPlayers] = useState<Player[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);

  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingPresences, setLoadingPresences] = useState(true);

  const [saving, setSaving] = useState(false);

  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const [name, setName] = useState("");
  const [psnId, setPsnId] = useState("");
  const [shirtNumber, setShirtNumber] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("Attivo");

  const [search, setSearch] = useState("");

  const [presenceDate, setPresenceDate] = useState(today);
  const [presenceFilter, setPresenceFilter] = useState("Tutti");

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const [competitions, setCompetitions] = useState<
    {
      id: number;
      name: string;
      type: string;
      status: string;
    }[]
  >([]);

  const [competitionName, setCompetitionName] = useState("");
  const [competitionType, setCompetitionType] = useState("Torneo");

  // =========================================================
  // LOAD PLAYERS
  // =========================================================

  async function loadPlayers() {
    setLoadingPlayers(true);

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Errore durante il caricamento dei giocatori.");
      setPlayers([]);
    } else {
      setPlayers(data || []);
    }

    setLoadingPlayers(false);
  }

  // =========================================================
  // LOAD PRESENCES
  // =========================================================

  async function loadPresences() {
    setLoadingPresences(true);

    let query = supabase
      .from("presences")
      .select("*");

    if (selectedEventId) {
      query = query.eq("event_id", selectedEventId);
    } else {
      query = query.eq("presence_date", presenceDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setPresences([]);
    } else {
      setPresences(data || []);
    }

    setLoadingPresences(false);
  }

  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, event_date, event_time")
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true });

    if (error) {
      console.error("Errore caricamento eventi:", error);
      return;
    }

    const loaded = (data || []) as EventItem[];
    setEvents(loaded);

    if (loaded.length > 0 && !selectedEventId) {
      setSelectedEventId(String(loaded[0].id));
    }
  }

  useEffect(() => {
    loadPlayers();
    loadEvents();
  }, []);

  useEffect(() => {
    const selectedEvent = events.find(
      (event) => String(event.id) === selectedEventId
    );

    if (selectedEvent) {
      setPresenceDate(selectedEvent.event_date ?? "");
        }

    loadPresences();
  }, [presenceDate, selectedEventId]);

  // =========================================================
  // PLAYER FORM
  // =========================================================

  function openPlayerForm() {
    setEditingPlayer(null);
    setName("");
    setPsnId("");
    setShirtNumber("");
    setPosition("");
    setStatus("Attivo");
    setShowPlayerForm(true);
  }

  function openEditPlayer(player: Player) {
    setEditingPlayer(player);
    setName(player.name);
    setPsnId(player.psn_id);
    setShirtNumber(String(player.shirt_number));
    setPosition(player.position);
    setStatus(player.status);
    setShowPlayerForm(true);
  }

  function closePlayerForm() {
    if (!saving) {
      setShowPlayerForm(false);
      setEditingPlayer(null);
    }
  }

  // =========================================================
  // SAVE PLAYER
  // =========================================================

  async function savePlayer() {
    if (!name.trim()) {
      alert("Inserisci il nome del giocatore.");
      return;
    }

    if (!psnId.trim()) {
      alert("Inserisci l'ID PlayStation.");
      return;
    }

    if (!shirtNumber.trim()) {
      alert("Inserisci il numero di maglia.");
      return;
    }

    if (!position) {
      alert("Seleziona una posizione.");
      return;
    }

    const number = Number(shirtNumber);

    if (!Number.isInteger(number) || number < 1 || number > 99) {
      alert("Il numero deve essere compreso tra 1 e 99.");
      return;
    }

    setSaving(true);

    if (editingPlayer) {
      const { data, error } = await supabase
        .from("players")
        .update({
          name: name.trim(),
          psn_id: psnId.trim(),
          shirt_number: number,
          position,
          status,
        })
        .eq("id", editingPlayer.id)
        .select()
        .single();

      if (error) {
        alert(`Errore modifica:\n${error.message}`);
      } else if (data) {
        setPlayers((current) =>
          current.map((p) => (p.id === data.id ? data : p))
        );
        setShowPlayerForm(false);
      }
    } else {
      const { data, error } = await supabase
        .from("players")
        .insert([
          {
            name: name.trim(),
            psn_id: psnId.trim(),
            shirt_number: number,
            position,
            status,
          },
        ])
        .select()
        .single();

      if (error) {
        alert(`Errore salvataggio:\n${error.message}`);
      } else if (data) {
        setPlayers((current) => [data, ...current]);
        setShowPlayerForm(false);
      }
    }

    setSaving(false);
  }

  // =========================================================
  // DELETE PLAYER
  // =========================================================

  async function deletePlayer(player: Player) {
    const confirmed = window.confirm(
      `Vuoi eliminare definitivamente ${player.name}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", player.id);

    if (error) {
      alert(`Errore eliminazione:\n${error.message}`);
      return;
    }

    setPlayers((current) =>
      current.filter((item) => item.id !== player.id)
    );

    setPresences((current) =>
      current.filter((item) => item.player_id !== player.id)
    );
  }

  // =========================================================
  // PLAYER STATUS
  // =========================================================

  async function togglePlayerStatus(player: Player) {
    const newStatus =
      player.status === "Attivo" ? "Inattivo" : "Attivo";

    const { error } = await supabase
      .from("players")
      .update({ status: newStatus })
      .eq("id", player.id);

    if (error) {
      alert(`Errore:\n${error.message}`);
      return;
    }

    setPlayers((current) =>
      current.map((item) =>
        item.id === player.id
          ? { ...item, status: newStatus }
          : item
      )
    );
  }

  // =========================================================
  // FILTER PLAYERS
  // =========================================================

  const filteredPlayers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return players;

    return players.filter(
      (player) =>
        player.name.toLowerCase().includes(value) ||
        player.psn_id.toLowerCase().includes(value) ||
        player.position.toLowerCase().includes(value)
    );
  }, [players, search]);

  // =========================================================
  // PLAYER COUNTERS
  // =========================================================

  const activePlayers = players.filter(
    (player) => player.status === "Attivo"
  ).length;

  const inactivePlayers = players.length - activePlayers;

  // =========================================================
  // PRESENCE
  // =========================================================

  function getPresence(playerId: string) {
    return presences.find(
      (presence) =>
        presence.player_id === playerId &&
        (!selectedEventId ||
          String(presence.event_id) === selectedEventId)
    );
  }

  async function savePresence(
    player: Player,
    newStatus: string
  ) {
    if (!selectedEventId) {
      alert("Seleziona prima un evento.");
      return;
    }

    const existing = getPresence(player.id);

    const selectedEvent = events.find(
      (event) => String(event.id) === selectedEventId
    );

    const payload = {
      player_id: player.id,
      event_id: selectedEvent ? selectedEvent.id : null,
      presence_date: selectedEvent
        ? selectedEvent.event_date
        : presenceDate,
      status: newStatus,
      note: existing?.note || null,
    };

    if (existing) {
      const { data, error } = await supabase
        .from("presences")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        alert(`Errore presenza:\n${error.message}`);
        return;
      }

      if (data) {
        setPresences((current) =>
          current.map((item) =>
            item.id === data.id ? data : item
          )
        );
      }
    } else {
      const { data, error } = await supabase
        .from("presences")
        .insert([payload])
        .select()
        .single();

      if (error) {
        alert(`Errore presenza:\n${error.message}`);
        return;
      }

      if (data) {
        setPresences((current) => [...current, data]);
      }
    }
  }

  const presentPlayers = players.filter(
    (player) => getPresence(player.id)?.status === "Presente"
  );

  const absentPlayers = players.filter(
    (player) => getPresence(player.id)?.status === "Assente"
  );

  // =========================================================
  // EVENTS
  // =========================================================

  function addEvent() {
    if (!eventName.trim()) {
      alert("Inserisci il nome dell'evento.");
      return;
    }

    if (!eventDate) {
      alert("Seleziona la data.");
      return;
    }

    setEvents((current) => [
      ...current,
      {
        id: Date.now(),
        name: eventName.trim(),
        date: eventDate,
        time: eventTime,
      },
    ]);

    setEventName("");
    setEventDate("");
    setEventTime("");
  }

  function deleteEvent(id: string | number) {
    setEvents((current) =>
      current.filter((event) => event.id !== id)
    );
  }

  // =========================================================
  // COMPETITIONS
  // =========================================================

  function addCompetition() {
    if (!competitionName.trim()) {
      alert("Inserisci il nome della competizione.");
      return;
    }

    setCompetitions((current) => [
      ...current,
      {
        id: Date.now(),
        name: competitionName.trim(),
        type: competitionType,
        status: "Attiva",
      },
    ]);

    setCompetitionName("");
  }

  function toggleCompetition(id: number) {
    setCompetitions((current) =>
      current.map((competition) =>
        competition.id === id
          ? {
              ...competition,
              status:
                competition.status === "Attiva"
                  ? "Conclusa"
                  : "Attiva",
            }
          : competition
      )
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* HEADER */}

      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <button
            onClick={() => setActiveSection("dashboard")}
            className="text-left"
          >
            <h1 className="text-2xl font-black">
              ⚽ CALCIO{" "}
              <span className="text-emerald-400">
                TOTALE
              </span>
            </h1>

            <p className="text-xs text-slate-500">
              Team Management System
            </p>
          </button>

          <div className="flex items-center gap-3">

            <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 md:block">
              ● Sistema Online
            </span>

            <button
              onClick={() => setActiveSection("admin")}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm transition hover:bg-slate-800"
            >
              ⚙️ Admin
            </button>

          </div>
        </div>
      </header>

      {/* MENU */}

      <div className="border-b border-slate-800 bg-slate-900/70">

        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">

          {menu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeSection === item.id
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}

        </nav>

      </div>

      {/* CONTENT */}

      <section className="mx-auto max-w-7xl px-6 py-10">

        {/* =====================================================
            DASHBOARD
        ===================================================== */}

        {activeSection === "dashboard" && (
          <div>

            <div className="mb-10">

              <p className="mb-3 font-bold uppercase tracking-[0.3em] text-emerald-400">
                CALCIO TOTALE
              </p>

              <h2 className="max-w-4xl text-4xl font-black leading-tight md:text-6xl">
                Tutto il tuo calcio,
                <span className="text-emerald-400">
                  {" "}in un unico posto.
                </span>
              </h2>

              <p className="mt-5 max-w-3xl text-lg text-slate-400">
                Gestisci giocatori, presenze, eventi,
                competizioni, votazioni, MVP e statistiche
                della tua squadra.
              </p>

            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

              <StatCard
                icon="👥"
                title="Giocatori"
                value={players.length}
                text={`${activePlayers} attivi`}
              />

              <StatCard
                icon="✅"
                title="Presenti oggi"
                value={presentPlayers.length}
                text={`${absentPlayers.length} assenti`}
              />

              <StatCard
                icon="🏆"
                title="Competizioni"
                value={competitions.length}
                text="Gestite dal sistema"
              />

              <StatCard
                icon="📅"
                title="Eventi"
                value={events.length}
                text="Prossimi appuntamenti"
              />

            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-7">

                <div className="flex items-center justify-between">

                  <div>
                    <h3 className="text-xl font-bold">
                      📋 Stato squadra
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Situazione attuale dei giocatori
                    </p>
                  </div>

                  <span className="rounded-xl bg-emerald-500/10 px-3 py-2 text-emerald-400">
                    {activePlayers}
                  </span>

                </div>

                <div className="mt-6 space-y-3">

                  <DashboardRow
                    label="🟢 Giocatori attivi"
                    value={activePlayers}
                  />

                  <DashboardRow
                    label="🔴 Giocatori inattivi"
                    value={inactivePlayers}
                  />

                  <DashboardRow
                    label="🟢 Presenti"
                    value={presentPlayers.length}
                  />

                  <DashboardRow
                    label="🔴 Assenti"
                    value={absentPlayers.length}
                  />

                </div>

              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-7">

                <h3 className="text-xl font-bold">
                  🚀 Accesso rapido
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Gestisci rapidamente la squadra
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">

                  <QuickButton
                    icon="➕"
                    text="Nuovo giocatore"
                    onClick={openPlayerForm}
                  />

                  <QuickButton
                    icon="✅"
                    text="Gestisci presenze"
                    onClick={() =>
                      setActiveSection("presences")
                    }
                  />

                  <QuickButton
                    icon="📅"
                    text="Nuovo evento"
                    onClick={() =>
                      setActiveSection("events")
                    }
                  />

                  <QuickButton
                    icon="🏆"
                    text="Competizioni"
                    onClick={() =>
                      setActiveSection("competitions")
                    }
                  />

                </div>

              </div>

            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">

              {menu.slice(1).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-emerald-500/50"
                >
                  <div className="text-4xl">
                    {item.icon}
                  </div>

                  <h3 className="mt-5 text-xl font-bold">
                    {item.label}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Apri il modulo {item.label.toLowerCase()}.
                  </p>

                </button>
              ))}

            </div>

          </div>
        )}

        {/* =====================================================
            PLAYERS
        ===================================================== */}

        {activeSection === "players" && (
          <div>

            <PageHeader
              eyebrow="CALCIO TOTALE"
              title="👥 Giocatori"
              description="Gestisci la rosa completa della squadra."
              buttonText="➕ Nuovo giocatore"
              onButton={openPlayerForm}
            />

            {showPlayerForm && (
              <div className="mb-8 rounded-3xl border border-emerald-500/40 bg-slate-900 p-7">

                <div className="mb-7 flex items-center justify-between">

                  <div>
                    <h3 className="text-2xl font-black">
                      {editingPlayer
                        ? "✏️ Modifica giocatore"
                        : "➕ Nuovo giocatore"}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Inserisci tutti i dati del giocatore.
                    </p>
                  </div>

                  <button
                    onClick={closePlayerForm}
                    disabled={saving}
                    className="text-2xl text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>

                </div>

                <div className="grid gap-5 md:grid-cols-2">

                  <Input
                    label="Nome giocatore"
                    value={name}
                    onChange={setName}
                    placeholder="Es. FLORIN"
                  />

                  <Input
                    label="ID PlayStation"
                    value={psnId}
                    onChange={setPsnId}
                    placeholder="Es. FLORYN03"
                  />

                  <Input
                    label="Numero maglia"
                    value={shirtNumber}
                    onChange={setShirtNumber}
                    placeholder="Es. 9"
                    type="number"
                  />

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Posizione
                    </label>

                    <select
                      value={position}
                      onChange={(e) =>
                        setPosition(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                    >
                      <option value="">
                        Seleziona posizione
                      </option>

                      {positions.map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      ))}

                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Stato
                    </label>

                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-500"
                    >
                      <option value="Attivo">
                        🟢 Attivo
                      </option>

                      <option value="Inattivo">
                        🔴 Inattivo
                      </option>

                    </select>
                  </div>

                </div>

                <div className="mt-7 flex gap-3">

                  <button
                    onClick={closePlayerForm}
                    className="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800"
                  >
                    Annulla
                  </button>

                  <button
                    onClick={savePlayer}
                    disabled={saving}
                    className="rounded-xl bg-emerald-500 px-6 py-3 font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {saving
                      ? "⏳ Salvataggio..."
                      : editingPlayer
                      ? "💾 Salva modifiche"
                      : "💾 Salva giocatore"}
                  </button>

                </div>

              </div>
            )}

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔎 Cerca per nome, PSN o posizione..."
              className="mb-6 w-full rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 outline-none focus:border-emerald-500"
            />

            {loadingPlayers ? (
              <Loading />
            ) : filteredPlayers.length === 0 ? (
              <EmptyState
                icon="⚽"
                title="Nessun giocatore"
                text="Non ci sono giocatori da visualizzare."
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

                {filteredPlayers.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onDelete={deletePlayer}
                    onToggleStatus={togglePlayerStatus}
                    onEdit={openEditPlayer}
                  />
                ))}

              </div>
            )}

          </div>
        )}

        {/* =====================================================
            PRESENCES
        ===================================================== */}

        {activeSection === "presences" && (
          <div>

            <PageHeader
              eyebrow="CALCIO TOTALE"
              title="✅ Presenze"
              description="Gestisci la disponibilità dei giocatori per ogni giornata."
            />

            <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-slate-900 p-5">
              <label className="mb-2 block text-sm font-semibold">
                📅 Evento
              </label>

              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
              >
                <option value="">
                  Seleziona un evento
                </option>

                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} — {event.event_date}
                    {event.event_time ? ` — ${event.event_time}` : ""}
                  </option>
                ))}
              </select>

              {events.length === 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  Non ci sono eventi disponibili.
                </p>
              )}
            </div>

            <div className="mb-6 grid gap-5 md:grid-cols-2">

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                <label className="mb-2 block text-sm font-semibold">
                  Data
                </label>

                <input
                  type="date"
                  value={presenceDate}
                  onChange={(e) =>
                    setPresenceDate(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                />

              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                <p className="text-sm text-slate-500">
                  Riepilogo
                </p>

                <div className="mt-3 flex flex-wrap gap-3">

                  <Badge
                    text={`🟢 ${presentPlayers.length} Presenti`}
                  />

                  <Badge
                    text={`🔴 ${absentPlayers.length} Assenti`}
                  />

                </div>

              </div>

            </div>

            {loadingPresences ? (
              <Loading />
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-800">

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead className="bg-slate-900">

                      <tr className="text-left text-sm text-slate-400">

                        <th className="px-5 py-4">
                          Giocatore
                        </th>

                        <th className="px-5 py-4">
                          Posizione
                        </th>

                        <th className="px-5 py-4">
                          Stato
                        </th>

                        <th className="px-5 py-4">
                          Azione
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {players
                        .filter(
                          (player) =>
                            player.status === "Attivo"
                        )
                        .map((player) => {

                          const presence =
                            getPresence(player.id);

                          return (
                            <tr
                              key={player.id}
                              className="border-t border-slate-800"
                            >

                              <td className="px-5 py-4">

                                <div className="font-bold">
                                  {player.name}
                                </div>

                                <div className="text-xs text-slate-500">
                                  {player.psn_id}
                                </div>

                              </td>

                              <td className="px-5 py-4">
                                {player.position}
                              </td>

                              <td className="px-5 py-4">
                                <PresenceBadge
                                  status={
                                    presence?.status ||
                                    "Da confermare"
                                  }
                                />
                              </td>

                              <td className="px-5 py-4">

                                <div className="flex flex-wrap gap-2">

                                  <PresenceButton
                                    text="🟢"
                                    active={
                                      presence?.status ===
                                      "Presente"
                                    }
                                    onClick={() =>
                                      savePresence(
                                        player,
                                        "Presente"
                                      )
                                    }
                                  />

                                  <PresenceButton
                                    text="🔴"
                                    active={
                                      presence?.status ===
                                      "Assente"
                                    }
                                    onClick={() =>
                                      savePresence(
                                        player,
                                        "Assente"
                                      )
                                    }
                                  />

                                </div>

                              </td>

                            </tr>
                          );
                        })}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

          </div>
        )}

        {/* =====================================================
            EVENTS
        ===================================================== */}

        {activeSection === "events" && (
          <div>

            <PageHeader
              eyebrow="CALCIO TOTALE"
              title="📅 Eventi"
              description="Organizza allenamenti, partite, tornei e appuntamenti."
            />

            <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">

              <h3 className="text-xl font-bold">
                ➕ Nuovo evento
              </h3>

              <div className="mt-5 grid gap-4 md:grid-cols-3">

                <Input
                  label="Nome evento"
                  value={eventName}
                  onChange={setEventName}
                  placeholder="Es. Match LND"
                />

                <Input
                  label="Data"
                  value={eventDate}
                  onChange={setEventDate}
                  type="date"
                />

                <Input
                  label="Ora"
                  value={eventTime}
                  onChange={setEventTime}
                  type="time"
                />

              </div>

              <button
                onClick={addEvent}
                className="mt-5 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-slate-950"
              >
                ➕ Crea evento
              </button>

            </div>

            {events.length === 0 ? (
              <EmptyState
                icon="📅"
                title="Nessun evento"
                text="Crea il primo evento della squadra."
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

                {events
                  .sort((a, b) =>
                    `${a.date}${a.time}`.localeCompare(
                      `${b.date}${b.time}`
                    )
                  )
                  .map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                    >

                      <div className="text-4xl">
                        📅
                      </div>

                      <h3 className="mt-4 text-xl font-bold">
                        {event.name}
                      </h3>

                      <p className="mt-3 text-slate-400">
                        📆 {event.date}
                      </p>

                      {event.time && (
                        <p className="mt-1 text-slate-400">
                          🕘 {event.time}
                        </p>
                      )}

                      <button
                        onClick={() =>
                          deleteEvent(event.id)
                        }
                        className="mt-5 w-full rounded-xl border border-red-500/20 px-4 py-3 text-sm text-red-400"
                      >
                        🗑️ Elimina
                      </button>

                    </div>
                  ))}

              </div>
            )}

          </div>
        )}

        {/* =====================================================
            COMPETITIONS
        ===================================================== */}

        {activeSection === "competitions" && (
          <div>

            <PageHeader
              eyebrow="CALCIO TOTALE"
              title="🏆 Competizioni"
              description="Gestisci tornei, campionati e coppe."
            />

            <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">

              <h3 className="text-xl font-bold">
                ➕ Nuova competizione
              </h3>

              <div className="mt-5 grid gap-5 md:grid-cols-2">

                <Input
                  label="Nome competizione"
                  value={competitionName}
                  onChange={setCompetitionName}
                  placeholder="Es. BIG CUP"
                />

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Tipo
                  </label>

                  <select
                    value={competitionType}
                    onChange={(e) =>
                      setCompetitionType(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                  >
                    <option>Torneo</option>
                    <option>Campionato</option>
                    <option>Cup</option>
                    <option>Amichevole</option>
                    <option>Lega</option>
                  </select>

                </div>

              </div>

              <button
                onClick={addCompetition}
                className="mt-5 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-slate-950"
              >
                🏆 Crea competizione
              </button>

            </div>

            {competitions.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="Nessuna competizione"
                text="Crea la prima competizione."
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

                {competitions.map((competition) => (
                  <div
                    key={competition.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                  >

                    <div className="flex items-start justify-between">

                      <div className="text-4xl">
                        🏆
                      </div>

                      <span
                        className={`rounded-lg px-3 py-1 text-xs font-bold ${
                          competition.status === "Attiva"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {competition.status}
                      </span>

                    </div>

                    <h3 className="mt-5 text-xl font-bold">
                      {competition.name}
                    </h3>

                    <p className="mt-2 text-slate-500">
                      {competition.type}
                    </p>

                    <button
                      onClick={() =>
                        toggleCompetition(competition.id)
                      }
                      className="mt-5 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800"
                    >
                      {competition.status === "Attiva"
                        ? "⏹️ Concludi"
                        : "▶️ Riattiva"}
                    </button>

                  </div>
                ))}

              </div>
            )}

          </div>
        )}

        {/* =====================================================
            VOTES
        ===================================================== */}

        {activeSection === "votes" && (
          <ModulePage
            icon="⭐"
            title="Votazioni"
            text="Sistema di votazione dei giocatori dopo ogni partita."
          >
            <div className="grid gap-5 md:grid-cols-3">

              <InfoBox
                icon="⭐"
                title="Voto partita"
                text="Ogni giocatore potrà ricevere una valutazione."
              />

              <InfoBox
                icon="🎯"
                title="Prestazione"
                text="Valuta la prestazione tecnica e tattica."
              />

              <InfoBox
                icon="🤝"
                title="Fair Play"
                text="Premia comportamento e spirito di squadra."
              />

            </div>
          </ModulePage>
        )}

        {/* =====================================================
            MVP
        ===================================================== */}

        {activeSection === "mvp" && (
          <ModulePage
            icon="👑"
            title="MVP"
            text="Gestione del miglior giocatore della settimana e della stagione."
          >

            <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-10 text-center">

              <div className="text-7xl">
                👑
              </div>

              <h3 className="mt-5 text-3xl font-black">
                MVP DELLA SETTIMANA
              </h3>

              <p className="mt-3 text-slate-400">
                Le votazioni determineranno automaticamente
                il prossimo MVP.
              </p>

            </div>

          </ModulePage>
        )}

        {/* =====================================================
            STATS
        ===================================================== */}

        {activeSection === "stats" && (
          <div>

            <PageHeader
              eyebrow="CALCIO TOTALE"
              title="📊 Statistiche"
              description="Panoramica statistica della squadra."
            />

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

              <StatCard
                icon="👥"
                title="Rosa"
                value={players.length}
                text="Giocatori registrati"
              />

              <StatCard
                icon="🟢"
                title="Attivi"
                value={activePlayers}
                text="Giocatori attivi"
              />

              <StatCard
                icon="🔴"
                title="Inattivi"
                value={inactivePlayers}
                text="Giocatori inattivi"
              />

              <StatCard
                icon="🏆"
                title="Competizioni"
                value={competitions.length}
                text="Competizioni create"
              />

            </div>

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">

              <h3 className="text-xl font-bold">
                📋 Rosa per posizione
              </h3>

              <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">

                {positions.map((pos) => {

                  const count = players.filter(
                    (player) =>
                      player.position === pos.value
                  ).length;

                  return (
                    <div
                      key={pos.value}
                      className="flex items-center justify-between rounded-xl bg-slate-950 p-4"
                    >

                      <span className="text-sm">
                        {pos.label}
                      </span>

                      <span className="rounded-lg bg-slate-800 px-3 py-1 font-bold">
                        {count}
                      </span>

                    </div>
                  );
                })}

              </div>

            </div>

          </div>
        )}

        {/* =====================================================
            ADMIN
        ===================================================== */}

        {activeSection === "admin" && (
          <div>

            <PageHeader
              eyebrow="CALCIO TOTALE"
              title="⚙️ Amministrazione"
              description="Configurazione e gestione del sistema."
            />

            <div className="grid gap-5 md:grid-cols-2">

              <AdminCard
                icon="🗄️"
                title="Database"
                text="Connessione Supabase attiva."
                status="ONLINE"
              />

              <AdminCard
                icon="👥"
                title="Giocatori"
                text={`${players.length} giocatori presenti nel database.`}
                status="OK"
              />

              <AdminCard
                icon="✅"
                title="Presenze"
                text="Sistema presenze collegato a Supabase."
                status="ONLINE"
              />

              <AdminCard
                icon="🔐"
                title="Accesso"
                text="Area amministratore pronta per autenticazione."
                status="DA CONFIGURARE"
              />

            </div>

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">

              <h3 className="text-xl font-bold">
                🧰 Manutenzione
              </h3>

              <div className="mt-5 flex flex-wrap gap-3">

                <button
                  onClick={loadPlayers}
                  className="rounded-xl border border-slate-700 px-5 py-3 hover:bg-slate-800"
                >
                  🔄 Ricarica giocatori
                </button>

                <button
                  onClick={loadPresences}
                  className="rounded-xl border border-slate-700 px-5 py-3 hover:bg-slate-800"
                >
                  🔄 Ricarica presenze
                </button>

              </div>

            </div>

          </div>
        )}

      </section>
    </main>
  );
}

// ===========================================================
// COMPONENTS
// ===========================================================

function PageHeader({
  eyebrow,
  title,
  description,
  buttonText,
  onButton,
}: {
  eyebrow: string;
  title: string;
  description: string;
  buttonText?: string;
  onButton?: () => void;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">

      <div>

        <p className="mb-2 font-bold uppercase tracking-[0.25em] text-emerald-400">
          {eyebrow}
        </p>

        <h2 className="text-4xl font-black md:text-5xl">
          {title}
        </h2>

        <p className="mt-3 text-lg text-slate-400">
          {description}
        </p>

      </div>

      {buttonText && onButton && (
        <button
          onClick={onButton}
          className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-400"
        >
          {buttonText}
        </button>
      )}

    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  text,
}: {
  icon: string;
  title: string;
  value: number;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

      <div className="text-3xl">
        {icon}
      </div>

      <p className="mt-5 text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-1 text-4xl font-black">
        {value}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {text}
      </p>

    </div>
  );
}

function DashboardRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3">

      <span className="text-sm text-slate-300">
        {label}
      </span>

      <span className="font-black">
        {value}
      </span>

    </div>
  );
}

function QuickButton({
  icon,
  text,
  onClick,
}: {
  icon: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-emerald-500/50 hover:bg-slate-800"
    >
      <span className="text-xl">
        {icon}
      </span>

      <span className="ml-3 text-sm font-semibold">
        {text}
      </span>
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-500"
      />

    </div>
  );
}

function PlayerCard({
  player,
  onDelete,
  onToggleStatus,
  onEdit,
}: {
  player: Player;
  onDelete: (player: Player) => void;
  onToggleStatus: (player: Player) => void;
  onEdit: (player: Player) => void;
}) {
  const isActive = player.status === "Attivo";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-emerald-500/40">

      <div className="flex items-start justify-between gap-4">

        <div className="flex items-center gap-4">

          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-3xl">
            ⚽
          </div>

          <div>

            <h3 className="text-xl font-black uppercase">
              {player.name}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              PSN: {player.psn_id}
            </p>

          </div>

        </div>

        <div className="rounded-xl bg-slate-800 px-3 py-2 text-lg font-black">
          #{player.shirt_number}
        </div>

      </div>

      <div className="mt-5 flex flex-wrap gap-2">

        <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm font-bold text-emerald-400">
          {player.position}
        </span>

        <button
          onClick={() => onToggleStatus(player)}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
            isActive
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isActive ? "🟢 Attivo" : "🔴 Inattivo"}
        </button>

      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">

        <button
          onClick={() => onEdit(player)}
          className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-800"
        >
          ✏️ Modifica
        </button>

        <button
          onClick={() => onDelete(player)}
          className="rounded-xl border border-red-500/20 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10"
        >
          🗑️ Elimina
        </button>

      </div>

    </div>
  );
}

function PresenceBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    Presente:
      "bg-emerald-500/10 text-emerald-400",
    Assente:
      "bg-red-500/10 text-red-400",
    "Da confermare":
      "bg-slate-800 text-slate-400",
  };

  return (
    <span
      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
        styles[status] || styles["Da confermare"]
      }`}
    >
      {status}
    </span>
  );
}

function PresenceButton({
  text,
  active,
  onClick,
}: {
  text: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 transition ${
        active
          ? "bg-emerald-500 text-slate-950"
          : "bg-slate-800 hover:bg-slate-700"
      }`}
    >
      {text}
    </button>
  );
}

function Badge({
  text,
}: {
  text: string;
}) {
  return (
    <span className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold">
      {text}
    </span>
  );
}

function Loading() {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-12 text-center">

      <div className="text-5xl">
        ⏳
      </div>

      <p className="mt-4 text-slate-400">
        Caricamento...
      </p>

    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">

      <div className="text-6xl">
        {icon}
      </div>

      <h3 className="mt-5 text-2xl font-black">
        {title}
      </h3>

      <p className="mt-2 text-slate-500">
        {text}
      </p>

    </div>
  );
}

function ModulePage({
  icon,
  title,
  text,
  children,
}: {
  icon: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div>

      <PageHeader
        eyebrow="CALCIO TOTALE"
        title={`${icon} ${title}`}
        description={text}
      />

      {children}

    </div>
  );
}

function InfoBox({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

      <div className="text-4xl">
        {icon}
      </div>

      <h3 className="mt-5 text-xl font-bold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {text}
      </p>

    </div>
  );
}

function AdminCard({
  icon,
  title,
  text,
  status,
}: {
  icon: string;
  title: string;
  text: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

      <div className="flex items-start justify-between">

        <div className="text-4xl">
          {icon}
        </div>

        <span className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
          {status}
        </span>

      </div>

      <h3 className="mt-5 text-xl font-bold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {text}
      </p>

    </div>
  );
}