'use strict';
// Deterministic, stateless pixel FX. No combat rules, randomness, timers or DOM access.
window.PixelEffects=(()=>{
const definitions=[
 ['claude','橘色花火','flower','#f29466','#ffe3cf','#6b3c35'],
 ['gpt','黑白泡泡反击','bubble','#ededed','#ffffff','#1c1c1c'],
 ['codex','黑白终端脉冲','terminal','#ededed','#ffffff','#1c1c1c'],
 ['deepseek','蓝色鲸浪','wave','#7396f2','#dce8ff','#313f73'],
 ['gemini','紫蓝星芒','star','#ac85f2','#e4dcff','#463875'],
 ['grok','灰银斩击','slash','#aeb4c4','#f7f8fc','#383b4a'],
 ['kimi','蓝色月弧','slash','#6d9df2','#dcecff','#2f4475'],
 ['qwen','紫色三环','orbit','#b786ed','#f2ddff','#56377a'],
 ['glm','蓝色折光','terminal','#6998f0','#dbedff','#314b80'],
 ['minimax','橙红声波','wave','#f28d72','#ffe0d4','#7a3c3c'],
 ['characterai','灰白对话泡','bubble','#dfdbe6','#ffffff','#433c4f'],
 ['replika','粉紫守护','bubble','#dca2eb','#ffe8fc','#6e487d'],
 ['talkie','金黄音浪','wave','#f0c469','#fff4cc','#78592b'],
 ['xiaoice','冰蓝雪晶','star','#8cdbe6','#ebffff','#39677a'],
 ['doubao','红围巾旋风','ribbon','#e86b6e','#ffdcd9','#732f3a'],
 ['llama','淡紫双环','orbit','#a992ed','#e8e0ff','#4d437d'],
 ['mistral','橘黄疾风','ribbon','#f09f56','#ffebc2','#78422b'],
 ['copilot','青色护航','bubble','#6fc9e3','#dffaff','#345d78'],
 ['ernie','紫色书页','terminal','#9686eb','#e6e2ff','#493d7d'],
 ['hunyuan','玉绿元宝光','orbit','#7adbb0','#dcffed','#2b6952'],
 ['musespark','奶油色暖光','bubble','#e0caa8','#fff7e6','#78644d'],
 ['nai','紫色墨迹','ribbon','#ad7ae0','#eed9ff','#59367d'],
 ['tripo','薄荷方晶','star','#74dbc5','#e0fff6','#2c6e65'],
 ['manus','米白掌风','slash','#f2e8d5','#ffffff','#736858'],
 ['kiro','紫色幽灵焰','flower','#be8ceb','#f5e3ff','#5d3d7d'],
 ['jimeng','玫粉梦光','orbit','#e87ec8','#ffe0f6','#753562'],
 ['gemma','天蓝星点','star','#80cde3','#e6fbff','#386680'],
 ['kling','荧绿快斩','slash','#9ee06c','#edffd6','#456932'],
 ['ollama','米白小云','bubble','#f0e3cc','#fffaf0','#756856']
];
const themes=Object.fromEntries(definitions.map(([id,name,motif,main,light,dark])=>[id,{id,name,motif,main,light,dark}]));
const attackStyles=Object.fromEntries(definitions.map(([id])=>[id,['claude','grok','manus','kiro'].includes(id)?'melee':['codex','kimi','talkie','llama','mistral','musespark'].includes(id)?'projectile':'magic']));
const timings={attack:{durationMs:850,launchMs:220,impactMs:420,endMs:780},skill:{durationMs:1200,launchMs:360,impactMs:600,endMs:1140}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function theme(id){const t=themes[id.replace(/^ai-/,'')];if(!t)throw new Error('Unknown FX character: '+id);return t;}
function phaseAt(kind,age){const t=timings[kind];if(!t)throw new Error('Unknown FX kind: '+kind);if(!Number.isFinite(age)||age<0||age>=t.endMs)return null;if(age<t.launchMs)return {phase:'charge',progress:age/t.launchMs};if(age<t.impactMs)return {phase:'flight',progress:(age-t.launchMs)/(t.impactMs-t.launchMs)};return {phase:'impact',progress:(age-t.impactMs)/(t.endMs-t.impactMs)};}
function square(g,x,y,size,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),size,size);}
function segment(g,x1,y1,x2,y2,color,size=1){const n=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1)));for(let i=0;i<=n;i++){const p=n?i/n:0;square(g,x1+(x2-x1)*p,y1+(y2-y1)*p,size,color);}}
function ring(g,r,color,step=56,size=1){for(let i=0;i<step;i++){const a=i/step*Math.PI*2;square(g,Math.cos(a)*r-size*0.3,Math.sin(a)*r-size*0.3,size,color);}}
function sparkle(g,x,y,t,big=false){
 const cx=Math.round(x),cy=Math.round(y);
 if(big){
  square(g,cx-3,cy-1,7,3,t.dark);square(g,cx-1,cy-3,3,7,t.dark);
  square(g,cx-2,cy,5,1,t.main);square(g,cx,cy-2,1,5,t.main);
  square(g,cx-1,cy-1,3,3,t.light);
 }else{
  square(g,cx-2,cy,5,1,t.dark);square(g,cx,cy-2,1,5,t.dark);
  square(g,cx-1,cy,3,1,t.main);square(g,cx,cy-1,1,3,t.main);
  square(g,cx,cy,1,1,t.light);
 }
}
function star(g,r,t){
 for(let i=0;i<8;i++){const a=i*Math.PI/4,len=i%2?r*0.72:r;segment(g,Math.cos(a)*2,Math.sin(a)*2,Math.cos(a)*len,Math.sin(a)*len,t.dark,3);}
 for(let i=0;i<8;i++){const a=i*Math.PI/4,len=i%2?r*0.72:r;segment(g,Math.cos(a)*2,Math.sin(a)*2,Math.cos(a)*len,Math.sin(a)*len,i%2?t.main:t.light,1);}
 square(g,-2,-2,4,t.light);
}
function motif(g,t,r,p){
 switch(t.motif){
  case 'flower':for(let i=0;i<10;i++){const a=i*Math.PI/5+p*.35;segment(g,Math.cos(a)*r*.28,Math.sin(a)*r*.28,Math.cos(a)*r,Math.sin(a)*r,t.dark,4);segment(g,Math.cos(a)*r*.3,Math.sin(a)*r*.3,Math.cos(a)*r,Math.sin(a)*r,i%2?t.main:t.light,2);}square(g,-2,-2,5,t.light);break;
  case 'bubble':ring(g,r+1,t.dark,56,2);ring(g,r,t.main,56,2);ring(g,Math.max(2,r-1.5),t.light,40,1);square(g,-r*.45,-r*.55,2,t.light);square(g,r*.28,r*.32,1,t.light);break;
  case 'terminal':for(const x of [-r,r]){segment(g,x,-r*.65,x,r*.65,t.dark,3);segment(g,x,-r*.65,x,r*.65,t.main,1);}segment(g,-r,-r*.65,-r+3,-r*.65,t.light,2);segment(g,r-3,r*.65,r,r*.65,t.light,2);segment(g,-4,-4,0,0,t.dark,3);segment(g,0,0,-4,4,t.dark,3);segment(g,-4,-4,0,0,t.light,1);segment(g,0,0,-4,4,t.light,1);segment(g,2,3,6,3,t.main,2);break;
  case 'wave':for(let j=-1;j<=1;j++)for(let x=-r;x<=r;x++){const y=Math.sin(x*.32+p*5)*2.5+j*4;square(g,x,y,3,t.dark);square(g,x,y,2,j===0?t.light:t.main);}break;
  case 'orbit':for(let j=0;j<3;j++){g.save();const a=j*Math.PI*2/3+p*1.4;g.translate(Math.cos(a)*r*.38,Math.sin(a)*r*.38);ring(g,r*.58+1,t.dark,36,2);ring(g,r*.58,j===0?t.light:t.main,36,1);g.restore();}square(g,-1,-1,3,t.light);break;
  case 'slash':for(let j=-1;j<=1;j++){const off=j*3;for(let s=0;s<=14;s++){const u=s/14,ang=-1.05+u*2.1,rad=r*(0.85+Math.sin(u*Math.PI)*0.25);square(g,Math.cos(ang)*rad+off-2,Math.sin(ang)*rad-1,3,t.dark);}for(let s=1;s<=13;s++){const u=s/14,ang=-1.05+u*2.1,rad=r*(0.85+Math.sin(u*Math.PI)*0.25);square(g,Math.cos(ang)*rad+off-1,Math.sin(ang)*rad,2,j===0?t.light:t.main);}}break;
  case 'ribbon':for(let x=-r;x<=r;x++){const y=Math.sin(x*.28+p*5)*4;square(g,x,y-1,3,t.dark);square(g,x,y+1,3,t.dark);square(g,x,y,2,t.main);if((x+100)%3===0)square(g,x,y,1,t.light);}break;
  default:star(g,r,t);
 }
}
// Local transparent sprite. Coordinates and scale are independent of any arena.
function drawLocal(g,id,phase,{x=0,y=0,scale=1,progress=0,kind='skill',reducedMotion=false}={}){
 const t=theme(id),p=clamp(progress,0,1);if(!['charge','flight','impact','aura'].includes(phase))throw new Error('Unknown FX phase: '+phase);
 g.save();g.translate(Math.round(x),Math.round(y));g.scale(scale,scale);g.imageSmoothingEnabled=false;
 if(phase==='charge'){
  const r=5+p*9;
  ring(g,r+1,t.dark,52,2);ring(g,r,t.main,52,1);
  if(p>0.25)ring(g,Math.max(2,r-2),t.light,32,1);
  motif(g,t,3+p*3.5,p);
  if(!reducedMotion)for(let i=0;i<6;i++){const a=i*Math.PI/3+p*1.6,dist=18-p*8;sparkle(g,Math.cos(a)*dist,Math.sin(a)*dist,t,i%2===0);}
 }else if(phase==='flight'){
  if(!reducedMotion){
   for(let i=5;i>=1;i--){
    const tx=-6-i*3.4,ty=Math.sin(p*6+i)*2,sz=i<=2?3:2;
    square(g,tx-1,ty-1,sz+2,t.dark);square(g,tx,ty,sz,i%2?t.main:t.light);
   }
   sparkle(g,-15,Math.cos(p*6)*4,t,false);
  }
  if(kind==='attack'&&attackStyles[t.id]==='melee'){
   for(let s=0;s<=18;s++){const u=s/18,a=-1.15+u*2.3,rad=9+Math.sin(u*Math.PI)*4;square(g,Math.cos(a)*rad-2,Math.sin(a)*rad-2,4,t.dark);}
   for(let s=1;s<=17;s++){const u=s/18,a=-1.15+u*2.3,rad=9+Math.sin(u*Math.PI)*4;square(g,Math.cos(a)*rad-1,Math.sin(a)*rad-1,2,t.main);}
   for(let s=4;s<=14;s++){const u=s/18,a=-1.15+u*2.3,rad=10+Math.sin(u*Math.PI)*4;square(g,Math.cos(a)*rad,Math.sin(a)*rad,1,t.light);}
   if(!reducedMotion)sparkle(g,9,-6,t,false);
  }else{
   g.save();g.translate(2,0);motif(g,t,kind==='skill'?9:5.5,p);sparkle(g,kind==='skill'?5:3,0,t,kind==='skill');g.restore();
  }
 }else if(phase==='impact'){
  const r=6+p*16;g.globalAlpha*=Math.min(1,(1-p)*2.8);
  ring(g,r+1,t.dark,60,2);ring(g,r,t.main,60,2);
  if(p<0.55)ring(g,Math.max(2,r-2),t.light,44,1);
  motif(g,t,Math.max(2,12*(1-p*0.85)),p);
  const rays=reducedMotion?4:8;
  for(let i=0;i<rays;i++){
   const a=i*Math.PI*2/rays+p*0.25,d=r+3;
   segment(g,Math.cos(a)*(d-1),Math.sin(a)*(d-1),Math.cos(a)*(d+4),Math.sin(a)*(d+4),t.dark,3);
   segment(g,Math.cos(a)*(d-1),Math.sin(a)*(d-1),Math.cos(a)*(d+4),Math.sin(a)*(d+4),i%2?t.main:t.light,1);
  }
  if(p<0.45)sparkle(g,0,0,t,true);
 }else{
  const r=17+(reducedMotion?0:Math.round(Math.sin(p*Math.PI)*2));
  ring(g,r+1,t.dark,64,2);ring(g,r,t.main,64,2);ring(g,r-1.5,t.light,48,1);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+p*Math.PI*2;sparkle(g,Math.cos(a)*r,Math.sin(a)*r,t,i%2===0);}
 }
 g.restore();
}
function draw(g,id,{kind='attack',ageMs=0,source={x:0,y:0},target={x:100,y:0},scale=2,reducedMotion=false}={}){
 const s=phaseAt(kind,ageMs);if(!s)return null;theme(id);
 let x=source.x,y=source.y;
 if(s.phase==='flight'){x+=(target.x-source.x)*s.progress;y+=(target.y-source.y)*s.progress-(reducedMotion?0:Math.sin(s.progress*Math.PI)*12);}
 if(s.phase==='impact'){x=target.x;y=target.y;}
 if(kind==='attack'&&s.phase==='flight'&&attackStyles[theme(id).id]==='melee'){x=target.x-10+10*s.progress;y=target.y;}
 g.save();g.translate(Math.round(x),Math.round(y));if(s.phase==='flight'&&target.x<source.x)g.scale(-1,1);
 drawLocal(g,id,s.phase,{scale,progress:s.progress,kind,reducedMotion});g.restore();
 if(kind==='skill'&&theme(id).motif==='bubble'&&s.phase!=='charge')drawLocal(g,id,'aura',{x:source.x,y:source.y,scale,progress:ageMs/timings.skill.endMs,reducedMotion});
 return s;
}
return {themes,theme,attackStyles,timings,phaseAt,drawLocal,draw};
})();
