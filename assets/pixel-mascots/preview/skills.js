'use strict';
// Visual recipes derived from packs/ai/skills.ts, not a second combat implementation.
window.PixelSkills=(()=>{
const defs={
 claude:['黄牌','guard','举牌 → 自身橘色护盾 → 免控亮边',0],
 gpt:['接住你','protect','黑白护盾包住自己和附近友军',0],
 codex:['双生 · Codex 形态','transform','GPT 半血后的换形、攻速和破甲强化；无独立主动技能',0],
 deepseek:['好的，现在我是xxx了','meditate','沉思隐去 → 偷攻击连线 → 1.2 秒后自身周围爆发',1],
 characterai:['多开角色','multiHeal','三张角色气泡分别命中三敌，自身回血',1],
 doubao:['你豆包姐姐来咯','replace','一名敌人换成豆包、沉默；自己回血和加攻',0],
 kimi:['百万上下文','pierce','长蓝弹贯穿两敌；全队射程标记',1],
 qwen:['全家桶','multi','三发紫弹分头命中三敌；自身加速',1],
 grok:['口无遮拦','rider','加速、缴械；普攻附加追击与随机真伤',0],
 glm:['中英双语','bilingual','英文：三斩破防；中文：附近治疗、自身护盾',1],
 replika:['陪伴','healShield','附近治疗、自身粉紫护盾',0],
 talkie:['语音陪伴','voice','金色音波治疗附近友军、全队生命增益',0],
 llama:['开源鼻祖','rangeShield','全队射程和生命增益；自身淡紫护盾',0],
 mistral:['稀疏激活','pick','仅点亮攻击、攻速、减伤中的一项',0],
 copilot:['捆绑安装','install','附近友军青色护盾、全队加攻',0],
 ernie:['中文语料','area','紫色书页在目标处展开，范围命中、两敌破防',1],
 hunyuan:['全模态','doubleSlow','两束玉绿光分别命中两敌，挂减速钟',1],
 musespark:['长文检索','search','米色检索框锁住最远敌人；全队射程增益',1],
 gemini:['得意的Gemini','gamble','普通星爆 / 超常大星爆、破防与自身加速',1],
 xiaoice:['元老社牛','install','冰蓝护盾保护附近友军、全队加攻',0],
 nai:['画出来','paint','紫色笔迹画向当前目标，墨花命中',1],
 tripo:['生成模型','doubleCube','薄荷线框方块分别生成在两名敌人身上',1],
 manus:['连续干活','work','获得持续追加攻击；普攻后冲向下一个目标',0],
 minimax:['海螺全模态','area','橙红声纹在目标处扩散，范围命中、两敌破防',1],
 kiro:['输出卡 8000','eight','八个独立紫色命中节拍',1],
 jimeng:['延迟出图','delayed','画框加载 2 秒后，在自身周围爆开',1],
 gemma:['蒸馏','distill','自身加攻，再将凝聚的小星弹打向当前目标',1],
 kling:['镜头动了','pull','荧绿镜头框拉近最远敌人，再向外击退；眩晕标记',0],
 ollama:['本地部署','local','自身米白护盾，全队攻速箭头',0]
};
const variants={glm:['英文 · 三斩破防','中文 · 治疗护盾'],gemini:['一般发挥','超常发挥'],mistral:['攻击激活','攻速激活','减伤激活']};
const symbols=['shield','heal','attack','speed','range','card','silence','armor','slow','disarm','cube','page','frame','immune'];
function spec(id,variant=0){id=id.replace(/^ai-/,'');const d=defs[id];if(!d)throw Error('Unknown skill '+id);return {id,name:d[0],recipe:d[1],description:d[2],damage:!!d[3]&&!(id==='glm'&&variant===1),variant,variants:variants[id]||[],impactMs:id==='deepseek'?1200:id==='jimeng'?2000:600,durationMs:id==='deepseek'?2100:id==='jimeng'?2900:1800};}
const box=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h);};
function line(g,a,b,c,width=1){const n=Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y)));for(let i=0;i<=n;i++){const p=n?i/n:0;box(g,a.x+(b.x-a.x)*p,a.y+(b.y-a.y)*p,width,width,c);}}
function drawToken(g,id,symbol,{x=0,y=0,scale=1,progress=0}={}){
 const t=PixelEffects.theme(id);g.save();g.translate(Math.round(x),Math.round(y));g.scale(scale,scale);
 const r=(x,y,w,h,c=t.main)=>box(g,x,y,w,h,c),l=(x,y,a,b,c=t.main,w=1)=>line(g,{x,y},{x:a,y:b},c,w);
 if(symbol==='shield'||symbol==='immune'){l(-7,-7,7,-7,t.dark,3);l(-7,-7,-7,3,t.dark,3);l(7,-7,7,3,t.dark,3);l(-7,3,0,9,t.dark,3);l(0,9,7,3,t.dark,3);l(-7,-7,7,-7);l(-7,-7,-7,3);l(7,-7,7,3);l(-7,3,0,9);l(0,9,7,3);if(symbol==='immune'){l(-3,0,-1,3,t.light,2);l(-1,3,4,-3,t.light,2);}}
 else if(symbol==='heal'){r(-2,-7,5,15,t.dark);r(-7,-2,15,5,t.dark);r(-1,-6,3,13,t.light);r(-6,-1,13,3,t.main);}
 else if(['attack','speed','range'].includes(symbol)){for(let i=0;i<(symbol==='speed'?2:1);i++){const o=i*5;l(-6,-5+o,0,-10+o,t.dark,3);l(0,-10+o,6,-5+o,t.dark,3);l(-6,-5+o,0,-10+o);l(0,-10+o,6,-5+o);}if(symbol==='attack')l(0,-8,0,7,t.light,2);if(symbol==='range'){l(-9,2,9,2,t.light);l(-9,2,-5,-2);l(9,2,5,-2);}}
 else if(symbol==='card'||symbol==='page'){r(-6,-9,13,19,t.dark);r(-5,-8,11,17);r(-3,-6,7,2,t.light);if(symbol==='page'){r(-3,-1,7,1,t.light);r(-3,3,5,1,t.light);}else{r(-1,-3,3,6,t.dark);r(-1,5,3,2,t.dark);}}
 else if(symbol==='frame'){for(const x of [-9,5])for(const y of [-7,4]){r(x,y,5,2);r(x,y,2,5);}r(-4,0,Math.max(1,Math.round(progress*9)),2,t.light);}
 else if(symbol==='cube'){const p=[[-7,-3],[0,-7],[7,-3],[7,5],[0,9],[-7,5],[-7,-3],[0,1],[7,-3]];for(let i=1;i<p.length;i++)l(...p[i-1],...p[i]);l(0,1,0,9,t.light);}
 else if(symbol==='slow'){for(const [a,b]of [[[-7,-7],[7,-7]],[[-7,7],[7,7]],[[-6,-6],[6,6]],[[6,-6],[-6,6]]])l(...a,...b);r(-2,4,5,2,t.light);}
 else if(symbol==='armor'){l(-7,-7,7,-7);l(-7,-7,-7,4);l(7,-7,7,4);l(-7,4,0,9);l(0,9,7,4);l(2,-7,-2,-1,t.light,2);l(-2,-1,2,1,t.light,2);l(2,1,-2,8,t.light,2);}
 else {r(-7,-5,15,10,t.dark);r(-6,-4,13,8);r(-4,-1,9,2,t.dark);l(-8,7,8,-7,t.light,2);if(symbol==='disarm')l(-4,6,5,-5,t.dark);}
 g.restore();
}
function draw(g,id,{ageMs=0,source={x:180,y:150},allies=[],foes=[{x:420,y:150}],variant=0,reducedMotion=false,scale=2}={}){
 const s=spec(id,variant),t=PixelEffects.theme(id),age=ageMs;id=s.id;if(age<0||age>=s.durationMs||!Number.isFinite(age))return null;
 const started=age>=s.impactMs,p=Math.max(0,Math.min(.99,(age-s.impactMs)/(s.durationMs-s.impactMs))),friends=[source,...allies],enemies=foes.length?foes:[source],target=enemies[0];
 const far=enemies.reduce((a,b)=>Math.hypot(b.x-source.x,b.y-source.y)>Math.hypot(a.x-source.x,a.y-source.y)?b:a,target);
 const token=(point,type,dy=-35)=>drawToken(g,id,type,{x:point.x,y:point.y+dy,scale:1.5,progress:age/s.impactMs});
 const aura=point=>PixelEffects.drawLocal(g,id,'aura',{...point,scale:scale*(point===source?1.4:.9),progress:p,reducedMotion});
 const burst=(point,mul=1,progress=p)=>PixelEffects.drawLocal(g,id,'impact',{...point,scale:scale*mul,progress,reducedMotion});
 const rays=(targets,type='flight')=>{const fly=Math.max(0,Math.min(1,(age-280)/Math.max(1,s.impactMs-280)));for(const pt of targets)if(!started){if(age>=280)PixelEffects.drawLocal(g,id,type,{x:source.x+(pt.x-source.x)*fly,y:source.y+(pt.y-source.y)*fly,scale:scale*.65,progress:fly,reducedMotion});}else burst(pt,.8);};
 const buff=(points,type)=>points.forEach(point=>token(point,type));
 g.save();
 if(!started)PixelEffects.drawLocal(g,id,'charge',{...source,scale:1,progress:age/s.impactMs,reducedMotion});
 switch(s.recipe){
  case 'guard':token({x:source.x+43,y:source.y},'card',-24-Math.min(8,age/70));if(started){aura(source);token(source,'immune',28);}break;
  case 'protect':if(started)friends.forEach(pt=>{if(pt!==source){line(g,{x:source.x,y:source.y+25},{x:pt.x,y:pt.y+25},t.dark,4);line(g,{x:source.x,y:source.y+25},{x:pt.x,y:pt.y+25},t.main,2);}aura(pt);token(pt,'shield');});break;
  case 'transform':if(started){token(source,'attack');token(source,'speed',0);drawToken(g,id,'frame',{x:source.x,y:source.y,scale:2.8,progress:p});for(let i=0;i<4;i++)box(g,source.x-30+i*15,source.y+30,10,2,t.main);}break;
  case 'meditate':if(!started){for(let i=0;i<3;i++)box(g,source.x-12+i*9,source.y-40,4,4,t.main);line(g,target,source,t.main);token(source,'attack',-60);}else burst(source,2);break;
  case 'replace':rays([target]);if(started){if(window.PixelMascots)PixelMascots.draw(g,'doubao',{x:target.x-24,y:target.y-20,scale:2});token(target,'silence',-40);token(source,'heal');token(source,'attack',15);}break;
  case 'pierce':if(age>=280){const q=Math.min(1,(age-280)/650),end={x:source.x+(far.x-source.x+35)*q,y:source.y+(far.y-source.y)*q};line(g,source,end,t.dark,6);line(g,source,end,t.main,3);if(started){enemies.slice(0,2).forEach(pt=>burst(pt,.6));buff(friends,'range');}}break;
  case 'multi':case 'multiHeal':rays(enemies.slice(0,3));if(s.recipe==='multiHeal'){enemies.slice(0,3).forEach(pt=>token(pt,'page'));if(started)token(source,'heal');}else if(started)token(source,'speed');break;
  case 'rider':if(started){token(source,'speed');token(target,'disarm');rays([target,enemies[1]||target]);}break;
  case 'bilingual':if(variant===1){if(started){friends.forEach(pt=>token(pt,'heal'));aura(source);}}else if(started){const beat=Math.min(2,Math.floor(p*3));for(let i=0;i<=beat;i++)line(g,{x:target.x-25+i*10,y:target.y-24},{x:target.x+15+i*10,y:target.y+22},t.main,3);token(target,'armor');}break;
  case 'healShield':if(started){friends.forEach(pt=>token(pt,'heal'));aura(source);}break;
  case 'voice':if(started){friends.forEach(pt=>{burst(pt,.8);token(pt,'heal');});}break;
  case 'rangeShield':if(started){aura(source);buff(friends,'range');friends.forEach(pt=>token(pt,'heal',12));}break;
  case 'pick':if(started){token(source,['attack','speed','shield'][variant%3],-20);if(variant===2)aura(source);}break;
  case 'install':if(started){friends.forEach(aura);buff(friends,'attack');}break;
  case 'area':rays([target]);if(started){burst(target,1.5);enemies.slice(0,2).forEach(pt=>token(pt,'armor'));}if(id==='ernie')token(target,'page',0);break;
  case 'doubleSlow':rays(enemies.slice(0,2));if(started)buff(enemies.slice(0,2),'slow');break;
  case 'search':token(far,'frame',0);rays([far]);if(started)buff(friends,'range');break;
  case 'gamble':rays([target]);if(started){burst(target,variant===1?1.8:.9);if(variant===1){buff(enemies.slice(0,2),'armor');token(source,'speed');}else token(target,'slow');}break;
  case 'paint':if(age>=280){line(g,source,target,t.main,2);token(target,'page',0);}if(started)burst(target);break;
  case 'doubleCube':rays(enemies.slice(0,2));enemies.slice(0,2).forEach(pt=>token(pt,'cube',0));break;
  case 'work':if(started){token(source,'attack');const next=enemies[1]||target;for(let i=0;i<6;i++)box(g,source.x+(next.x-source.x)*i/6,source.y+(next.y-source.y)*i/6,4,2,t.main);token(next,'frame',0);}break;
  case 'eight':if(started){const beat=Math.min(7,Math.floor(p*8)),q=p*8-beat;burst(target,.8,q);for(let i=0;i<8;i++)box(g,target.x-30+i*8,target.y-42,5,4,i<=beat?t.main:t.dark);}break;
  case 'delayed':if(!started)token(source,'frame',-30);else burst(source,2);break;
  case 'distill':token(source,'attack');rays([target]);break;
  case 'pull':{const q=age/s.durationMs,pos=q<.6?{x:far.x+(source.x+75-far.x)*q/.6,y:far.y+(source.y-far.y)*q/.6}:{x:source.x+75+(q-.6)*200,y:source.y};line(g,source,pos,t.main,2);token(pos,'frame',0);if(started){burst(source,1.3);token(pos,'slow');}break;}
  case 'local':if(started){aura(source);buff(friends,'speed');}break;
 }
 g.restore();return {phase:started?'resolve':'cast',skill:s.name,damage:s.damage};
}
return {defs,variants,symbols,spec,drawToken,draw};
})();
