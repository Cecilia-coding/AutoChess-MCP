const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();for(const name of ['mascots.js','renderer.js','effects.js','skills.js','events.js'])await page.addScriptTag({path:path.join(root,'preview',name)});
  const data=await page.evaluate(()=>{
   const images=[],units=[],size=128,columns=8;
   for(const u of Mascots.units){const items=PixelEvents.list(u.id),c=document.createElement('canvas');c.width=size*columns;c.height=size*items.length;const g=c.getContext('2d');
    const clips=items.map((e,row)=>({...e,row,frames:Array.from({length:columns},(_,col)=>{const ageMs=e.durationMs*col/columns;PixelEvents.drawLocal(g,u.id,e.key,{x:col*size+64,y:row*size+64,ageMs,stacks:6});return {x:col*size,y:row*size,w:size,h:size,ageMs,durationMs:e.durationMs/columns};})}));
    const file=`effects/events/ai-${u.id}.png`;images.push({file,data:c.toDataURL()});units.push({id:'ai-'+u.id,name:u.name,file,width:c.width,height:c.height,clips});
   }
   const chosen=PixelEvents.catalog.filter(e=>e.owners!=='*'),c=document.createElement('canvas');c.width=880;c.height=Math.ceil(chosen.length/4)*150;const g=c.getContext('2d');g.fillStyle='#142f2d';g.fillRect(0,0,c.width,c.height);
   chosen.forEach((e,i)=>{const x=i%4*220,y=Math.floor(i/4)*150,id=e.owners[0];PixelMascots.draw(g,id,{x:x+86,y:y+52,scale:2});PixelEvents.drawLocal(g,id,e.key,{x:x+110,y:y+72,scale:1.5,ageMs:e.durationMs*.55,stacks:6});g.fillStyle=PixelEffects.theme(id).light;g.font='12px sans-serif';g.textAlign='center';g.fillText(e.name,x+110,y+135);});images.push({file:'effects/events/contact-sheet.png',data:c.toDataURL()});
   return {images,manifest:{version:1,source:['packs/ai/skills.ts','packs/ai/hazards.ts'],frame:{width:size,height:size,anchor:{x:64,y:64},columns},catalog:PixelEvents.catalog,units}};
  });
  for(const im of data.images){const file=path.join(root,im.file);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(im.data.split(',')[1],'base64'));}
  fs.writeFileSync(path.join(root,'effects/events/manifest.json'),JSON.stringify(data.manifest,null,2)+'\n');console.log(JSON.stringify({units:data.manifest.units.length,eventTypes:data.manifest.catalog.length,clips:data.manifest.units.reduce((n,u)=>n+u.clips.length,0)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
