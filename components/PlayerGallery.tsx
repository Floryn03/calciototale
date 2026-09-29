"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import { galleryCategories, galleryLabels, galleryExtension, validateGalleryFile, inspectGalleryVideo, canManageGallery, durationLabel, type GalleryItem, type GalleryPlayer } from "../lib/playerGallery";

const button="min-h-11 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50";
const secondary="min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-100 disabled:opacity-50";
const input="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white";
const bucket="player-gallery";
const blank={title:"",description:"",category:"ALTRO"};

function GalleryDialog({title,onClose,children,busy=false}:{title:string;onClose:()=>void;children:ReactNode;busy?:boolean}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>{el?.close();};},[]);
 return <dialog ref={dialog} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} className="m-auto max-h-[92dvh] w-[min(960px,94vw)] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-4 text-white backdrop:bg-black/85 sm:p-6" aria-label={title}>
   <div className="mb-5 flex items-center justify-between gap-3"><h3 className="text-xl font-black">{title}</h3><button type="button" autoFocus onClick={onClose} disabled={busy} className={secondary} aria-label="Chiudi">✕</button></div>{children}
 </dialog>;
}

export default function PlayerGallery({players,isAdmin,sessionPlayerId}:{players:GalleryPlayer[];isAdmin:boolean;sessionPlayerId:string|null}) {
 const [userId,setUserId]=useState<string|null>(null);
 const [items,setItems]=useState<GalleryItem[]>([]);
 const [photos,setPhotos]=useState<Record<string,string>>({});
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState("all");
 const [category,setCategory]=useState("all");
 const [limit,setLimit]=useState(24);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [editor,setEditor]=useState<"image"|"video"|GalleryItem|null>(null);
 const [draft,setDraft]=useState(blank);
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [viewing,setViewing]=useState<GalleryItem|null>(null);
 const [signed,setSigned]=useState<Record<string,string>>({});
 const canEnter=isAdmin||Boolean(sessionPlayerId);
 const selected=players.find(p=>p.id===selectedId);
 const ownGallery=isAdmin||Boolean(selectedId&&selectedId===sessionPlayerId);
 const load=useCallback(async()=>{
   if(!canEnter){setItems([]);setLoading(false);return;}
   setLoading(true);setError("");
   try {
     const auth=await supabase.auth.getUser();if(auth.error||!auth.data.user)throw Error("Accedi nuovamente per aprire la gallery.");setUserId(auth.data.user.id);
     const all:GalleryItem[]=[];
     for(let start=0;;start+=1000){const r=await supabase.from("player_gallery").select("*").eq("status","ready").order("created_at",{ascending:false}).order("id").range(start,start+999);if(r.error)throw r.error;all.push(...r.data as GalleryItem[]);if(r.data.length<1000)break;}
     setItems(all);
     const avatars=await supabase.from("player_cards").select("player_id,photo_url");
     if(!avatars.error)setPhotos(Object.fromEntries((avatars.data||[]).filter(p=>p.photo_url).map(p=>[p.player_id,p.photo_url])));
   }catch{setError("Non riesco a caricare la gallery. Premi Riprova.");}finally{setLoading(false);}
 },[canEnter]);
 useEffect(()=>{const timer=window.setTimeout(()=>{void load();},0);return()=>window.clearTimeout(timer);},[load,isAdmin,sessionPlayerId]);
 const filtered=useMemo(()=>items.filter(i=>i.player_id===selectedId&&(filter==='all'||i.type===filter)&&(category==='all'||i.category===category)),[items,selectedId,filter,category]);
 const visible=useMemo(()=>filtered.slice(0,limit),[filtered,limit]);
 useEffect(()=>{
   if(!canEnter||!visible.length)return;
   let cancelled=false;
   async function sign(){const paths=visible.flatMap(i=>[i.file_path,...(i.thumbnail_path?[i.thumbnail_path]:[])]);const result=await supabase.storage.from(bucket).createSignedUrls(paths,3600);if(cancelled)return;if(result.error){setError("Non riesco ad aprire i file. Premi Riprova.");return;}setSigned(Object.fromEntries((result.data||[]).filter(r=>r.path&&r.signedUrl).map(r=>[r.path!,r.signedUrl!])));}
   void sign();const timer=window.setInterval(()=>{void sign();},3000000);return()=>{cancelled=true;window.clearInterval(timer);};
 },[visible,canEnter]);
 const sortedPlayers=useMemo(()=>[...players].filter(p=>(p.name+" "+p.psn_id).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(a.psn_id||a.name).localeCompare(b.psn_id||b.name,"it")),[players,search]);
 function openGallery(id:string){setSelectedId(id);setFilter('all');setCategory('all');setLimit(24);setNotice('');setSigned({});}
 function openEditor(value:"image"|"video"|GalleryItem){setEditor(value);setDraft(typeof value==='string'?blank:{title:value.title,description:value.description,category:value.category});setFile(null);setNotice('');}
 async function save(event:FormEvent){
   event.preventDefault();if(busy||!editor||!selected)return;setBusy(true);setNotice('');let pending:GalleryItem|null=null;const uploaded:string[]=[];
   try{
     const payload={title:draft.title.trim(),description:draft.description.trim(),category:draft.category};
     if(!payload.title)throw Error('Inserisci un titolo.');
     if(typeof editor!=='string'){
       if(!canManageGallery(editor,userId,sessionPlayerId,isAdmin))throw Error('Non puoi modificare questo contenuto.');
       const r=await supabase.from('player_gallery').update(payload).eq('id',editor.id).select('id');if(r.error||!r.data?.length)throw Error('Modifica non riuscita.');
     }else{
       if(!ownGallery||!file)throw Error('Seleziona un file per la tua gallery.');validateGalleryFile(file,editor);
       const media=editor==='video'?await inspectGalleryVideo(file):null;
       // Ordinary players never send a player_id: the database derives it from auth.uid().
       const created=await supabase.from('player_gallery').insert({...payload,type:editor,extension:galleryExtension[file.type],duration:media?.duration??null,...(isAdmin?{player_id:selected.id}:{})}).select('*').single();
       if(created.error)throw Error('Impossibile preparare il caricamento.');pending=created.data as GalleryItem;
       const original=await supabase.storage.from(bucket).upload(pending.file_path,file,{contentType:file.type,upsert:false});if(original.error)throw Error('Caricamento non riuscito. Controlla la connessione e riprova.');uploaded.push(pending.file_path);
       if(media&&pending.thumbnail_path){const thumb=await supabase.storage.from(bucket).upload(pending.thumbnail_path,media.thumbnail,{contentType:'image/jpeg',upsert:false});if(thumb.error)throw Error('Caricamento miniatura non riuscito.');uploaded.push(pending.thumbnail_path);}
       const publish=await supabase.from('player_gallery').update({status:'ready'}).eq('id',pending.id).select('id');if(publish.error||!publish.data?.length)throw Error('Pubblicazione non riuscita.');pending=null;
     }
     setEditor(null);setFile(null);await load();setNotice('Contenuto salvato nella gallery.');
   }catch(e){if(pending){if(uploaded.length)await supabase.storage.from(bucket).remove(uploaded);await supabase.from('player_gallery').delete().eq('id',pending.id);}setNotice(e instanceof Error?e.message:'Operazione non riuscita.');}finally{setBusy(false);}
 }
 async function remove(item:GalleryItem){
   if(busy||!canManageGallery(item,userId,sessionPlayerId,isAdmin)||!window.confirm(`Eliminare “${item.title}” dalla gallery?`))return;
   setBusy(true);setNotice('');
   try{const files=await supabase.storage.from(bucket).remove([item.file_path,...(item.thumbnail_path?[item.thumbnail_path]:[])]);if(files.error)throw files.error;const r=await supabase.from('player_gallery').delete().eq('id',item.id).select('id');if(r.error||!r.data?.length)throw Error();setViewing(null);await load();setNotice('Contenuto eliminato.');}catch{setNotice('Eliminazione non riuscita. Riprova.');}finally{setBusy(false);}
 }
 const controls=(item:GalleryItem)=>canManageGallery(item,userId,sessionPlayerId,isAdmin)&&<div className="mt-3 flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy} onClick={()=>{setViewing(null);openEditor(item);}}>✏️ Modifica</button><button type="button" className={secondary+" text-red-300"} disabled={busy} onClick={()=>void remove(item)}>🗑️ Elimina</button></div>;
 return <div className="space-y-6">
   <header className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 p-6 sm:p-9">
     <div className="absolute inset-x-0 top-0 flex h-1"><span className="w-1/3 bg-emerald-400"/><span className="w-1/3 bg-white"/><span className="w-1/3 bg-red-500"/></div>
     <p className="text-xs font-black tracking-[0.25em] text-emerald-300">CALCIO TOTALE · I NOSTRI MOMENTI</p><h2 className="mt-3 text-3xl font-black sm:text-5xl">📸 PLAYER GALLERY</h2><p className="mt-3 text-slate-300">Lo spazio personale dei giocatori di CALCIO TOTALE</p>
   </header>
   {!canEnter?<div className="rounded-3xl border border-slate-800 bg-slate-900 p-7"><h3 className="text-xl font-bold">Le storie della squadra ti aspettano</h3><p className="mt-3 text-slate-300">Accedi dal pulsante Giocatore o Admin in alto per vedere tutte le gallery.</p></div>:<>
   {error&&<div role="alert" className="rounded-xl border border-red-500/30 p-4 text-red-200">{error} <button type="button" className={secondary} onClick={()=>void load()}>Riprova</button></div>}
   {notice&&!editor&&<p role="status" className="rounded-xl bg-slate-900 p-4 text-emerald-200">{notice}</p>}
   {!selected?<>
     <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-bold">Tutta la squadra, tutte le gallery</h3><p className="mt-1 text-sm text-slate-400">Foto, giocate e ricordi. Scegli un giocatore.</p></div>{sessionPlayerId&&<button className={button} onClick={()=>openGallery(sessionPlayerId)}>📸 La mia gallery</button>}</div>
     <label className="block text-sm text-slate-300">Cerca giocatore o PlayStation ID<input className={input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca nella squadra…"/></label>
     {loading?<p role="status">Caricamento gallery…</p>:<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sortedPlayers.map(p=><article key={p.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
       <div className="flex items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-400/10 text-2xl font-black text-emerald-300">{photos[p.id]?<Image src={photos[p.id]} alt={p.name} width={64} height={64} unoptimized className="h-full w-full object-cover"/>:p.name.slice(0,2).toUpperCase()}</div><div className="min-w-0"><h3 className="break-words text-lg font-black">{p.psn_id||p.name}</h3><p className="break-words text-sm text-slate-400">{p.name}</p><p className="mt-1 text-sm text-emerald-300">#{p.shirt_number} · {p.position}</p></div></div>
       <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-400">{items.filter(i=>i.player_id===p.id).length} contenuti</span><button type="button" className={secondary} onClick={()=>openGallery(p.id)}>VEDI GALLERY</button></div>
     </article>)}</div>}{!loading&&!sortedPlayers.length&&<p className="text-slate-400">Nessun giocatore trovato.</p>}
   </>:<>
     <button type="button" className={secondary} onClick={()=>{setSelectedId(null);setNotice('');}}>← Tutti i giocatori</button>
     <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="break-words text-2xl font-black">{selected.psn_id||selected.name}</h3><p className="mt-1 text-emerald-300">#{selected.shirt_number} · {selected.position}</p><p className="mt-3 text-sm font-black tracking-widest">📸 {selected.id===sessionPlayerId?'LA MIA GALLERY':'GALLERY PERSONALE'}</p></div>{ownGallery&&<div className="flex flex-wrap gap-2"><button className={button} onClick={()=>openEditor('image')}>＋ Aggiungi foto</button><button className={secondary} onClick={()=>openEditor('video')}>＋ Aggiungi video</button></div>}</div>
     <div className="flex flex-wrap items-end gap-3"><div className="flex gap-2" aria-label="Tipo contenuto">{[['all','Tutti'],['image','Foto'],['video','Video']].map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} className={filter===id?button:secondary} onClick={()=>{setFilter(id);setLimit(24);}}>{label}</button>)}</div><label className="text-sm text-slate-300">Categoria<select value={category} onChange={e=>{setCategory(e.target.value);setLimit(24);}} className={input}><option value="all">Tutte le categorie</option>{galleryCategories.map(c=><option key={c} value={c}>{galleryLabels[c]}</option>)}</select></label></div>
     {loading?<p role="status">Caricamento…</p>:filtered.length===0?<div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center"><p className="text-4xl">📸</p><h4 className="mt-4 text-xl font-bold">Qui iniziano i ricordi</h4><p className="mt-2 text-slate-400">{filter==='all'&&category==='all'?'Nessun contenuto pubblicato in questa gallery.':'Nessun contenuto per questi filtri.'}</p></div>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item=><article key={item.id} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
       <button type="button" aria-label={`Apri ${item.type==='video'?'video':'foto'}: ${item.title}`} className="relative flex aspect-video w-full items-center justify-center bg-slate-950" onClick={()=>setViewing(item)} disabled={!signed[item.file_path]}>
         {signed[item.thumbnail_path||item.file_path]?<Image src={signed[item.thumbnail_path||item.file_path]} alt={item.title} width={640} height={360} unoptimized className="h-full w-full object-contain"/>:<span className="text-slate-400">Caricamento anteprima…</span>}
         {item.type==='video'&&<><span className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-2xl" aria-hidden="true">▶</span><span className="absolute bottom-3 right-3 rounded-lg bg-black/80 px-2 py-1 text-xs">⏱ {durationLabel(item.duration)}</span></>}
       </button><div className="p-4"><p className="text-xs text-emerald-300">{galleryLabels[item.category]} · {new Date(item.created_at).toLocaleDateString('it-IT')}</p><h4 className="mt-2 break-words font-bold">{item.title}</h4>{item.description&&<p className="mt-2 line-clamp-2 break-words text-sm text-slate-400">{item.description}</p>}{controls(item)}</div>
     </article>)}</div>}{visible.length<filtered.length&&<button className={secondary} onClick={()=>setLimit(n=>n+24)}>Mostra altri contenuti</button>}
   </>}
   {editor&&<GalleryDialog title={typeof editor==='string'?(editor==='image'?'📷 Carica foto':'🎥 Carica video'):'✏️ Modifica contenuto'} onClose={()=>setEditor(null)} busy={busy}><form onSubmit={save} className="space-y-4">
     {typeof editor==='string'&&<label className="block text-sm font-bold">{editor==='image'?'Foto · JPG, PNG, WEBP, GIF · massimo 10 MB':'Video · MP4, WEBM, MOV · massimo 60 secondi e 50 MB'}<input required type="file" accept={editor==='image'?'image/jpeg,image/png,image/webp,image/gif':'video/mp4,video/webm,video/quicktime'} className={input} disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
     <label className="block text-sm font-bold">Titolo<input required maxLength={120} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} className={input} disabled={busy}/></label>
     <label className="block text-sm font-bold">Descrizione<textarea maxLength={2000} rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} className={input} disabled={busy}/></label>
     <label className="block text-sm font-bold">Categoria<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} className={input} disabled={busy}>{galleryCategories.map(c=><option key={c} value={c}>{galleryLabels[c]}</option>)}</select></label>
     <p className="text-sm text-slate-400">Gallery di {selected?.psn_id||selected?.name} · La data viene aggiunta automaticamente.</p>
     {notice&&<p role="alert" className="text-amber-200">{notice}</p>}<button type="submit" className={button} disabled={busy}>{busy?'Caricamento e salvataggio…':'Salva contenuto'}</button>
   </form></GalleryDialog>}
   {viewing&&<GalleryDialog title={viewing.title} onClose={()=>setViewing(null)} busy={busy}>{viewing.type==='video'?<video src={signed[viewing.file_path]} poster={viewing.thumbnail_path?signed[viewing.thumbnail_path]:undefined} controls playsInline preload="metadata" className="max-h-[65dvh] w-full rounded-xl bg-black">Il browser non supporta questo video.</video>:<Image src={signed[viewing.file_path]} alt={viewing.title} width={1600} height={1200} unoptimized className="max-h-[70dvh] w-full rounded-xl object-contain"/>}<p className="mt-4 text-sm text-emerald-300">{galleryLabels[viewing.category]} · {new Date(viewing.created_at).toLocaleDateString('it-IT')}{viewing.type==='video'&&` · ${durationLabel(viewing.duration)}`}</p><p className="mt-3 whitespace-pre-wrap break-words text-slate-300">{viewing.description}</p>{controls(viewing)}</GalleryDialog>}
   </>}
 </div>;
}

