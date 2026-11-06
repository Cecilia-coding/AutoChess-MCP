const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.addScriptTag({path:path.join(root,'preview/effects.js')});await page.addScriptTag({path:path.join(root,'preview/skills.js')});
  const result=await page.evaluate(()=>{
   const phases=['charge','flight','impact','aura'],size=96,count=8,images=[],units=[];
   const overview=document.createElement('canvas');overview.width=760;overview.height=29*100;const og=overview.getContext('2d');og.fillStyle='#142f2d';og.fillRect(0,0,overview.width,overview.height);
   for(const [index,t]of Object.values(PixelEffects.themes).entries()){
    const c=document.createElement('canvas');c.width=size*count;c.height=size*phases.length;const g=c.getContext('2d');
    phases.forEach((phase,row)=>{for(let col=0;col<count;col++)PixelEffects.drawLocal(g,t.id,phase,{x:col*size+size/2,y:row*size+size/2,progress:col/count,scale:1,kind:'skill'});});
    const file=`effects/ai-${t.id}.png`;images.push({file,data:c.toDataURL()});
    const icons=document.createElement('canvas');icons.width=64*PixelSkills.symbols.length;icons.height=64;const ig=icons.getContext('2d');
    PixelSkills.symbols.forEach((symbol,i)=>PixelSkills.drawToken(ig,t.id,symbol,{x:i*64+32,y:32,scale:1,progress:.5}));
    const symbolsFile=`effects/symbols/ai-${t.id}.png`;images.push({file:symbolsFile,data:icons.toDataURL()});
    const attackCanvas=document.createElement('canvas');attackCanvas.width=size*count;attackCanvas.height=size*3;const ag=attackCanvas.getContext('2d');
    phases.slice(0,3).forEach((phase,row)=>{for(let col=0;col<count;col++)PixelEffects.drawLocal(ag,t.id,phase,{x:col*size+size/2,y:row*size+size/2,progress:col/count,scale:1,kind:'attack'});});
    const attackFile=`effects/attacks/ai-${t.id}.png`;images.push({file:attackFile,data:attackCanvas.toDataURL()});
    units.push({...t,id:'ai-'+t.id,file,symbolsFile,attackFile,attackStyle:PixelEffects.attackStyles[t.id],skill:PixelSkills.spec(t.id),skillVariants:(PixelSkills.variants[t.id]||[]).map((_,i)=>PixelSkills.spec(t.id,i))});
    og.fillStyle=t.light;og.font='14px sans-serif';og.fillText(t.id+' · '+t.name,16,index*100+28);
    phases.forEach((phase,col)=>PixelEffects.drawLocal(og,t.id,phase,{x:330+col*112,y:index*100+48,progress:.5,scale:1.5}));
   }
   images.push({file:'effects/contact-sheet.png',data:overview.toDataURL()});
   return {images,manifest:{version:2,skillSource:'packs/ai/skills.ts',frame:{width:size,height:size,anchor:{x:48,y:48}},atlas:{width:size*count,height:size*phases.length},phases:Object.fromEntries(phases.map((phase,row)=>[phase,{row,loop:phase==='flight'||phase==='aura',frames:Array.from({length:count},(_,col)=>({x:col*size,y:row*size,w:size,h:size,progress:col/count}))}])),attackAtlas:{width:size*count,height:size*3,phases:['charge','flight','impact'],frame:size,columns:count,anchor:{x:48,y:48}},symbols:Object.fromEntries(PixelSkills.symbols.map((symbol,i)=>[symbol,{x:i*64,y:0,w:64,h:64,anchor:{x:32,y:32}}])),timings:PixelEffects.timings,units}};
  });
  for(const im of result.images){const f=path.join(root,im.file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,Buffer.from(im.data.split(',')[1],'base64'));}
  fs.writeFileSync(path.join(root,'effects/manifest.json'),JSON.stringify(result.manifest,null,2)+'\n');
  console.log(JSON.stringify({effectAtlases:result.manifest.units.length,framesEach:32,transparent:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
