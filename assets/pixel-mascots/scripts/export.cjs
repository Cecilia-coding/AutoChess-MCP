// Run from any directory: node assets/pixel-mascots/scripts/export.cjs
// Requires Playwright and a Chromium installation. Does not run or mutate combat.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const executablePath=process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.addScriptTag({path:path.join(root,'preview/mascots.js')});
  await page.addScriptTag({path:path.join(root,'preview/renderer.js')});
  const data=await page.evaluate(()=>{
   const size=64,columns=8,rows=[],clips={};
   const specs={idle:{times:[0,225,450,675],durations:[225,225,225,225],loop:true},walk:{times:[0,115,230,345],durations:[115,115,115,115],loop:true},attack:{times:[0,110,220,320,420,430,570,710],durations:[110,110,100,100,10,140,140,140],loop:false},hurt:{times:[0,80,160],durations:[80,80,80],loop:false}};
   for(const [mood,hp] of [['happy',100],['serious',50],['cry',20],['shock',100]])for(const [action,spec] of Object.entries(specs)){
    const row=rows.length,key=`${mood}/${action}`;
    clips[key]={row,frames:spec.times.map((_,col)=>({x:col*size,y:row*size,w:size,h:size,durationMs:spec.durations[col]})),loop:spec.loop};
    rows.push({mood,hp,action,...spec});
   }
   clips.dead={row:rows.length,frames:[{x:0,y:rows.length*size,w:size,h:size,durationMs:1000}],loop:false};
   rows.push({mood:'dead',hp:0,action:'idle',times:[0]});
   const images=[],units=[];
   const contact=document.createElement('canvas');contact.width=7*128;contact.height=5*150;const cg=contact.getContext('2d');cg.fillStyle='#eeeaf4';cg.fillRect(0,0,contact.width,contact.height);
   for(const [index,u] of Mascots.units.entries()){
    const atlas=document.createElement('canvas');atlas.width=columns*size;atlas.height=rows.length*size;const g=atlas.getContext('2d');
    rows.forEach((row,ri)=>row.times.forEach((time,ci)=>{
     g.save();g.beginPath();g.rect(ci*size,ri*size,size,size);g.clip();
     PixelMascots.draw(g,u.id,{x:ci*size+20,y:ri*size+16,timeMs:time,hp:row.hp,action:row.action==='walk'?'walk':'idle',attackAgeMs:row.action==='attack'?time:9999,hitAgeMs:row.action==='hurt'?time:9999,shockAgeMs:row.mood==='shock'?Math.min(ci*75,600):9999});g.restore();
    }));
    const pSize=72,pScale=3;
    const probe=document.createElement('canvas');probe.width=probe.height=36;const pg=probe.getContext('2d');
    PixelMascots.draw(pg,u.id,{x:6,y:6,scale:1});
    const pd=pg.getImageData(0,0,36,36).data;
    let minX=36,minY=36,maxX=-1,maxY=-1;
    for(let py=0;py<36;py++)for(let px=0;px<36;px++)if(pd[(py*36+px)*4+3]>0){if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;}
    const bw=Math.max(1,maxX-minX+1),bh=Math.max(1,maxY-minY+1);
    const ox=Math.floor((pSize-bw*pScale)/2)-(minX-6)*pScale;
    const oy=Math.floor((pSize-bh*pScale)/2)-(minY-6)*pScale;
    const portrait=document.createElement('canvas');portrait.width=portrait.height=pSize;PixelMascots.draw(portrait.getContext('2d'),u.id,{x:ox,y:oy,scale:pScale});
    images.push({file:`atlases/ai-${u.id}.png`,data:atlas.toDataURL()},{file:`portraits/ai-${u.id}.png`,data:portrait.toDataURL()});
    units.push({id:`ai-${u.id}`,spriteId:u.id,name:u.name,atlas:`atlases/ai-${u.id}.png`,portrait:`portraits/ai-${u.id}.png`,previewRole:u.role,color:u.color});
    const cx=index%7*128,cy=Math.floor(index/7)*150;cg.fillStyle='#f8f5fc';cg.fillRect(cx+8,cy+6,112,114);cg.strokeStyle='#cfc4e0';cg.strokeRect(cx+8.5,cy+6.5,111,113);cg.imageSmoothingEnabled=false;cg.drawImage(portrait,cx+24,cy+22,80,80);cg.fillStyle='#3c3347';cg.font='bold 13px sans-serif';cg.textAlign='center';cg.fillText(u.name,cx+64,cy+136);
   }
   images.push({file:'contact-sheet.png',data:contact.toDataURL()});
   // Reusable transparent pixel soap-bubble shield layer on the same 64×64 anchor as the actor.
   const bubble=document.createElement('canvas');bubble.width=bubble.height=size;const bg=bubble.getContext('2d');
   const bx=31.5,by=28.5;
   for(let y=10;y<=48;y++)for(let x=13;x<=50;x++){
    const dx=x-bx,dy=y-by,d=Math.hypot(dx,dy);
    if(d>=15.2&&d<16.2){bg.fillStyle='rgba(72,60,94,0.52)';bg.fillRect(x,y,1,1);}
    else if(d>=14.1&&d<15.2){bg.fillStyle=dy<0?'rgba(130,204,226,0.86)':'rgba(192,162,232,0.86)';bg.fillRect(x,y,1,1);}
    else if(d>=12.8&&d<14.1&&dx<-2&&dy<-2){bg.fillStyle='rgba(255,255,255,0.55)';bg.fillRect(x,y,1,1);}
    else if(d>=12.8&&d<14.1&&dx>3&&dy>3){bg.fillStyle='rgba(244,202,226,0.48)';bg.fillRect(x,y,1,1);}
    else if(d<14.1){bg.fillStyle='rgba(222,245,252,0.14)';bg.fillRect(x,y,1,1);}
   }
   bg.fillStyle='rgba(255,255,255,0.92)';bg.fillRect(23,19,2,2);bg.fillRect(21,22,1,1);bg.fillRect(39,36,1,1);
   images.push({file:'effects/bubble.png',data:bubble.toDataURL()});
   return {images,manifest:{version:1,created:'2026-11-06',pixelGrid:24,frame:{width:size,height:size,columns,rows:rows.length,anchor:{x:32,y:40}},atlas:{width:columns*size,height:rows.length*size},thresholds:{happy:'hp > 50',serious:'20 < hp <= 50',cry:'0 < hp <= 20',dead:'hp <= 0',shock:'650 ms on crossing from >50 to 21..50; explicit reaction may override living moods'},clips,units,effects:{bubble:{file:'effects/bubble.png',anchor:{x:32,y:40}},shock:'Included in shock rows; renderer.draw can disable effects.'},muse:{stableId:'ai-musespark',displayName:'Muse',reference:'User-provided beige plush character; empty hands, no heart or props.'}}};
  });
  assert.equal(data.manifest.units.length,29);assert.equal(new Set(data.manifest.units.map(u=>u.id)).size,29);
  for(const im of data.images){const file=path.join(root,im.file);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(im.data.split(',')[1],'base64'));}
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(data.manifest,null,2)+'\n');
  console.log(JSON.stringify({characters:29,clips:Object.keys(data.manifest.clips).length,framesPerCharacter:Object.values(data.manifest.clips).reduce((n,c)=>n+c.frames.length,0),files:data.images.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
