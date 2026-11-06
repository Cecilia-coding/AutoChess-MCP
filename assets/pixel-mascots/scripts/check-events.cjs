const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mappings={
 claude:{passiveStats:['claude_safety'],onDamaged:['claude_immune']},
 gpt:{passiveStats:['gpt_safety'],tick:['gpt_codex']},
 deepseek:{onDamaged:['deepseek_rage'],onDeath:['deepseek_open'],conditional:['deepseek_comeback'],stealAtk:['deepseek_steal']},
 characterai:{passiveStats:['characterai_memory']},replika:{passiveStats:['replika_regen']},
 grok:{onBattleStart:['grok_immune'],rider:['grok_followup']},manus:{rider:['manus_followup']},
 copilot:{passiveStats:['copilot_guard']},gemma:{passiveStats:['gemma_stats']}
};
const hazards={'ip-ban':['claude_ip_scan','claude_ip_pass','claude_ip_ban','claude_ip_immune'],'official-event-strike':['gemini_strike','gemini_return'],'off-peak-pricing':['deepseek_peak','deepseek_trough'],'coding-plan-soldout':['glm_soldout','glm_restock']};
(async()=>{
 // The source is a data-only TS literal; remove its type-only import and annotation.
 const src=fs.readFileSync(path.resolve(root,'../../packs/ai/skills.ts'),'utf8').replace(/^import type .*;$/gm,'').replace('export const aiUnitSkills: Record<string, UnitSkill> =','globalThis.skills =');
 const expectedStats={claude:['drPct'],gpt:['drPct'],characterai:['hpPct','drPct'],replika:['regenPctPerSec'],copilot:['drPct'],gemma:['atkPct','hpPct']};
 const context={};vm.runInNewContext(src,context,{timeout:1000});const skills=context.skills;
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'effects/events/manifest.json'))),fx=JSON.parse(fs.readFileSync(path.join(root,'effects/manifest.json'))),keys=new Set(manifest.catalog.map(e=>e.key));
 assert.equal(manifest.units.length,29);assert.equal(keys.size,manifest.catalog.length);
 const coverage=[];
 for(const [fullId,skill]of Object.entries(skills)){const id=fullId.slice(3),hooks={};if(skill.passiveStats)assert.equal(JSON.stringify(Array.from(skill.passiveStats,x=>x.stat).sort()),JSON.stringify(expectedStats[id].slice().sort()),id+' passive stat coverage');for(const key of ['passiveStats','onDamaged','onDeath','onBattleStart','tick'])if(skill[key]){assert(mappings[id]?.[key],id+' missing '+key);hooks[key]=mappings[id][key];}
  const ops=JSON.stringify(skill.cast);for(const op of ['rider','stealAtk'])if(ops.includes('"op":"'+op+'"')){assert(mappings[id]?.[op],id+' missing '+op);hooks[op]=mappings[id][op];}
  if(ops.includes('teamHpBelowPct'))hooks.conditional=mappings[id].conditional;
  for(const event of Object.values(hooks).flat()){assert(keys.has(event));assert(manifest.units.find(u=>u.id===fullId).clips.some(c=>c.key===event));}
  const visual=fx.units.find(u=>u.id===fullId);assert.equal(visual.skill.name,skill.name);coverage.push({id:fullId,attack:true,cast:visual.skill.name,variants:visual.skillVariants.map(v=>v.variant),hooks});
 }
 const hazardSource=fs.readFileSync(path.resolve(root,'../../packs/ai/hazards.ts'),'utf8');const hazardIds=[...hazardSource.matchAll(/id: '([^']+)'/g)].map(m=>m[1]);assert.deepEqual(hazardIds.sort(),Object.keys(hazards).sort());for(const entries of Object.values(hazards))for(const key of entries)assert(keys.has(key));
 coverage.push({id:'ai-codex',attack:true,cast:'GPT 被动换形；无新增主动',hooks:{reskin:['gpt_codex']}});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();for(const file of ['mascots.js','renderer.js','effects.js','skills.js','events.js'])await page.addScriptTag({path:path.join(root,'preview',file)});
  await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');for(const id of Object.keys(PixelEffects.themes))for(const event of PixelEvents.list(id))for(const reducedMotion of [false,true]){g.clearRect(0,0,128,128);PixelEvents.drawLocal(g,id,event.key,{x:64,y:64,ageMs:event.durationMs*.5,reducedMotion});const a=g.getImageData(0,0,128,128).data;if(!a.some((v,i)=>i%4===3&&v))throw Error('empty '+id+'/'+event.key);if(id==='gpt'||id==='codex')for(let i=0;i<a.length;i+=4)if(a[i+3]&&(a[i]!==a[i+1]||a[i]!==a[i+2]))throw Error('colored monochrome FX');g.clearRect(0,0,128,128);PixelEvents.drawLocal(g,id,event.key,{x:64,y:64,ageMs:event.durationMs});if(g.getImageData(0,0,128,128).data.some(v=>v))throw Error('expired effect still drawn');}if(PixelEvents.actor('gpt','gpt_codex',1500).id!=='codex')throw Error('form transition');});
  for(const u of manifest.units){const data=fs.readFileSync(path.join(root,u.file)).toString('base64');const ok=await page.evaluate(async({data,u})=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();if(im.width!==u.width||im.height!==u.height)return false;const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);for(const clip of u.clips)for(const f of clip.frames){const a=g.getImageData(f.x,f.y,128,128).data;let n=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(a[(y*128+x)*4+3]){n++;if(!x||!y||x===127||y===127)return false;}if(!n)return false;}return true;},{data,u});assert(ok,u.id+' empty/clipped atlas');}
 }finally{await browser.close();}
 fs.writeFileSync(path.join(root,'effects/events/coverage.json'),JSON.stringify({source:'packs/ai/skills.ts + packs/ai/hazards.ts',scope:'29 AI characters; basic attacks, active recipes, declared passive hooks and four character hazards',units:coverage,hazards,common:manifest.catalog.filter(e=>e.category==='common').map(e=>e.key),missing:[]},null,2)+'\n');
 console.log(JSON.stringify({units:29,sourceSkillHooks:'covered',hazards:hazardIds.length,eventTypes:keys.size,transparentFrames:'pass',monochrome:'pass',expiry:'pass'}));
})().catch(e=>{console.error(e);process.exitCode=1});
