"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import VotingHub from "../components/VotingHub";
import PlayerProfileModal from "../components/PlayerProfileModal";

type Player = {
  id: string;
  name: string;
  psn_id: string;
  shirt_number: number;
  position: string;
  status: string;
  created_at: string;
};

type PresenceRole = "POR" | "DCD" | "DCC" | "DCS" | "ES" | "ED" | "CCS" | "CDC" | "CCD" | "ATT";

type Presence = {
  id: string;
  player_id: string;
  event_id: string | null;
  presence_date: string;
  status: string;
  note: string | null;
  event_role: PresenceRole | null;
};

type EventItem = {
  id: string;
  name: string;
  event_date: string;
  event_time: string | null;
};

type PlayerAccount = {
  user_id: string;
  player_id: string;
  login_id: string;
  created_at: string;
};

type GeneratedCredentials = {
  playerId: string;
  playerName: string;
  loginId: string;
  password: string;
};

type AdminAccount = {
  user_id: string;
  login_id: string;
  display_name: string | null;
  created_at: string;
};

type GeneratedAdminCredentials = {
  displayName: string;
  loginId: string;
  password: string;
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

// Ruoli validi per la singola presenza, indipendenti dal ruolo fisso del giocatore.
const presenceRoles: PresenceRole[] = ["POR", "DCD", "DCC", "DCS", "ES", "ED", "CCS", "CDC", "CCD", "ATT"];

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

function normalizeLoginId(value: string) {
  return value.trim().toUpperCase();
}

function isValidLoginId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(value.trim());
}

function playerLoginEmail(loginId: string) {
  return `${normalizeLoginId(loginId).toLowerCase()}@players.calciototale.invalid`;
}

function adminLoginEmail(loginId: string) {
  return `${loginId.trim().toLowerCase()}@admins.calciototale.invalid`;
}

export default function Home() {
  const [activeSection, setActiveSection] = useState("dashboard");

  // =========================================================
  // ADMIN AUTHENTICATION
  // =========================================================
  const [showLogin, setShowLogin] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showPlayerLogin, setShowPlayerLogin] = useState(false);
  const [playerLoginId, setPlayerLoginId] = useState("");
  const [playerPassword, setPlayerPassword] = useState("");
  const [playerAuthError, setPlayerAuthError] = useState("");
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
  const [sessionPlayerName, setSessionPlayerName] = useState("");
  const [playerAccounts, setPlayerAccounts] = useState<PlayerAccount[]>([]);
  const [loginIdDrafts, setLoginIdDrafts] = useState<Record<string, string>>({});
  const [accountLoadingId, setAccountLoadingId] = useState<string | null>(null);
  const [generatedCredentials, setGeneratedCredentials] =
    useState<GeneratedCredentials | null>(null);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminLoginId, setNewAdminLoginId] = useState("");
  const [adminAccountLoadingId, setAdminAccountLoadingId] = useState<string | null>(null);
  const [generatedAdminCredentials, setGeneratedAdminCredentials] =
    useState<GeneratedAdminCredentials | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);

  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingPresences, setLoadingPresences] = useState(true);

  const [saving, setSaving] = useState(false);
  const [resettingPresences, setResettingPresences] = useState(false);

  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);

  const [name, setName] = useState("");
  const [psnId, setPsnId] = useState("");
  const [shirtNumber, setShirtNumber] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("Attivo");

  const [search, setSearch] = useState("");

  const [presenceDate, setPresenceDate] = useState(today);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [presenceRolePickerPlayerId, setPresenceRolePickerPlayerId] = useState<string | null>(null);
  const [presenceRoleDrafts, setPresenceRoleDrafts] = useState<Record<string, PresenceRole | "">>({});
  const [presenceRoleFilter, setPresenceRoleFilter] = useState<PresenceRole | "">("");

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
  // ADMIN AUTHENTICATION
  // =========================================================

  const loadPlayerAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("player_accounts")
      .select("user_id, player_id, login_id, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Errore caricamento accessi giocatore:", error);
      setPlayerAccounts([]);
      return;
    }

    const accounts = (data || []) as PlayerAccount[];
    setPlayerAccounts(accounts);
    setLoginIdDrafts((current) => {
      const next = { ...current };
      for (const account of accounts) {
        if (next[account.player_id] === undefined) {
          next[account.player_id] = account.login_id;
        }
      }
      return next;
    });
  }, []);

  const loadAdminAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_accounts")
      .select("user_id, login_id, display_name, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Errore caricamento accessi amministratori:", error);
      setAdminAccounts([]);
      return;
    }

    setAdminAccounts((data || []) as AdminAccount[]);
  }, []);

  const checkSession = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsAdmin(false);
      setIsOwner(false);
      setSessionPlayerId(null);
      setSessionPlayerName("");
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_owner")
      .eq("id", user.id)
      .single();

    if (!error && profile?.role === "admin") {
      setIsAdmin(true);
      setIsOwner(Boolean(profile.is_owner));
      setSessionPlayerId(null);
      setSessionPlayerName("");
      await Promise.all([
        loadPlayerAccounts(),
        profile.is_owner ? loadAdminAccounts() : Promise.resolve(),
      ]);
    } else {
      const { data: account, error: accountError } = await supabase
        .from("player_accounts")
        .select("player_id, login_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!accountError && account) {
        setIsAdmin(false);
        setIsOwner(false);
        setSessionPlayerId(account.player_id);
        setSessionPlayerName(account.login_id);
      } else {
        await supabase.auth.signOut();
        setIsAdmin(false);
        setIsOwner(false);
        setSessionPlayerId(null);
        setSessionPlayerName("");
      }
    }
  }, [loadAdminAccounts, loadPlayerAccounts]);

  async function handleAdminLogin() {
    const identifier = authEmail.trim();

    if (!identifier.includes("@") && !isValidLoginId(identifier)) {
      setAuthError("Inserisci un’email o un ID amministratore valido.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.includes("@")
        ? identifier.toLowerCase()
        : adminLoginEmail(identifier),
      password: authPassword,
    });

    if (error || !data.user) {
      setAuthError("Email/ID o password non corretti.");
      setAuthLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_owner")
      .eq("id", data.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      await supabase.auth.signOut();
      setIsAdmin(false);
      setIsOwner(false);
      setAuthError("Accesso negato: questo utente non è amministratore.");
      setAuthLoading(false);
      return;
    }

    setIsAdmin(true);
    setIsOwner(Boolean(profile.is_owner));
    setSessionPlayerId(null);
    setSessionPlayerName("");
    setShowLogin(false);
    setAuthPassword("");
    setAuthError("");
    setActiveSection("admin");
    await Promise.all([
      loadPlayerAccounts(),
      profile.is_owner ? loadAdminAccounts() : Promise.resolve(),
    ]);
    setAuthLoading(false);
  }

  async function handlePlayerLogin() {
    const loginId = normalizeLoginId(playerLoginId);

    if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(loginId)) {
      setPlayerAuthError("Inserisci un ID giocatore valido.");
      return;
    }

    setAuthLoading(true);
    setPlayerAuthError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: playerLoginEmail(loginId),
      password: playerPassword,
    });

    if (error || !data.user) {
      setPlayerAuthError("ID giocatore o password non corretti.");
      setAuthLoading(false);
      return;
    }

    const { data: account, error: accountError } = await supabase
      .from("player_accounts")
      .select("player_id, login_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (accountError || !account) {
      await supabase.auth.signOut();
      setPlayerAuthError("Questo account non è collegato a un giocatore.");
      setAuthLoading(false);
      return;
    }

    setIsAdmin(false);
    setIsOwner(false);
    setSessionPlayerId(account.player_id);
    setSessionPlayerName(account.login_id);
    setShowPlayerLogin(false);
    setPlayerLoginId("");
    setPlayerPassword("");
    setActiveSection("presences");
    setAuthLoading(false);

    await Promise.all([loadPlayers(), loadEvents()]);
  }

  async function handleAdminLogout() {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsOwner(false);
    setShowLogin(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setPlayerAccounts([]);
    setLoginIdDrafts({});
    setGeneratedCredentials(null);
    setAdminAccounts([]);
    setNewAdminName("");
    setNewAdminLoginId("");
    setGeneratedAdminCredentials(null);
    setActiveSection("dashboard");
  }

  async function handlePlayerLogout() {
    await supabase.auth.signOut();
    setIsOwner(false);
    setSessionPlayerId(null);
    setSessionPlayerName("");
    setShowPlayerLogin(false);
    setPlayerLoginId("");
    setPlayerPassword("");
    setPlayerAuthError("");
    setActiveSection("dashboard");

    await Promise.all([loadPlayers(), loadEvents()]);
  }

  useEffect(() => {
    const sessionCheck = window.setTimeout(() => {
      void checkSession();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setIsAdmin(false);
        setIsOwner(false);
        setSessionPlayerId(null);
        setSessionPlayerName("");
      }
    });

    return () => {
      window.clearTimeout(sessionCheck);
      subscription.unsubscribe();
    };
  }, [checkSession]);

  async function managePlayerAccount(
    player: Player,
    action: "create" | "reset_password" | "update_login_id"
  ) {
    const requestedLoginId = (loginIdDrafts[player.id] || "").trim();

    if (
      (action === "update_login_id" || requestedLoginId) &&
      !isValidLoginId(requestedLoginId)
    ) {
      alert("L’ID deve contenere da 3 a 32 caratteri: lettere, numeri, _ oppure -.");
      return;
    }

    setAccountLoadingId(player.id);
    setGeneratedCredentials(null);

    const { data, error } = await supabase.functions.invoke(
      "manage-player-account",
      {
        body: {
          action,
          player_id: player.id,
          login_id: requestedLoginId || undefined,
        },
      }
    );

    setAccountLoadingId(null);

    if (
      error ||
      !data?.login_id ||
      (action !== "update_login_id" && !data?.password)
    ) {
      const message = data?.error || error?.message || "Operazione non riuscita.";
      alert(`Errore accesso giocatore:\n${message}`);
      return;
    }

    setLoginIdDrafts((current) => ({
      ...current,
      [player.id]: data.login_id,
    }));

    if (action === "update_login_id") {
      await loadPlayerAccounts();
      alert(`ID di ${player.name} aggiornato in ${data.login_id}.`);
      return;
    }

    setGeneratedCredentials({
      playerId: player.id,
      playerName: player.name,
      loginId: data.login_id,
      password: data.password,
    });

    await loadPlayerAccounts();
  }

  async function manageAdminAccount(
    action: "create" | "reset_password",
    account?: AdminAccount
  ) {
    const loginId = newAdminLoginId.trim();

    if (action === "create" && loginId && !isValidLoginId(loginId)) {
      alert("L’ID Admin deve contenere da 3 a 32 caratteri: lettere, numeri, _ oppure -.");
      return;
    }

    setAdminAccountLoadingId(account?.user_id || "new");
    setGeneratedAdminCredentials(null);

    const { data, error } = await supabase.functions.invoke(
      "manage-admin-account",
      {
        body: action === "create"
          ? {
              action,
              login_id: loginId || undefined,
              display_name: newAdminName.trim() || undefined,
            }
          : {
              action,
              user_id: account?.user_id,
            },
      }
    );

    setAdminAccountLoadingId(null);

    if (error || !data?.login_id || !data?.password) {
      const message = data?.error || error?.message || "Operazione non riuscita.";
      alert(`Errore accesso amministratore:\n${message}`);
      return;
    }

    setGeneratedAdminCredentials({
      displayName: data.display_name || account?.display_name || data.login_id,
      loginId: data.login_id,
      password: data.password,
    });

    if (action === "create") {
      setNewAdminName("");
      setNewAdminLoginId("");
    }

    await loadAdminAccounts();
  }

  // =========================================================
  // EVENTS
  // =========================================================

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

  const loadPresences = useCallback(async () => {
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
  }, [presenceDate, selectedEventId]);

  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, event_date, event_time")
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true });

    if (error) {
      console.error("Errore caricamento eventi:", error);
      alert("Errore durante il caricamento degli eventi.");
      return;
    }

    const loaded = (data || []) as EventItem[];
    setEvents(loaded);
  }

  useEffect(() => {
    loadPlayers();
    loadEvents();
  }, []);

  useEffect(() => {
    const presenceLoad = window.setTimeout(() => {
      void loadPresences();
    }, 0);

    return () => window.clearTimeout(presenceLoad);
  }, [loadPresences]);

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
        (!selectedEventId || presence.event_id === selectedEventId)
    );
  }

  function openPresenceRolePicker(player: Player) {
    const existing = getPresence(player.id);
    setPresenceRoleDrafts((current) => ({
      ...current,
      [player.id]: existing?.event_role || "",
    }));
    setPresenceRolePickerPlayerId(player.id);
  }

  async function savePresence(
    player: Player,
    newStatus: string,
    eventRole: PresenceRole | null = null
  ) {
    if (!selectedEventId) {
      alert("Seleziona prima un evento.");
      return;
    }

    if (newStatus === "Presente" && !eventRole) {
      alert("Scegli il ruolo per questa serata.");
      return;
    }

    const existing = getPresence(player.id);
    const selectedEvent = events.find(
      (event) => event.id === selectedEventId
    );

    if (!selectedEvent) {
      alert("L'evento selezionato non è disponibile.");
      return;
    }

    const payload = {
      player_id: player.id,
      event_id: selectedEvent.id,
      presence_date: selectedEvent.event_date,
      status: newStatus,
      note: existing?.note || null,
      event_role: newStatus === "Presente" ? eventRole : null,
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
            item.id === data.id ? (data as Presence) : item
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
        setPresences((current) => [...current, data as Presence]);
      }
    }

    setPresenceRolePickerPlayerId(null);
  }

  async function resetSelectedEventPresences() {
    if (!selectedEventId) {
      alert("Seleziona prima un evento nella sezione Presenze.");
      return;
    }

    const selectedEvent = events.find((event) => event.id === selectedEventId);
    if (!selectedEvent) {
      alert("L'evento selezionato non è disponibile.");
      return;
    }

    const confirmed = window.confirm(
      `Vuoi riportare a “Da confermare” tutte le presenze dell'evento ${selectedEvent.name} del ${selectedEvent.event_date}?\n\nNon verranno modificati altri eventi, giocatori o note.`
    );
    if (!confirmed) return;

    setResettingPresences(true);
    const { data, error } = await supabase.functions.invoke("reset-event-presences", {
      body: { event_id: selectedEvent.id },
    });
    setResettingPresences(false);

    if (error) {
      alert(`Impossibile reimpostare le presenze:\n${error.message}`);
      return;
    }

    await loadPresences();
    alert(`${data?.reset_count || 0} presenze riportate a “Da confermare”.`);
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

  async function addEvent() {
    if (!eventName.trim()) {
      alert("Inserisci il nome dell'evento.");
      return;
    }

    if (!eventDate) {
      alert("Seleziona la data.");
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        name: eventName.trim(),
        event_date: eventDate,
        event_time: eventTime || null,
      })
      .select("id, name, event_date, event_time")
      .single();

    if (error || !data) {
      alert(`Errore salvataggio evento:\n${error?.message || "Evento non creato."}`);
      return;
    }

    setEvents((current) => [...current, data as EventItem]);
    setSelectedEventId(data.id);
    setPresenceDate(data.event_date);

    setEventName("");
    setEventDate("");
    setEventTime("");
  }

  function openEditEvent(event: EventItem) {
    setEditingEventId(event.id);
    setEventName(event.name);
    setEventDate(event.event_date);
    setEventTime(event.event_time ? event.event_time.slice(0, 5) : "");
  }

  function cancelEditEvent() {
    setEditingEventId(null);
    setEventName("");
    setEventDate("");
    setEventTime("");
  }

  async function saveEvent() {
    if (!editingEventId) return;

    if (!eventName.trim()) {
      alert("Inserisci il nome dell'evento.");
      return;
    }

    if (!eventDate) {
      alert("Seleziona la data.");
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .update({
        name: eventName.trim(),
        event_date: eventDate,
        event_time: eventTime || null,
      })
      .eq("id", editingEventId)
      .select("id, name, event_date, event_time")
      .single();

    if (error || !data) {
      alert(`Errore modifica evento:\n${error?.message || "Evento non aggiornato."}`);
      return;
    }

    setEvents((current) =>
      current.map((event) => (event.id === data.id ? (data as EventItem) : event))
    );

    if (selectedEventId === data.id) {
      setPresenceDate(data.event_date);
    }

    cancelEditEvent();
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`Errore eliminazione evento:\n${error.message}`);
      return;
    }

    setEvents((current) => current.filter((event) => event.id !== id));

    if (selectedEventId === id) {
      setSelectedEventId("");
    }
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

  const isPlayer = Boolean(sessionPlayerId) && !isAdmin;
  const visibleMenu = isAdmin
    ? menu
    : isPlayer
      ? menu.filter((item) =>
          ["dashboard", "presences", "events", "votes", "mvp"].includes(item.id)
        )
      : menu.filter((item) =>
          ["dashboard", "events", "votes", "mvp", "stats"].includes(item.id)
        );
  const presencePlayers = isPlayer
    ? players.filter((player) => player.id === sessionPlayerId)
    : players;
  const presenceDepartments = [
    { title: "🧤 CT | PORTIERI", positions: ["POR"] },
    { title: "🛡️ CT | DIFESA", positions: ["DCD", "DCC", "DCS"] },
    { title: "⚡ CT | ESTERNI", positions: ["ES", "ED"] },
    { title: "🎯 CT | CENTROCAMPO", positions: ["CCS", "CDC", "CCD"] },
    { title: "🔥 CT | ATTACCO", positions: ["ATT (PS)", "ATT (PD)"] },
  ];

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
            className="flex items-center gap-3 text-left"
          >
            <Image
              src="/calcio-totale-2026-logo.png"
              alt="Logo ufficiale Calcio Totale 2026"
              width={56}
              height={56}
              unoptimized
              priority
              className="h-12 w-12 object-contain sm:h-14 sm:w-14"
            />
            <div>
              <h1 className="text-2xl font-black">
                CALCIO <span className="text-emerald-400">TOTALE</span>
              </h1>
              <p className="text-xs text-slate-500">Team Management System</p>
            </div>
          </button>

          <div className="flex items-center gap-3">

            <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 md:block">
              ● Sistema Online
            </span>

            {!isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (isPlayer) {
                    handlePlayerLogout();
                  } else {
                    setPlayerAuthError("");
                    setShowPlayerLogin(true);
                  }
                }}
                className="min-h-11 touch-manipulation rounded-xl border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400 transition hover:bg-emerald-500/10"
              >
                {isPlayer ? `🚪 ${sessionPlayerName}` : "👤 Giocatore"}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  setActiveSection("admin");
                } else {
                  setAuthError("");
                  setShowLogin(true);
                }
              }}
              className="min-h-11 touch-manipulation rounded-xl border border-slate-700 px-4 py-2 text-sm transition hover:bg-slate-800"
            >
              ⚙️ Admin
            </button>

          </div>
        </div>
      </header>

      {/* MENU */}

      <div className="border-b border-slate-800 bg-slate-900/70">

        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">

          {visibleMenu.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                if (item.id === "admin" && !isAdmin) {
                  setAuthError("");
                  setShowLogin(true);
                  return;
                }

                setActiveSection(item.id);
              }}
              className={`min-h-11 touch-manipulation whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
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

              <Image
                src="/calcio-totale-2026-logo.png"
                alt="Logo ufficiale Calcio Totale 2026"
                width={160}
                height={160}
                unoptimized
                priority
                className="mx-auto mb-6 h-32 w-32 object-contain sm:h-40 sm:w-40"
              />

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

                  {isAdmin && (
                    <QuickButton
                      icon="➕"
                      text="Nuovo giocatore"
                      onClick={openPlayerForm}
                    />
                  )}

                  <QuickButton
                    icon="✅"
                    text={isPlayer ? "La mia presenza" : isAdmin ? "Gestisci presenze" : "Accesso giocatore"}
                    onClick={() => {
                      if (isAdmin || isPlayer) {
                        setActiveSection("presences");
                      } else {
                        setPlayerAuthError("");
                        setShowPlayerLogin(true);
                      }
                    }}
                  />

                  <QuickButton
                    icon="📅"
                    text={isAdmin ? "Nuovo evento" : "Vedi eventi"}
                    onClick={() =>
                      setActiveSection("events")
                    }
                  />

                  {isAdmin && (
                    <QuickButton
                      icon="🏆"
                      text="Competizioni"
                      onClick={() =>
                        setActiveSection("competitions")
                      }
                    />
                  )}

                </div>

              </div>

            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">

              {visibleMenu.filter((item) => item.id !== "dashboard").map((item) => (
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
              buttonText={isAdmin ? "➕ Nuovo giocatore" : undefined}
              onButton={isAdmin ? openPlayerForm : undefined}
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
                    label="ID PlayStation"
                    value={name}
                    onChange={setName}
                    placeholder="Es. ID PlayStation"
                  />

                  <Input
                    label="ID EA"
                    value={psnId}
                    onChange={setPsnId}
                    placeholder="Es. ID EA"
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
              placeholder="🔎 Cerca per ID PlayStation, ID EA o posizione..."
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
                    onProfile={setProfilePlayer}
                    canManage={isAdmin}
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

            <div className="mb-6 grid gap-5 md:grid-cols-2">

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                <label className="mb-2 block text-sm font-semibold">
                  Evento
                </label>

                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                >
                  <option value="">Seleziona un evento</option>

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

                {isAdmin && (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold">
                      Filtra presenti per ruolo
                    </label>
                    <select
                      value={presenceRoleFilter}
                      onChange={(e) => setPresenceRoleFilter(e.target.value as PresenceRole | "")}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="">Tutti i ruoli</option>
                      {presenceRoles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                )}

              </div>

            </div>

            {loadingPresences ? (
              <Loading />
            ) : (
              <div className="space-y-5">
                {presenceDepartments.map((department) => {
                  const departmentPlayers = presencePlayers.filter((player) => {
                    const presence = getPresence(player.id);
                    return (
                      player.status === "Attivo" &&
                      department.positions.includes(player.position) &&
                      (!isAdmin ||
                        !presenceRoleFilter ||
                        (presence?.status === "Presente" &&
                          presence.event_role === presenceRoleFilter))
                    );
                  });
                  if (departmentPlayers.length === 0) return null;

                  return (
                    <section
                      key={department.title}
                      className="overflow-hidden rounded-3xl border border-slate-800"
                    >
                      <h2 className="bg-slate-900 px-5 py-4 text-lg font-bold">
                        {department.title}
                      </h2>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-900">
                            <tr className="text-left text-sm text-slate-400">
                              <th className="px-5 py-4">Giocatore</th>
                              <th className="px-5 py-4">Posizione</th>
                              <th className="px-5 py-4">Stato</th>
                              <th className="px-5 py-4">Ruolo serata</th>
                              <th className="px-5 py-4">Azione</th>
                            </tr>
                          </thead>
                          <tbody>
                            {departmentPlayers.map((player) => {
                              const presence = getPresence(player.id);

                              return (
                                <tr key={player.id} className="border-t border-slate-800">
                                  <td className="px-5 py-4">
                                    <div className="font-bold">{player.name}</div>
                                    <div className="text-xs text-slate-500">{player.psn_id}</div>
                                  </td>
                                  <td className="px-5 py-4">{player.position}</td>
                                  <td className="px-5 py-4">
                                    <PresenceBadge status={presence?.status || "Da confermare"} />
                                  </td>
                                  <td className="px-5 py-4 text-sm font-semibold text-emerald-300">
                                    {presence?.status === "Presente" && presence.event_role
                                      ? presence.event_role
                                      : "—"}
                                  </td>
                                  <td className="px-5 py-4">
                                    {(isAdmin || player.id === sessionPlayerId) ? (
                                      <>
                                      <div className="flex flex-wrap gap-2">
                                        <PresenceButton
                                          text="🟢"
                                          active={presence?.status === "Presente"}
                                          onClick={() => openPresenceRolePicker(player)}
                                        />
                                        <PresenceButton
                                          text="🔴"
                                          active={presence?.status === "Assente"}
                                          onClick={() => savePresence(player, "Assente")}
                                        />
                                      </div>

                                      {presenceRolePickerPlayerId === player.id && (
                                        <div className="mt-3 w-full min-w-56">
                                          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                                            Ruolo per questa serata
                                          </label>
                                          <div className="flex flex-wrap gap-2">
                                            <select
                                              value={presenceRoleDrafts[player.id] || ""}
                                              onChange={(e) =>
                                                setPresenceRoleDrafts((current) => ({
                                                  ...current,
                                                  [player.id]: e.target.value as PresenceRole | "",
                                                }))
                                              }
                                              className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                            >
                                              <option value="">Scegli ruolo</option>
                                              {presenceRoles.map((role) => (
                                                <option key={role} value={role}>{role}</option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                savePresence(
                                                  player,
                                                  "Presente",
                                                  presenceRoleDrafts[player.id] || null
                                                )
                                              }
                                              className="min-h-11 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
                                            >
                                              Conferma
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      </>
                                    ) : (
                                      <span className="text-sm text-slate-500">Sola lettura</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
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

            {isAdmin && (
            <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">

              <h3 className="text-xl font-bold">
                {editingEventId ? "✏️ Modifica evento" : "➕ Nuovo evento"}
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

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={editingEventId ? saveEvent : addEvent}
                  className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-slate-950"
                >
                  {editingEventId ? "💾 Salva modifiche" : "➕ Crea evento"}
                </button>

                {editingEventId && (
                  <button
                    type="button"
                    onClick={cancelEditEvent}
                    className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Annulla
                  </button>
                )}
              </div>

            </div>
            )}

            {events.length === 0 ? (
              <EmptyState
                icon="📅"
                title="Nessun evento"
                text="Crea il primo evento della squadra."
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

                {[...events]
                  .sort((a, b) =>
                    `${a.event_date}${a.event_time ?? ""}`.localeCompare(
                      `${b.event_date}${b.event_time ?? ""}`
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
                        📆 {event.event_date}
                      </p>

                      {event.event_time && (
                        <p className="mt-1 text-slate-400">
                          🕘 {event.event_time}
                        </p>
                      )}

                      {isAdmin && (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => openEditEvent(event)}
                            className="flex-1 rounded-xl border border-emerald-500/30 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
                          >
                            ✏️ Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEvent(event.id)}
                            className="flex-1 rounded-xl border border-red-500/20 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                          >
                            🗑️ Elimina
                          </button>
                        </div>
                      )}

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
          <VotingHub
            players={players}
            matches={events}
            isAdmin={isAdmin}
            view="votes"
          />
        )}

        {/* =====================================================
            MVP
        ===================================================== */}

        {activeSection === "mvp" && (
          <VotingHub
            players={players}
            matches={events}
            isAdmin={isAdmin}
            view="mvp"
          />
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

        {activeSection === "admin" && isAdmin && (
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
                text="Autenticazione Supabase attiva. Ruolo admin verificato."
                status="PROTETTO"
              />
            </div>

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">
              <div>
                <h3 className="text-xl font-bold">🔑 Accessi giocatori</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Scrivi un ID personale oppure lascia il campo vuoto per generarne uno automatico. Ogni ID deve essere unico.
                </p>
              </div>

              {generatedCredentials && (
                <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
                  <p className="font-black text-emerald-400">
                    Credenziali per {generatedCredentials.playerName}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs uppercase text-slate-500">ID giocatore</p>
                      <p className="mt-1 font-mono text-lg font-bold">{generatedCredentials.loginId}</p>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-4">
                      <p className="text-xs uppercase text-slate-500">Password temporanea</p>
                      <p className="mt-1 break-all font-mono text-lg font-bold">{generatedCredentials.password}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(
                      `Calcio Totale\nID: ${generatedCredentials.loginId}\nPassword: ${generatedCredentials.password}\nhttps://calciototale.vercel.app`
                    )}
                    className="mt-4 min-h-11 touch-manipulation rounded-xl bg-emerald-500 px-5 py-3 font-black text-slate-950"
                  >
                    📋 Copia per WhatsApp
                  </button>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {players.map((player) => {
                  const account = playerAccounts.find(
                    (item) => item.player_id === player.id
                  );
                  const loading = accountLoadingId === player.id;

                  return (
                    <div
                      key={player.id}
                      className="grid gap-4 rounded-2xl bg-slate-950 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)_auto] lg:items-center"
                    >
                      <div>
                        <p className="font-bold">{player.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {account ? `ID: ${account.login_id}` : "Nessun accesso creato"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          ID personale
                        </label>
                        <input
                          type="text"
                          value={loginIdDrafts[player.id] ?? account?.login_id ?? ""}
                          onChange={(event) => setLoginIdDrafts((current) => ({
                            ...current,
                            [player.id]: event.target.value,
                          }))}
                          maxLength={32}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="es. floryn03 (opzionale)"
                          className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none transition focus:border-emerald-500"
                        />
                        <p className="mt-1 text-xs text-slate-600">
                          {account
                            ? "Puoi modificarlo e premere Salva ID."
                            : "Se resta vuoto verrà creato un codice CT automatico."}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        {account ? (
                          <>
                            <button
                              type="button"
                              disabled={
                                loading ||
                                !loginIdDrafts[player.id]?.trim() ||
                                loginIdDrafts[player.id].trim() === account.login_id
                              }
                              onClick={() => managePlayerAccount(player, "update_login_id")}
                              className="min-h-11 touch-manipulation rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
                            >
                              {loading ? "⏳ Attendi..." : "💾 Salva ID"}
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => managePlayerAccount(player, "reset_password")}
                              className="min-h-11 touch-manipulation rounded-xl border border-emerald-500/30 px-5 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              {loading ? "⏳ Attendi..." : "🔄 Nuova password"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => managePlayerAccount(player, "create")}
                            className="min-h-11 touch-manipulation rounded-xl border border-emerald-500/30 px-5 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                          >
                            {loading ? "⏳ Attendi..." : "➕ Crea accesso"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isOwner && (
              <div className="mt-8 rounded-3xl border border-amber-500/30 bg-slate-900 p-7">
                <div>
                  <h3 className="text-xl font-bold">👑 Accessi amministratori</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Crea i tre accessi Admin separati. Solo il proprietario può gestire questa sezione.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Nome amministratore
                    </label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(event) => setNewAdminName(event.target.value)}
                      maxLength={50}
                      placeholder="Es. Vice allenatore"
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      ID Admin
                    </label>
                    <input
                      type="text"
                      value={newAdminLoginId}
                      onChange={(event) => setNewAdminLoginId(event.target.value)}
                      maxLength={32}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Es. admin1 (opzionale)"
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-amber-400"
                    />
                    <p className="mt-1 text-xs text-slate-600">
                      Se resta vuoto verrà creato un codice ADM automatico.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={adminAccountLoadingId === "new"}
                    onClick={() => manageAdminAccount("create")}
                    className="min-h-11 touch-manipulation rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                  >
                    {adminAccountLoadingId === "new"
                      ? "⏳ Creazione..."
                      : "➕ Crea Admin"}
                  </button>
                </div>

                {generatedAdminCredentials && (
                  <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5">
                    <p className="font-black text-amber-300">
                      Credenziali Admin per {generatedAdminCredentials.displayName}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-950 p-4">
                        <p className="text-xs uppercase text-slate-500">ID amministratore</p>
                        <p className="mt-1 font-mono text-lg font-bold">
                          {generatedAdminCredentials.loginId}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-950 p-4">
                        <p className="text-xs uppercase text-slate-500">Password temporanea</p>
                        <p className="mt-1 break-all font-mono text-lg font-bold">
                          {generatedAdminCredentials.password}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(
                        `Calcio Totale — Admin\nID: ${generatedAdminCredentials.loginId}\nPassword: ${generatedAdminCredentials.password}\nhttps://calciototale.vercel.app`
                      )}
                      className="mt-4 min-h-11 touch-manipulation rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950"
                    >
                      📋 Copia credenziali Admin
                    </button>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  {adminAccounts.length === 0 ? (
                    <p className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-500">
                      Nessun Admin aggiuntivo creato.
                    </p>
                  ) : (
                    adminAccounts.map((account) => {
                      const loading = adminAccountLoadingId === account.user_id;
                      return (
                        <div
                          key={account.user_id}
                          className="flex flex-col gap-3 rounded-2xl bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-bold">
                              {account.display_name || "Amministratore"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              ID: {account.login_id}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => manageAdminAccount("reset_password", account)}
                            className="min-h-11 touch-manipulation rounded-xl border border-amber-400/30 px-5 py-3 text-sm font-bold text-amber-300 hover:bg-amber-400/10 disabled:opacity-50"
                          >
                            {loading ? "⏳ Attendi..." : "🔄 Nuova password"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold">
                    🧰 Manutenzione
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Operazioni amministrative del sistema.
                  </p>
                </div>

                <button
                  onClick={handleAdminLogout}
                  className="rounded-xl border border-red-500/30 px-5 py-3 font-semibold text-red-400 hover:bg-red-500/10"
                >
                  🚪 Logout amministratore
                </button>
              </div>

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

                <button
                  type="button"
                  onClick={resetSelectedEventPresences}
                  disabled={resettingPresences}
                  className="rounded-xl border border-amber-400/40 px-5 py-3 font-semibold text-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resettingPresences
                    ? "⏳ Reimpostazione…"
                    : "↺ Reimposta presenze evento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            ADMIN LOGIN
        ===================================================== */}

        {showLogin && !isAdmin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold uppercase tracking-[0.25em] text-emerald-400">
                    CALCIO TOTALE
                  </p>
                  <h2 className="mt-2 text-3xl font-black">
                    🔐 Login Amministratore
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Usa la tua email oppure l’ID Admin ricevuto dal proprietario.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (!authLoading) {
                      setShowLogin(false);
                      setAuthError("");
                    }
                  }}
                  disabled={authLoading}
                  className="text-2xl text-slate-500 hover:text-white disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAdminLogin();
                }}
                className="mt-7 space-y-5"
              >
                <Input
                  label="Email o ID amministratore"
                  value={authEmail}
                  onChange={setAuthEmail}
                  placeholder="Es. admin1 o nome@email.com"
                />

                <Input
                  label="Password"
                  value={authPassword}
                  onChange={setAuthPassword}
                  placeholder="Inserisci la password"
                  type="password"
                />

                {authError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading || !authEmail || !authPassword}
                  className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authLoading
                    ? "⏳ Verifica in corso..."
                    : "🔓 Accedi"}
                </button>
              </form>
            </div>
          </div>
        )}

        {showPlayerLogin && !isAdmin && !isPlayer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
              <div className="relative text-center">
                <div className="pr-11">
                  <p className="font-bold uppercase tracking-[0.25em] text-emerald-400">
                    CALCIO TOTALE
                  </p>
                  <h2 className="mt-3 flex items-center justify-center gap-3 text-3xl font-black">
                    <Image
                      src="/calcio-totale-2026-logo.png"
                      alt="Logo Calcio Totale"
                      width={52}
                      height={52}
                      unoptimized
                      className="h-12 w-12 object-contain"
                    />
                    <span>Accesso giocatore</span>
                  </h2>
                  <p className="mt-3 text-sm text-slate-400">
                    Usa l’ID e la password ricevuti dall’amministratore.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!authLoading) {
                      setShowPlayerLogin(false);
                      setPlayerAuthError("");
                    }
                  }}
                  disabled={authLoading}
                  className="absolute right-0 top-0 min-h-11 min-w-11 touch-manipulation text-2xl text-slate-500 hover:text-white disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handlePlayerLogin();
                }}
                className="mt-7 space-y-5"
              >
                <Input
                  label="ID giocatore"
                  value={playerLoginId}
                  onChange={setPlayerLoginId}
                  placeholder="Es. ID PlayStation"
                />
                <Input
                  label="Password"
                  value={playerPassword}
                  onChange={setPlayerPassword}
                  placeholder="Inserisci la password"
                  type="password"
                />

                {playerAuthError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {playerAuthError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading || !playerLoginId || !playerPassword}
                  className="min-h-12 w-full touch-manipulation rounded-xl bg-emerald-500 px-6 py-3 font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authLoading ? "⏳ Accesso..." : "🔓 Entra"}
                </button>
              </form>
            </div>
          </div>
        )}

        {profilePlayer && (
          <PlayerProfileModal
            player={profilePlayer}
            isAdmin={isAdmin}
            onPlayerUpdated={(updatedPlayer) => {
              setPlayers((current) => current.map((item) => item.id === updatedPlayer.id ? { ...item, ...updatedPlayer } : item));
              setProfilePlayer((current) => current && current.id === updatedPlayer.id ? { ...current, ...updatedPlayer } : current);
            }}
            onClose={() => setProfilePlayer(null)}
          />
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
  onProfile,
  canManage,
}: {
  player: Player;
  onDelete: (player: Player) => void;
  onToggleStatus: (player: Player) => void;
  onEdit: (player: Player) => void;
  onProfile: (player: Player) => void;
  canManage: boolean;
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
              ID EA: {player.psn_id}
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

        {canManage ? (
          <button
            type="button"
            onClick={() => onToggleStatus(player)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
            isActive
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
          >
            {isActive ? "🟢 Attivo" : "🔴 Inattivo"}
          </button>
        ) : (
          <span
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              isActive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {isActive ? "🟢 Attivo" : "🔴 Inattivo"}
          </span>
        )}

      </div>

      <button
        type="button"
        onClick={() => onProfile(player)}
        className="mt-5 min-h-11 w-full rounded-xl border border-emerald-500/30 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/10"
      >
        🪪 Vedi card giocatore
      </button>

      {canManage && (
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
      )}

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
    "In dubbio":
      "bg-yellow-500/10 text-yellow-400",
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
