"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import PlayerCard, { emptyPlayerCard, type CardPlayer, type PlayerCardData } from "./PlayerCard";
import { roomWeek, weekEnd, growthPlayers, goalProgress, safeVideoUrl, type RoomEvent, type RoomReport, type RoomRating } from "../lib/teamRoom";

type Week = { week_start:string; title:string; description:string; metric:string; target:number; manual_progress:number; featured_player_id:string|null; featured_note:string };
type Moment = { id:string; title:string; caption:string; media_path:string|null; media_type:"image"|"video"|null; video_url:string|null; archived:boolean; created_at:string; signed?:string };
type Data = { events:RoomEvent[]; reports:RoomReport[]; ratings:RoomRating[]; stats:{match_id:string;goals:number;assists:number}[]; cards:(PlayerCardData & {player_id:string})[] };
const box = "rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7";
const input = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white";
const button = "min-h-11 rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-50";
const secondary = "min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 disabled:opacity-50";
const freshWeek = (start:string):Week => ({week_start:start,title:"Facciamo squadra: 10 assist!",description:"Un passaggio in più, un compagno in gol. Raggiungiamo il traguardo insieme.",metric:"assists",target:10,manual_progress:0,featured_player_id:null,featured_note:""});
const emptyMoment = {title:"",caption:"",video_url:""};

export default function TeamRoom({players,isAdmin,onPlayer,onArchive}:{players:CardPlayer[];isAdmin:boolean;onPlayer:(player:CardPlayer)=>void;onArchive:()=>void}) {
  const [weekStart,setWeekStart]=useState(()=>roomWeek());
  const [week,setWeek]=useState<Week>(()=>freshWeek(roomWeek()));
  const [draft,setDraft]=useState<Week>(()=>freshWeek(roomWeek()));
  const [data,setData]=useState<Data>({events:[],reports:[],ratings:[],stats:[],cards:[]});
  const [moments,setMoments]=useState<Moment[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [editor,setEditor]=useState(false);
  const [editing,setEditing]=useState<Moment|null>(null);
  const [momentDraft,setMomentDraft]=useState(emptyMoment);
  const [file,setFile]=useState<File|null>(null);
  const [removeMedia,setRemoveMedia]=useState(false);
  const [showArchived,setShowArchived]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true); setError("");
    try {
      // Page through long histories, including more than 1,000 ratings.
      const all = async(table:string,columns:string) => {
        const rows:Record<string,unknown>[]=[];
        for(let start=0;;start+=1000) {
          const result=await supabase.from(table).select(columns).order("id").range(start,start+999);
          if(result.error) throw result.error;
          const page=result.data as unknown as Record<string,unknown>[];
          rows.push(...page); if(page.length<1000) return rows;
        }
      };
      const [w,m,e,r,ratings,stats,cards]=await Promise.all([
        supabase.from("team_room_weeks").select("*").eq("week_start",weekStart).maybeSingle(),
        supabase.from("team_room_moments").select("*").order("created_at",{ascending:false}),
        supabase.from("events").select("id,event_date,event_time"),
        supabase.from("match_reports").select("match_id,team_score,opponent_score"),
        all("match_ratings","id,match_id,player_id,rating"),
        all("match_player_stats","id,match_id,goals,assists"),
        supabase.from("player_cards").select("*")
      ]);
      for(const result of [w,m,e,r,cards]) if(result.error) throw result.error;
      const next=(w.data as Week|null)||freshWeek(weekStart);setWeek(next);setDraft(next);
      setData({events:e.data||[],reports:r.data||[],ratings:ratings as unknown as RoomRating[],stats:stats as unknown as Data["stats"],cards:(cards.data||[]) as Data["cards"]});
      const signed=await Promise.all(((m.data||[]) as Moment[]).map(async moment=>{
        if(!moment.media_path)return moment;
        const {data}=await supabase.storage.from("team-room-media").createSignedUrl(moment.media_path,3600);
        return {...moment,signed:data?.signedUrl};
      }));
      setMoments(signed);
    } catch {setError("Non riesco a caricare lo Spogliatoio. Riprova tra poco.");}
    finally {setLoading(false);}
  },[weekStart]);
  useEffect(()=>{void load();},[load,isAdmin]);
  useEffect(()=>{const timer=window.setInterval(()=>setWeekStart(roomWeek()),60000);return()=>window.clearInterval(timer);},[]);
  const growth=useMemo(()=>growthPlayers(data.ratings,data.events,data.reports).filter(g=>players.some(p=>p.id===g.player_id)),[data,players]);
  const chosen=players.find(p=>p.id===(week.featured_player_id||growth[0]?.player_id));
  const achievement=growth.find(g=>g.player_id===chosen?.id);
  const card=data.cards.find(c=>c.player_id===chosen?.id);
  const progress=goalProgress(week.metric,week.manual_progress,weekStart,data.events,data.reports,data.stats);
  const percentage=Math.min(100,Math.round(progress/week.target*100));
  async function saveWeek(event:FormEvent) {
    event.preventDefault(); if(!isAdmin||busy)return; setBusy(true);setNotice("");
    const payload={...draft,title:draft.title.trim(),target:Number(draft.target),manual_progress:Number(draft.manual_progress),featured_player_id:draft.featured_player_id||null};
    try {
      if(!payload.title||!Number.isInteger(payload.target)||payload.target<1||payload.target>10000||!Number.isInteger(payload.manual_progress)||payload.manual_progress<0||payload.manual_progress>10000)throw Error();
      const {error}=await supabase.from("team_room_weeks").upsert(payload,{onConflict:"week_start"});if(error)throw error;
      setWeek(payload);setNotice("Settimana aggiornata.");
    }catch{setNotice("Salvataggio non riuscito. Controlla i campi e riprova.");}finally{setBusy(false);}
  }
  function openMoment(moment:Moment|null) {setEditing(moment);setMomentDraft(moment?{title:moment.title,caption:moment.caption,video_url:moment.video_url||""}:emptyMoment);setFile(null);setRemoveMedia(false);setEditor(true);setNotice("");}
  async function saveMoment(event:FormEvent) {
    event.preventDefault();if(!isAdmin||busy)return;setBusy(true);setNotice("");
    let uploaded:string|null=null;
    try{
      const url=momentDraft.video_url.trim();
      if(!momentDraft.title.trim()||(url&&!safeVideoUrl(url)))throw Error("Inserisci un titolo e un link HTTPS valido.");
      if(file&&url)throw Error("Scegli un file oppure un link video.");
      let media_path=removeMedia||url?null:editing?.media_path||null;
      let media_type:Moment["media_type"]=media_path?editing?.media_type||null:null;
      if(file){
        const types:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","video/mp4":"mp4","video/webm":"webm"};
        const extension=types[file.type]; const max=file.type.startsWith("image/")?5:50;
        if(!extension||file.size>max*1024*1024)throw Error("Usa JPG, PNG o WebP fino a 5 MB, oppure MP4 o WebM fino a 50 MB.");
        const path=crypto.randomUUID()+"."+extension;
        const result=await supabase.storage.from("team-room-media").upload(path,file,{contentType:file.type,upsert:false});
        if(result.error)throw Error("Caricamento del file non riuscito. Riprova.");
        uploaded=path;media_path=path;media_type=file.type.startsWith("image/")?"image":"video";
      }
      const payload={title:momentDraft.title.trim(),caption:momentDraft.caption.trim(),video_url:url?safeVideoUrl(url):null,media_path,media_type};
      const result=editing?await supabase.from("team_room_moments").update(payload).eq("id",editing.id).select("id").single():await supabase.from("team_room_moments").insert(payload).select("id").single();
      if(result.error)throw Error("Pubblicazione non riuscita. Riprova.");
      uploaded=null;setEditor(false);await load();setNotice(editing?"Momento aggiornato.":"Momento pubblicato!");
    }catch(cause){if(uploaded)await supabase.storage.from("team-room-media").remove([uploaded]);setNotice(cause instanceof Error?cause.message:"Operazione non riuscita.");}
    finally{setBusy(false);}
  }
  async function archive(moment:Moment) {
    if(!isAdmin||busy)return;setBusy(true);
    const {error}=await supabase.from("team_room_moments").update({archived:!moment.archived}).eq("id",moment.id).select("id").single();
    if(error)setNotice("Operazione non riuscita. Riprova.");else{await load();setNotice(moment.archived?"Momento ripristinato.":"Momento archiviato: puoi ripristinarlo.");}setBusy(false);
  }
  if(loading)return <div className={box} role="status">Caricamento Spogliatoio…</div>;
  if(error)return <div className={box} role="alert"><p>{error}</p><button className={secondary+" mt-4"} onClick={()=>void load()}>Riprova</button></div>;
  return <div className="space-y-7">
    <header className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 sm:p-10">
      <div className="absolute inset-x-0 top-0 flex h-1"><span className="w-1/3 bg-emerald-400"/><span className="w-1/3 bg-white"/><span className="w-1/3 bg-red-500"/></div>
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Calcio Totale · Dentro la squadra</p><h2 className="mt-3 text-3xl font-black sm:text-5xl">🔥 Spogliatoio</h2><p className="mt-3 max-w-xl text-slate-300">Una sola passione. Ogni progresso, ogni assist, ogni momento: insieme.</p></div><Image src="/calcio-totale-2026-logo.png" alt="Calcio Totale" width={100} height={100} className="hidden h-24 w-24 object-contain sm:block"/></div>
      <p className="mt-6 text-sm font-bold text-emerald-200">Settimana {new Date(weekStart+"T12:00:00").toLocaleDateString("it-IT")} – {new Date(weekEnd(weekStart)+"T12:00:00").toLocaleDateString("it-IT")}</p>
    </header>
    {notice&&<p role="status" className="rounded-xl border border-emerald-400/30 bg-slate-900 p-4 text-emerald-100">{notice}</p>}
    <div className="grid items-stretch gap-6 lg:grid-cols-2">
      <section className={box+" flex flex-col justify-between"}>
        <div><p className="text-xs font-black uppercase tracking-widest text-emerald-300">🎯 Obiettivo della settimana</p><h3 className="mt-5 text-3xl font-black">{week.title}</h3><p className="mt-3 whitespace-pre-wrap text-slate-400">{week.description}</p></div>
        <div className="mt-10"><p className="flex items-end justify-between gap-3"><span className="text-5xl font-black text-emerald-300">{progress}<span className="text-xl text-slate-500"> / {week.target}</span></span><span className="font-bold text-emerald-200">{percentage}%</span></p>
          <div role="progressbar" aria-label="Avanzamento obiettivo settimanale" aria-valuenow={Math.min(progress,week.target)} aria-valuemin={0} aria-valuemax={week.target} className="mt-4 h-4 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300 transition-all" style={{width:percentage+"%"}}/></div>
          <p className="mt-4 font-bold">{progress>=week.target?"🏆 Obiettivo raggiunto. Grande squadra!":`Mancano ${week.target-progress} al traguardo. Ogni contributo conta.`}</p>
          <p className="mt-3 text-xs text-slate-500">{week.metric==="manual"?"Avanzamento aggiornato dall’Admin.":"Conteggio automatico dai referti salvati di questa settimana · "+({assists:"assist",goals:"gol",wins:"vittorie"}[week.metric]||"")}</p>
        </div>
      </section>
      <section className={box+" border-fuchsia-400/20"}>
        <p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">📈 Giocatore in crescita</p>
        {chosen?<div className="mt-4 grid items-center gap-4 xl:grid-cols-2">
          <button className="mx-auto w-full max-w-56" aria-label={"Apri la card di "+chosen.name} onClick={()=>onPlayer(chosen)}>{card?<div className="relative mx-auto h-[300px] w-[200px] overflow-hidden"><div className="absolute left-0 top-0 w-[400px] origin-top-left scale-50"><PlayerCard player={chosen} card={{...emptyPlayerCard(),...card}}/></div></div>:<div className="rounded-3xl border border-emerald-500/30 bg-slate-950 p-8 text-center"><span className="text-5xl">⚽</span><p className="mt-4 font-black">{chosen.name}</p><p className="text-sm text-emerald-300">{chosen.position}</p></div>}</button>
          <div><p className="text-xs uppercase text-slate-400">{week.featured_player_id?"Scelto dall’Admin":"Progresso nelle ultime 6 partite"}</p><h3 className="mt-2 break-words text-2xl font-black">{chosen.name}</h3>{achievement&&<><p className="mt-4 text-4xl font-black text-fuchsia-300">+{achievement.improvement.toFixed(2)}</p><p className="mt-1 text-sm text-slate-300">Media da {achievement.previous.toFixed(2)} a {achievement.recent.toFixed(2)}</p></>}<p className="mt-4 whitespace-pre-wrap text-sm text-slate-400">{week.featured_note||"La costanza si vede. Continuiamo a crescere insieme!"}</p></div>
        </div>:<div className="py-12"><p className="text-4xl">🌱</p><h3 className="mt-4 text-xl font-bold">Il prossimo passo lo facciamo insieme</h3><p className="mt-3 text-slate-400">Il riconoscimento automatico apparirà quando un giocatore con almeno sei partite registrate migliorerà la propria media.</p></div>}
        <p className="mt-4 text-xs text-slate-500">Confronto delle ultime 3 partite con le 3 precedenti. Più voti sulla stessa partita vengono mediati; contano solo i referti registrati.</p>
      </section>
    </div>
    {isAdmin&&<details className={box}><summary className="cursor-pointer font-bold text-emerald-300">⚙️ Personalizza questa settimana</summary><form onSubmit={saveWeek} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Titolo obiettivo<input required maxLength={100} className={input} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
      <label className="text-sm">Conteggio<select className={input} value={draft.metric} onChange={e=>setDraft({...draft,metric:e.target.value})}><option value="assists">Assist della squadra · automatico</option><option value="goals">Gol della squadra · automatico</option><option value="wins">Vittorie · automatico</option><option value="manual">Avanzamento manuale</option></select></label>
      <label className="text-sm">Traguardo<input required type="number" min={1} max={10000} className={input} value={draft.target} onChange={e=>setDraft({...draft,target:Number(e.target.value)})}/></label>
      {draft.metric==="manual"&&<label className="text-sm">Avanzamento attuale<input required type="number" min={0} max={10000} className={input} value={draft.manual_progress} onChange={e=>setDraft({...draft,manual_progress:Number(e.target.value)})}/></label>}
      <label className="text-sm sm:col-span-2">Messaggio alla squadra<textarea maxLength={500} className={input} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
      <label className="text-sm">Giocatore in evidenza<select className={input} value={draft.featured_player_id||""} onChange={e=>setDraft({...draft,featured_player_id:e.target.value||null})}><option value="">Automatico · maggiore miglioramento</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm">Motivazione<input maxLength={500} className={input} value={draft.featured_note} onChange={e=>setDraft({...draft,featured_note:e.target.value})}/></label>
      <button disabled={busy} className={button}>{busy?"Salvataggio…":"Salva settimana"}</button>
    </form></details>}
    <section className={box}>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-sky-300">🎬 Momenti della squadra</p><h3 className="mt-2 text-2xl font-black">Le azioni passano. I ricordi restano.</h3></div>{isAdmin&&<button className={button} disabled={busy} onClick={()=>openMoment(null)}>+ Pubblica un momento</button>}</div>
      {isAdmin&&editor&&<form onSubmit={saveMoment} className="mt-6 space-y-4 rounded-2xl border border-emerald-400/30 bg-slate-950 p-4">
        <h4 className="font-bold">{editing?"Modifica momento":"Nuovo momento"}</h4>
        <label className="block text-sm">Titolo<input required maxLength={100} className={input} value={momentDraft.title} onChange={e=>setMomentDraft({...momentDraft,title:e.target.value})}/></label>
        <label className="block text-sm">Racconta il momento<textarea maxLength={1000} className={input} value={momentDraft.caption} onChange={e=>setMomentDraft({...momentDraft,caption:e.target.value})}/></label>
        <label className="block text-sm">Foto o video<input key={editing?.id||"new"} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className={input} onChange={e=>setFile(e.target.files?.[0]||null)}/><span className="mt-1 block text-xs text-slate-400">Foto fino a 5 MB · video MP4/WebM fino a 50 MB.</span></label>
        <label className="block text-sm">Oppure link al video<input type="url" placeholder="https://…" className={input} value={momentDraft.video_url} onChange={e=>setMomentDraft({...momentDraft,video_url:e.target.value})}/></label>
        {editing?.media_path&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={removeMedia} onChange={e=>setRemoveMedia(e.target.checked)}/>Rimuovi il file da questo momento</label>}
        <div className="flex gap-3"><button disabled={busy} className={button}>{busy?"Caricamento…":editing?"Salva modifiche":"Pubblica"}</button><button type="button" disabled={busy} onClick={()=>setEditor(false)} className={secondary}>Annulla</button></div>
      </form>}
      {isAdmin&&moments.some(m=>m.archived)&&<label className="mt-5 flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Mostra momenti archiviati</label>}
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {moments.filter(m=>!m.archived||(isAdmin&&showArchived)).map(m=><article key={m.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
          {m.signed&&m.media_type==="image"&&<Image src={m.signed} alt={m.title} width={720} height={480} unoptimized className="aspect-video w-full object-contain bg-black"/>}
          {m.signed&&m.media_type==="video"&&<video src={m.signed} controls playsInline preload="metadata" className="aspect-video w-full bg-black"/>}
          {m.media_path&&!m.signed&&<p className="p-4 text-sm text-slate-400">Anteprima non disponibile. Ricarica la sezione per riprovare.</p>}
          <div className="p-5"><p className="text-xs text-slate-500">{new Date(m.created_at).toLocaleDateString("it-IT")}{m.archived?" · Archiviato":""}</p><h4 className="mt-2 break-words text-xl font-bold">{m.title}</h4><p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">{m.caption}</p>{m.video_url&&safeVideoUrl(m.video_url)&&<a className="mt-4 inline-block font-bold text-sky-300" href={safeVideoUrl(m.video_url)!} target="_blank" rel="noopener noreferrer">▶ Guarda il video ↗</a>}
          {isAdmin&&<div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>openMoment(m)} className={secondary}>Modifica</button><button disabled={busy} onClick={()=>void archive(m)} className={secondary}>{m.archived?"Ripristina":"Archivia"}</button></div>}</div>
        </article>)}
      </div>
      {!moments.some(m=>!m.archived)&&<div className="mt-4 rounded-2xl border border-dashed border-slate-700 px-6 py-10 text-center"><p className="text-4xl">🎥</p><p className="mt-4 font-bold">Il primo ricordo ci aspetta</p><p className="mt-2 text-sm text-slate-400">{isAdmin?"Pubblica un gol, una parata, una foto o un messaggio per la squadra.":"Qui troverai foto, video e racconti pubblicati dagli Admin."}</p></div>}
    </section>
    {isAdmin&&<button onClick={onArchive} className="text-sm text-slate-500 underline hover:text-slate-300">Apri gestione delle competizioni precedenti</button>}
  </div>;
}
