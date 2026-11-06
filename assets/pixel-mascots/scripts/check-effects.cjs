const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();for(const file of ['mascots.js','renderer.js','effects.js','skills.js'])await page.addScriptTag({path:path.join(root,'preview',file)});
  const skillText=fs.readFileSync(path.resolve(root,'../../packs/ai/skills.ts'),'utf8');
  const sourceNames=Object.fromEntries([...skillText.matchAll(/'ai-([^']+)': \{([\s\S]*?)(?=\n  'ai-|\n};)/g)].map(m=>[m[1],m[2].match(/name: '([^']+)'/)[1]]));
  assert.equal(Object.keys(sourceNames).length,28);
  const recipes=await page.evaluate(()=>Object.fromEntries(Object.keys(PixelSkills.defs).map(id=>[id,PixelSkills.spec(id)])));
  for(const [id,name]of Object.entries(sourceNames))assert.equal(recipes[id].name,name,id+' matches actual skill name');
  assert.equal(recipes.claude.damage,false);assert.equal(recipes.gpt.damage,false);assert.equal(recipes.doubao.damage,false);assert.equal(recipes.kling.damage,false);
  assert.equal(recipes.deepseek.impactMs,1200);assert.equal(recipes.jimeng.impactMs,2000);
  await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=600;c.height=300;const g=c.getContext('2d');
   for(const id of Object.keys(PixelSkills.defs))for(let variant=0;variant<Math.max(1,(PixelSkills.variants[id]||[]).length);variant++){
    const s=PixelSkills.spec(id,variant);
    for(const ageMs of [0,s.impactMs-1,s.impactMs+100,s.durationMs-1]){g.clearRect(0,0,600,300);PixelSkills.draw(g,'ai-'+id,{ageMs,variant,source:{x:160,y:150},allies:[{x:80,y:150}],foes:[{x:400,y:150},{x:500,y:100},{x:500,y:200}]});if(!g.getImageData(0,0,600,300).data.some((v,i)=>i%4===3&&v))throw Error(id+' empty skill scene');}
   }
   if(PixelSkills.spec('glm',1).damage||!PixelSkills.spec('glm',0).damage)throw Error('GLM branches');
  });
  const result=await page.evaluate(()=>{
   const E=PixelEffects,check=(v,s)=>{if(!v)throw Error(s);},c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
   check(Object.keys(E.themes).length===29,'29 themes');check(E.phaseAt('skill',599).phase==='flight'&&E.phaseAt('skill',600).phase==='impact','skill impact boundary');check(E.phaseAt('attack',420).phase==='impact','attack impact boundary');for(const age of [-1,1140,1200,NaN])check(E.phaseAt('skill',age)===null,'inactive effect');
   for(const id of Object.keys(E.themes))for(const phase of ['charge','flight','impact','aura'])for(const reducedMotion of [false,true])for(const kind of ['attack','skill']){
    g.clearRect(0,0,96,96);E.drawLocal(g,id,phase,{x:48,y:48,progress:.5,reducedMotion,kind});const a=g.getImageData(0,0,96,96).data;
    check(a.some((v,i)=>i%4===3&&v>0),id+' visible');
    if(['gpt','codex'].includes(id))for(let i=0;i<a.length;i+=4)if(a[i+3])check(Math.abs(a[i]-a[i+1])<=4&&Math.abs(a[i]-a[i+2])<=4,id+' monochrome');
    g.clearRect(0,0,96,96);E.drawLocal(g,id,phase,{x:48,y:48,progress:.5,reducedMotion,kind});const b=g.getImageData(0,0,96,96).data;check(a.every((v,i)=>v===b[i]),'deterministic');
   }
   return {themes:29,monochrome:'pass',deterministic:'pass',reducedMotion:'pass',phaseTiming:'pass'};
  });
  const m=JSON.parse(fs.readFileSync(path.join(root,'effects/manifest.json'))),actors=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  assert.deepEqual(m.units.map(u=>u.id).sort(),actors.units.map(u=>u.id).sort());
  for(const u of m.units){for(const [file,w,h] of [[u.attackFile,768,288],[u.symbolsFile,896,64]]){const png=fs.readFileSync(path.join(root,file));assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h);}const bytes=fs.readFileSync(path.join(root,u.file));const ok=await page.evaluate(async({data,m})=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();if(im.width!==m.atlas.width||im.height!==m.atlas.height)return false;const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);for(const clip of Object.values(m.phases))for(const f of clip.frames){const a=g.getImageData(f.x,f.y,f.w,f.h).data;let count=0;for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(a[(y*f.w+x)*4+3]){count++;if(!x||!y||x===f.w-1||y===f.h-1)return false;}if(!count)return false;}return true;},{data:bytes.toString('base64'),m});assert(ok,u.id+' transparent frames not clipped');}
  console.log(JSON.stringify({...result,exportedFrames:'pass',rosterMapping:'pass',skillNames:'28 match source + Codex form',skillBranches:'pass',delayedSkills:'pass',supportDoesNotDamage:'pass'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
