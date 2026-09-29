export const galleryCategories = ["MOMENTO","GOL","TROFEO","MATCH","SCREENSHOT","FUN","PLAYER","CREATIVE","VIDEO","ALTRO"] as const;
export const galleryLabels: Record<string,string> = {MOMENTO:"🔥 Momento",GOL:"⚽ Gol",TROFEO:"🏆 Trofeo",MATCH:"🎮 Match",SCREENSHOT:"📸 Screenshot",FUN:"😂 Fun",PLAYER:"👕 Player",CREATIVE:"🎨 Creative",VIDEO:"🎥 Video",ALTRO:"⭐ Altro"};
export type GalleryPlayer={id:string;name:string;psn_id:string;shirt_number:number;position:string};
export type GalleryItem={id:string;player_id:string;created_by:string;type:"image"|"video";file_path:string;thumbnail_path:string|null;duration:number|null;title:string;description:string;category:string;status:"draft"|"ready";created_at:string;updated_at:string;signed?:string;thumbnail?:string};
export const galleryExtension:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"};
export function validateGalleryFile(file:Pick<File,"type"|"size">,type:"image"|"video") {
 if(!galleryExtension[file.type]||!file.type.startsWith(type+"/"))throw Error(type==='image'?"Scegli una foto JPG, PNG, WEBP o GIF.":"Scegli un video MP4, WEBM o MOV.");
 if(file.size<=0||file.size>(type==='image'?10:50)*1024*1024)throw Error(type==='image'?"La foto deve pesare al massimo 10 MB.":"Il video deve pesare al massimo 50 MB.");
}
export function canManageGallery(item:GalleryItem,userId:string|null,playerId:string|null,isAdmin:boolean){return isAdmin||Boolean(userId&&item.created_by===userId&&item.player_id===playerId);}
export function durationLabel(seconds:number|null){const n=Math.ceil(Number(seconds||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export async function inspectGalleryVideo(file:File):Promise<{duration:number;thumbnail:Blob}> {
 const url=URL.createObjectURL(file);const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
 try{return await new Promise((resolve,reject)=>{
  const timer=window.setTimeout(()=>reject(Error('Impossibile leggere il video. Prova un MP4 compatibile.')),20000);
  const fail=(message:string)=>{window.clearTimeout(timer);reject(Error(message));};
  video.onerror=()=>fail('Video non riproducibile su questo dispositivo. Prova MP4 H.264.');
  video.onloadedmetadata=()=>{if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>60){fail('Il video deve durare al massimo 60 secondi.');return;}video.currentTime=Math.min(0.1,video.duration/2);};
  video.onseeked=()=>{const canvas=document.createElement('canvas');canvas.width=Math.min(640,video.videoWidth);canvas.height=Math.max(1,Math.round(canvas.width*video.videoHeight/video.videoWidth));const ctx=canvas.getContext('2d');if(!ctx){fail('Impossibile creare la miniatura.');return;}ctx.drawImage(video,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{window.clearTimeout(timer);if(blob)resolve({duration:video.duration,thumbnail:blob});else reject(Error('Impossibile creare la miniatura.'));},'image/jpeg',0.8);};video.src=url;
 });}finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

