const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
(async()=>{
 const roster=fs.readFileSync(path.resolve(root,'../../packs/ai/roster.ts'),'utf8');
 const ids=[...roster.matchAll(/defineUnit\('(ai-[^']+)'/g)].map(m=>m[1]);
 assert.deepEqual(manifest.units.map(u=>u.id).sort(),ids.sort());
 assert.equal(manifest.units.find(u=>u.id==='ai-musespark').name,'Muse');
 for(const clip of Object.values(manifest.clips))for(const frame of clip.frames){assert(frame.durationMs>0);assert(frame.x+frame.w<=manifest.atlas.width);assert(frame.y+frame.h<=manifest.atlas.height);}
 const executablePath=process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  for(const unit of manifest.units){
   const png=fs.readFileSync(path.join(root,unit.atlas));
   const report=await page.evaluate(async({base64,manifest})=>{
    const im=new Image();im.src='data:image/png;base64,'+base64;await im.decode();
    const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
    const out={width:im.width,height:im.height,empty:0,clipped:0,opaqueCorner:false,walkDifferent:false};
    for(const clip of Object.values(manifest.clips))for(const f of clip.frames){
     const pixels=g.getImageData(f.x,f.y,f.w,f.h).data;let count=0;
     for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(pixels[(y*f.w+x)*4+3]){count++;if(!x||!y||x===f.w-1||y===f.h-1)out.clipped++;}
     if(!count)out.empty++;
    }
    const f=manifest.clips['happy/walk'].frames;
    const a=g.getImageData(f[0].x,f[0].y,64,64).data,b=g.getImageData(f[2].x,f[2].y,64,64).data;out.walkDifferent=a.some((v,i)=>v!==b[i]);
    out.opaqueCorner=g.getImageData(0,0,1,1).data[3]!==0;
    return out;
   },{base64:png.toString('base64'),manifest});
   assert.equal(report.width,manifest.atlas.width);assert.equal(report.height,manifest.atlas.height);
   assert.equal(report.empty,0,unit.id+' empty frames');assert.equal(report.clipped,0,unit.id+' clipped at edge');assert.equal(report.opaqueCorner,false);assert.equal(report.walkDifferent,true,unit.id+' walk alternates');
  }
  console.log(JSON.stringify({rosterIds:ids.length,transparentAtlases:'pass',frameBounds:'pass',walkFrames:'pass',museStableId:'pass'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
