const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'lib/playerGallery.ts'),'utf8');const m={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports);
const {validateGalleryFile,canManageGallery,durationLabel}=m.exports;
assert.doesNotThrow(()=>validateGalleryFile({type:'image/png',size:1200},'image'));
assert.doesNotThrow(()=>validateGalleryFile({type:'video/mp4',size:5000},'video'));
assert.throws(()=>validateGalleryFile({type:'image/svg+xml',size:1000},'image'));
assert.throws(()=>validateGalleryFile({type:'image/png',size:11*1024*1024},'image'));
assert.throws(()=>validateGalleryFile({type:'video/mp4',size:51*1024*1024},'video'));
assert.throws(()=>validateGalleryFile({type:'video/mp4',size:50},'image'));
const item={player_id:'a',created_by:'user-a'};
assert(canManageGallery(item,'user-a','a',false));assert(!canManageGallery(item,'user-b','b',false));assert(!canManageGallery(item,'user-a','b',false));assert(!canManageGallery(item,null,null,false));assert(canManageGallery(item,'admin',null,true));assert.equal(durationLabel(60),'1:00');
const page=fs.readFileSync(path.join(__dirname,'app/page.tsx'),'utf8'),voting=fs.readFileSync(path.join(__dirname,'components/VotingHub.tsx'),'utf8');
assert(!page.includes('activeSection === "mvp"'));assert(page.includes('activeSection === "gallery"'));assert(page.includes('view="votes"'));assert(!voting.includes('if (view === "mvp")'));assert(!voting.includes('👑 MVP e Top 11'));assert(voting.includes('action: "save_rating"'));assert(voting.includes('📊 Classifica settimanale'));
console.log('PASS: media validation, owner/admin controls, duration, MVP replacement, voting save and ranking retained');

