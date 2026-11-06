'use strict';
// Deterministic, stateless pixel FX. No combat rules, randomness, timers or DOM access.
window.PixelEffects=(()=>{
const definitions=[
 ['claude','橘色花火','flower','#f48738','#ffd19a','#8b3d1e'],
 ['gpt','黑白泡泡反击','bubble','#ffffff','#ffffff','#101010'],
 ['codex','黑白终端脉冲','terminal','#ffffff','#ffffff','#101010'],
 ['deepseek','蓝色鲸浪','wave','#527cff','#c6e4ff','#193a9d'],
 ['gemini','紫蓝星芒','star','#aa72ff','#cceaff','#4b3599'],
 ['grok','灰银斩击','slash','#a5acb6','#f5f5f5','#30343e'],
 ['kimi','蓝色月弧','slash','#4c89ff','#c7e5ff','#20387e'],
 ['qwen','紫色三环','orbit','#b378f2','#efcfff','#60309b'],
 ['glm','蓝色折光','terminal','#4285ff','#c6e5ff','#244d9b'],
 ['minimax','橙红声波','wave','#ff8854','#ffd0a1','#a13f35'],
 ['characterai','灰白对话泡','bubble','#e0ded9','#ffffff','#38363d'],
 ['replika','粉紫守护','bubble','#d79dea','#ffe3fb','#835693'],
 ['talkie','金黄音浪','wave','#ffc247','#fff0b0','#97621e'],
 ['xiaoice','冰蓝雪晶','star','#9ae9ee','#edffff','#3c7f9e'],
 ['doubao','红围巾旋风','ribbon','#f04a45','#ffd3c2','#992b33'],
 ['llama','淡紫双环','orbit','#a68af3','#e4d8ff','#57549f'],
 ['mistral','橘黄疾风','ribbon','#f69532','#ffe39a','#9c4126'],
 ['copilot','青色护航','bubble','#5ac9e8','#d7faff','#346d9e'],
 ['ernie','紫色书页','terminal','#8d7cf3','#e0dcff','#51419e'],
 ['hunyuan','玉绿元宝光','orbit','#71e2a4','#d0ffe3','#1f805a'],
 ['musespark','奶油色暖光','bubble','#e2ccaa','#fff4dc','#a38a66'],
 ['nai','紫色墨迹','ribbon','#a56ae0','#e7c9ff','#693695'],
 ['tripo','薄荷方晶','star','#67dfc4','#d7fff1','#278e7e'],
 ['manus','米白掌风','slash','#faf0d9','#ffffff','#9c8f77'],
 ['kiro','紫色幽灵焰','flower','#ba81ec','#f2d9ff','#7145a0'],
 ['jimeng','玫粉梦光','orbit','#ee60c7','#ffd5f5','#963879'],
 ['gemma','天蓝星点','star','#75cce4','#e0faff','#397fa7'],
 ['kling','荧绿快斩','slash','#b9f43f','#efffb3','#638827'],
 ['ollama','米白小云','bubble','#f4e6ce','#fffaf0','#a39277']
];
const themes=Object.fromEntries(definitions.map(([id,name,motif,main,light,dark])=>[id,{id,name,motif,main,light,dark}]));
const attackStyles=Object.fromEntries(definitions.map(([id])=>[id,['claude','grok','manus','kiro'].includes(id)?'melee':['codex','kimi','talkie','llama','mistral','musespark'].includes(id)?'projectile':'magic']));
const timings={attack:{durationMs:850,launchMs:220,impactMs:420,endMs:780},skill:{durationMs:1200,launchMs:360,impactMs:600,endMs:1140}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function theme(id){const t=themes[id.replace(/^ai-/,'')];if(!t)throw new Error('Unknown FX character: '+id);return t;}
function phaseAt(kind,age){const t=timings[kind];if(!t)throw new Error('Unknown FX kind: '+kind);if(!Number.isFinite(age)||age<0||age>=t.endMs)return null;if(age<t.launchMs)return {phase:'charge',progress:age/t.launchMs};if(age<t.impactMs)return {phase:'flight',progress:(age-t.launchMs)/(t.impactMs-t.launchMs)};return {phase:'impact',progress:(age-t.impactMs)/(t.endMs-t.impactMs)};}
function square(g,x,y,size,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),size,size);}
function segment(g,x1,y1,x2,y2,color,size=1){const n=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1)));for(let i=0;i<=n;i++){const p=n?i/n:0;square(g,x1+(x2-x1)*p,y1+(y2-y1)*p,size,color);}}
function ring(g,r,color,step=48){for(let i=0;i<step;i++){const a=i/step*Math.PI*2;square(g,Math.cos(a)*r,Math.sin(a)*r,1,color);}}
function star(g,r,t){for(let i=0;i<8;i++){const a=i*Math.PI/4;segment(g,Math.cos(a)*2,Math.sin(a)*2,Math.cos(a)*r,Math.sin(a)*r,t.dark,3);segment(g,Math.cos(a)*2,Math.sin(a)*2,Math.cos(a)*r,Math.sin(a)*r,t.main,1);}square(g,-1,-1,3,t.light);}
function motif(g,t,r,p){
 switch(t.motif){
  case 'flower':for(let i=0;i<12;i++){const a=i*Math.PI/6+p*.25;segment(g,Math.cos(a)*r*.35,Math.sin(a)*r*.35,Math.cos(a)*r,Math.sin(a)*r,t.dark,3);segment(g,Math.cos(a)*r*.35,Math.sin(a)*r*.35,Math.cos(a)*r,Math.sin(a)*r,t.main,2);}square(g,-2,-2,5,t.light);break;
  case 'bubble':ring(g,r+1,t.dark);ring(g,r,t.main);ring(g,r-1,t.light);square(g,-r*.5,-r*.7,2,t.main);square(g,-1,-1,2,t.dark);break;
  case 'terminal':for(const x of [-r,r]){segment(g,x,-r*.65,x,r*.65,t.dark,3);segment(g,x,-r*.65,x,r*.65,t.main);}segment(g,-r,-r*.65,-r+3,-r*.65,t.main);segment(g,r-3,r*.65,r,r*.65,t.main);segment(g,-4,-4,0,0,t.dark,3);segment(g,0,0,-4,4,t.dark,3);segment(g,-4,-4,0,0,t.main);segment(g,0,0,-4,4,t.main);segment(g,3,4,7,4,t.main,2);break;
  case 'wave':for(let j=-1;j<=1;j++)for(let x=-r;x<r;x++){const y=Math.sin(x*.3+p*5)*2+j*4;square(g,x,y,2,t.dark);square(g,x,y,1,j===0?t.light:t.main);}break;
  case 'orbit':for(let j=0;j<3;j++){g.save();const a=j*Math.PI*2/3+p;g.translate(Math.cos(a)*r*.4,Math.sin(a)*r*.4);ring(g,r*.6+1,t.dark);ring(g,r*.6,t.main,32);g.restore();}square(g,-1,-1,2,t.light);break;
  case 'slash':for(let j=0;j<3;j++){segment(g,-r+j*3,r*.6,-r*.1+j*3,-r*.4,t.dark,3);segment(g,-r*.1+j*3,-r*.4,r,-r*.65,t.dark,3);segment(g,-r+j*3,r*.6,-r*.1+j*3,-r*.4,j===1?t.light:t.main);segment(g,-r*.1+j*3,-r*.4,r,-r*.65,j===1?t.light:t.main);}break;
  case 'ribbon':for(let x=-r;x<r;x++){const y=Math.sin(x*.25+p*5)*4;segment(g,x,y,x,y+3,t.dark,2);square(g,x,y,2,t.main);if(x%3===0)square(g,x,y,1,t.light);}break;
  default:star(g,r,t);
 }
}
// Local transparent sprite. Coordinates and scale are independent of any arena.
function drawLocal(g,id,phase,{x=0,y=0,scale=1,progress=0,kind='skill',reducedMotion=false}={}){
 const t=theme(id),p=clamp(progress,0,1);if(!['charge','flight','impact','aura'].includes(phase))throw new Error('Unknown FX phase: '+phase);
 g.save();g.translate(Math.round(x),Math.round(y));g.scale(scale,scale);g.imageSmoothingEnabled=false;
 if(phase==='charge'){
  const r=4+p*8;ring(g,r+1,t.dark);ring(g,r,t.main);motif(g,t,3+p*3,p);
  if(!reducedMotion)for(let i=0;i<6;i++){const a=i*Math.PI/3+p,dist=18-p*7;square(g,Math.cos(a)*dist,Math.sin(a)*dist,2,t.main);}
 }else if(phase==='flight'){
  if(!reducedMotion)for(let i=1;i<=5;i++){square(g,-8-i*3,Math.sin(p*6+i)*2,3,t.dark);square(g,-8-i*3,Math.sin(p*6+i)*2,2,i%2?t.main:t.light);}
  if(kind==='attack'&&attackStyles[t.id]==='melee'){segment(g,-8,8,8,-8,t.dark,3);segment(g,-8,8,8,-8,t.main,2);segment(g,-5,7,9,-7,t.light,1);}else motif(g,t,kind==='skill'?9:5,p);
 }else if(phase==='impact'){
  const r=5+p*17;g.globalAlpha*=Math.min(1,(1-p)*3);ring(g,r+1,t.dark);ring(g,r,t.main);motif(g,t,Math.max(2,12*(1-p)),p);
  for(let i=0;i<(reducedMotion?4:10);i++){const a=i*Math.PI*2/(reducedMotion?4:10),d=r+2;segment(g,Math.cos(a)*d,Math.sin(a)*d,Math.cos(a)*(d+3),Math.sin(a)*(d+3),t.dark,3);segment(g,Math.cos(a)*d,Math.sin(a)*d,Math.cos(a)*(d+3),Math.sin(a)*(d+3),i%2?t.main:t.light,1);}
 }else{
  const r=18+(reducedMotion?0:Math.floor(Math.sin(p*Math.PI)*2));ring(g,r+1,t.dark);ring(g,r,t.main);ring(g,r-1,t.light);for(const a of [-2.3,-.7]){square(g,Math.cos(a)*(r-3),Math.sin(a)*(r-3),2,t.light);}
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
