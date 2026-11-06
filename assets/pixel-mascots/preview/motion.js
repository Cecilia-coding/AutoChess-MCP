'use strict';
(()=>{
const units=Mascots.units,byId=new Map(units.map(u=>[u.id,u])),canvas=document.querySelector('#arena'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const state={id:'doubao',hp:100,enemyHp:100,mode:'idle',time:0,paused:false,speed:1,shockUntil:0,shockAt:-9999,hitAt:-9999,attackAt:-9999,impactDone:true,nextAttack:0,enemyStrike:Infinity,kills:0,attackKind:'attack',attackCount:0,fxVisible:true,variant:0};
let last=0,hidden=document.hidden;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hpInput=document.querySelector('#health'),hpValue=document.querySelector('#hpValue'),notice=document.querySelector('#notice');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const emotion=(hp,t=state.time,shock=state.shockUntil)=>hp<=0?'dead':t<shock?'shock':hp<=20?'cry':hp<=50?'serious':'happy';
const castTiming=()=>state.attackKind==='skill'?PixelSkills.spec(state.id,state.variant):PixelEffects.timings.attack;
const words={dead:'倒下休息',cry:'哭哭',shock:'吓一跳',serious:'认真脸',happy:'笑眯眯'};
function triggerShock(duration=650){if(state.hp<=0)return;state.shockAt=state.time;state.shockUntil=state.time+duration;}
function setHp(value,hit=false){let old=state.hp;state.hp=clamp(Number(value)||0,0,100);if(old>50&&state.hp<=50&&state.hp>20)triggerShock();if(state.hp>50||state.hp<=20)state.shockUntil=0;if(hit&&state.hp<old)state.hitAt=state.time;if(!state.hp){state.mode='idle';state.attackAt=-9999;state.enemyStrike=Infinity;state.impactDone=true;}hpInput.value=state.hp;hpValue.value=state.hp+'%';sync();}
function setMode(mode){if(!state.hp)return;state.mode=mode;if(mode==='fight')state.nextAttack=state.time;sync();}
function sync(){document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));document.querySelectorAll('.unit').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===state.id)));document.querySelector('#shock').disabled=!state.hp;document.querySelector('#attack').disabled=!state.hp||!state.enemyHp;document.querySelector('#skill').disabled=!state.hp||!state.enemyHp;document.querySelector('#damage').disabled=!state.hp;document.querySelector('#heal').disabled=state.hp===100;document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=!state.hp);const u=byId.get(state.id),theme=PixelEffects.theme(u.id);document.querySelector('#fxName').textContent=PixelSkills.spec(u.id,state.variant).name;document.querySelector('#skillDescription').textContent=PixelSkills.spec(u.id,state.variant).description;document.querySelector('#skill').textContent=u.id==='codex'?'演示换形':'放个技能 ✦';document.querySelectorAll('#fxColors i').forEach((el,i)=>el.style.background=[theme.main,theme.light,theme.dark][i]);document.querySelector('#chosen').textContent=u.name+' · '+({melee:'近战',ranged:'远程攻击',caster:'远程施法',support:'护盾反击'}[u.role]);}
function reset(){state.enemyHp=100;state.mode='idle';state.attackKind='attack';state.attackCount=0;state.shockUntil=0;state.shockAt=-9999;state.hitAt=-9999;state.attackAt=-9999;state.enemyStrike=Infinity;state.impactDone=true;setHp(100);notice.textContent='满血了，又可以笑着出门。';}
function select(id){state.id=id;state.variant=0;skillChoices();reset();notice.textContent=byId.get(id).name+' 准备好了。';}
function attack(kind='attack'){if(!state.hp||!state.enemyHp||state.time-state.attackAt<castTiming().durationMs)return;state.attackKind=kind;state.attackAt=state.time;state.impactDone=false;notice.textContent=byId.get(state.id).name+'：'+(kind==='skill'?PixelSkills.spec(state.id,state.variant).name+'！':'蓄力，出手！');}
function advance(dt){
 state.time+=dt;const t=state.time;
 if(state.mode==='fight'&&state.hp&&state.enemyHp&&t>=state.nextAttack){attack(state.attackCount++%3===2?'skill':'attack');state.nextAttack=t+Math.max(1500,castTiming().durationMs+250);}
 if(!state.impactDone&&t-state.attackAt>=castTiming().impactMs){
  state.impactDone=true;const damaging=state.attackKind==='attack'||PixelSkills.spec(state.id,state.variant).damage;
  if(damaging){state.enemyHp=Math.max(0,state.enemyHp-(state.attackKind==='skill'?30:18));state.enemyStrike=state.enemyHp?t+430:Infinity;}
  if(!state.enemyHp){state.mode='idle';notice.textContent='木桩打倒了！点击“满血重来”再练一轮。';sync();}
 }
 if(t>=state.enemyStrike){state.enemyStrike=Infinity;setHp(state.hp-16,true);notice.textContent=state.hp?'木桩反击！表情会跟着血量变。':'倒下啦，回点血就能站起来。';}
}
function skillChoices(){const choices=PixelSkills.variants[state.id]||[];document.querySelector('#variantRow').hidden=!choices.length;document.querySelector('#variant').replaceChildren(...choices.map((name,i)=>{const o=document.createElement('option');o.value=i;o.textContent=name;return o;}));document.querySelector('#variant').value=state.variant;}
document.querySelector('#variant').onchange=e=>{state.variant=Number(e.target.value);reset();};
hpInput.oninput=e=>setHp(e.target.value);document.querySelector('#damage').onclick=()=>{setHp(state.hp-30,true);notice.textContent='挨了一下：'+words[emotion(state.hp)]+'。'};document.querySelector('#heal').onclick=()=>{setHp(state.hp+30);notice.textContent='回血了：'+words[emotion(state.hp)]+'。'};document.querySelector('#shock').onclick=()=>{triggerShock(1000);notice.textContent='啊？！眼睛都吓白了。';};document.querySelector('#reset').onclick=reset;document.querySelector('#attack').onclick=()=>attack();document.querySelector('#skill').onclick=()=>attack('skill');document.querySelector('#fxToggle').onclick=()=>{state.fxVisible=!state.fxVisible;document.querySelector('#fxToggle').setAttribute('aria-pressed',String(state.fxVisible));document.querySelector('#fxToggle').textContent=state.fxVisible?'特效：开':'特效：关';};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));document.querySelector('#speed').onchange=e=>state.speed=Number(e.target.value);document.querySelector('#pause').onclick=()=>{state.paused=!state.paused;document.querySelector('#pause').textContent=state.paused?'继续':'暂停';document.querySelector('#pause').setAttribute('aria-pressed',String(state.paused));};
document.querySelectorAll('[data-fx-pick]').forEach(b=>b.onclick=()=>{select(b.dataset.fxPick);attack('skill');});
const cards=[];units.forEach(u=>{const b=document.createElement('button');b.className='unit';b.dataset.id=u.id;b.setAttribute('aria-label','选择 '+u.name);b.innerHTML='<canvas width="48" height="52" aria-hidden="true"></canvas><span></span>';b.querySelector('span').textContent=u.name;b.onclick=()=>select(u.id);document.querySelector('#roster').append(b);cards.push({u,ctx:b.querySelector('canvas').getContext('2d')});});
const {rect,text,gait}=PixelMascots;
function drawActor(g,u,x,y,scale,t,hp,action='idle',age=9999,shock=0,hitAge=9999){
 return PixelMascots.drawActor(g,u,x,y,scale,t,hp,action,age,shock,hitAge,t-state.shockAt,reduced);
}
function shockEffect(x,y,t){
 if(emotion(state.hp)==='shock')PixelMascots.shockEffect(ctx,x,y,t-state.shockAt,state.shockUntil-state.shockAt,reduced);
}
function background(){rect(ctx,0,0,600,280,'#142f2d');for(let r=0;r<6;r++)for(let c=0;c<15;c++)rect(ctx,c*40,70+r*25,39,24,(r+c)%2?'#274b3b':'#294e3d');rect(ctx,0,68,600,2,'#668264');rect(ctx,0,220,600,4,'#668264');rect(ctx,0,224,600,9,'#203d31');for(const x of [28,568]){rect(ctx,x,44,5,19,'#617159');rect(ctx,x-2,39,9,7,'#f3c477');rect(ctx,x+1,40,3,4,'#ffebae');}text(ctx,'MOTION / '+byId.get(state.id).name.toUpperCase(),300,28,'#d6ddc2',11);}
function render(){const t=state.time,u=byId.get(state.id),rawAge=t-state.attackAt,timing=castTiming(),age=rawAge/timing.durationMs*850,walking=state.mode==='walk'&&state.hp>0,offset=walking?Math.round(Math.sin(t/1300)*40):0,attackMove=state.attackKind==='attack'&&u.role==='melee'&&age>=220&&age<850?Math.round(45*Math.sin((age-220)/630*Math.PI)):0,x=146+offset+attackMove,y=111;
 background();rect(ctx,x+18,208,66,5,'#18372e');rect(ctx,395,208,62,5,'#18372e');
 const actor=state.attackKind==='skill'&&u.id==='codex'&&rawAge<timing.impactMs?byId.get('gpt'):u;
 ctx.save();if(state.attackKind==='skill'&&u.id==='deepseek'&&rawAge<1200)ctx.globalAlpha=.25;drawActor(ctx,actor,x,y,4,t,state.hp,walking?'walk':'idle',state.attackKind==='skill'?9999:age,state.shockUntil,t-state.hitAt);ctx.restore();
 shockEffect(x,y,t);
 const damaging=state.attackKind==='attack'||PixelSkills.spec(u.id,state.variant).damage;const hit=damaging&&rawAge>=timing.impactMs&&rawAge<timing.impactMs+260,shake=hit&&!reduced?Math.round(Math.sin(age/20)*3):0,fall=state.enemyHp===0;
 const replaced=state.id==='doubao'&&state.attackKind==='skill'&&rawAge>=timing.impactMs&&rawAge<timing.durationMs;ctx.save();if(replaced)ctx.globalAlpha=0;ctx.translate(422+shake,207);if(fall)ctx.rotate(Math.PI/2);rect(ctx,-4,-76,8,76,'#806342');rect(ctx,-22,-70,44,40,'#ae8757');rect(ctx,-25,-58,50,5,'#e5bd75');rect(ctx,-12,-63,3,3,'#483d30');rect(ctx,10,-63,3,3,'#483d30');rect(ctx,-8,-49,16,2,'#483d30');if(hit&&!replaced){ctx.globalAlpha=.45;rect(ctx,-22,-70,44,40,'#fff7d1');}ctx.restore();ctx.globalAlpha=1;
 const allies=[{x:80,y:163}],foes=[{x:422,y:150},{x:520,y:112},{x:516,y:191}];
 if(state.attackKind==='skill'&&rawAge<timing.durationMs){
  PixelMascots.draw(ctx,'musespark',{x:allies[0].x-20,y:allies[0].y-18,scale:1.8,timeMs:t});text(ctx,'友军',80,205,'#c9d7b3',9);
  for(const pt of foes.slice(1)){rect(ctx,pt.x-3,pt.y-15,6,36,'#806342');rect(ctx,pt.x-12,pt.y-15,24,22,'#ae8757');rect(ctx,pt.x-7,pt.y-10,2,2,'#483d30');rect(ctx,pt.x+5,pt.y-10,2,2,'#483d30');}
 }
 if(state.fxVisible&&state.hp>0){
  if(state.attackKind==='skill')PixelSkills.draw(ctx,u.id,{ageMs:rawAge,source:{x:x+48,y:y+40},allies,foes,variant:state.variant,reducedMotion:reduced});
  else PixelEffects.draw(ctx,u.id,{kind:'attack',ageMs:rawAge,source:{x:x+48,y:y+40},target:foes[0],scale:1.5,reducedMotion:reduced});
 }
 if(hit)text(ctx,state.attackKind==='skill'?'−30':'−18',423,104-(rawAge-timing.impactMs)/25,PixelEffects.theme(u.id).light,13);
 const bars=[[x+10,state.hp,u.color],[393,state.enemyHp,'#d1aa70']];for(const [bx,hp,color]of bars){rect(ctx,bx,87,76,5,'#122b25');rect(ctx,bx,87,Math.round(76*hp/100),5,color);}
 text(ctx,words[emotion(state.hp)],x+48,76,'#e9e8cb',10);text(ctx,'训练木桩',430,76,'#c9d7b3',10);text(ctx,`${state.hp}%`,x+48,104,'#e2ddc4',9);text(ctx,`${state.enemyHp}%`,430,104,'#e2ddc4',9);
 const actionLabel=state.hp===0?'倒下':emotion(state.hp)==='shock'?'吃惊！':age<220?'蓄力':age<440?'出手':age<850?'收回':walking?'交替迈步':'待机';text(ctx,actionLabel,300,252,'#bcd0aa',11);text(ctx,(state.attackKind==='skill'?PixelSkills.spec(u.id,state.variant).name:'普攻 · '+u.name),300,270,PixelEffects.theme(u.id).main,9);
 for(const demo of document.querySelectorAll('[data-fx-demo]')){const g=demo.getContext('2d'),id=demo.dataset.fxDemo;g.fillStyle='#142f2d';g.fillRect(0,0,240,110);PixelMascots.draw(g,id==='codex'&&t%2200<600?'gpt':id,{x:42,y:36,scale:2,timeMs:t});if(id==='gpt')PixelMascots.draw(g,'musespark',{x:144,y:44,scale:1,timeMs:t});if(state.fxVisible)PixelSkills.draw(g,id,{ageMs:reduced?900:t%2200,source:{x:66,y:56},allies:[{x:156,y:56}],foes:[{x:200,y:56}],scale:1.2,reducedMotion:reduced});}
 for(const card of cards){const g=card.ctx;g.clearRect(0,0,48,52);g.imageSmoothingEnabled=false;drawActor(g,card.u,0,1,2,t,state.hp,state.mode==='walk'?'walk':'idle',state.mode==='fight'?age:9999,state.shockUntil,9999);}
}
function tick(now){const delta=last?Math.min(50,now-last):0;last=now;if(!state.paused&&!hidden)advance(delta*state.speed);render();requestAnimationFrame(tick);}document.addEventListener('visibilitychange',()=>{hidden=document.hidden;last=0});skillChoices();sync();requestAnimationFrame(tick);
window.motionLab={state,emotion,gait,select,setHp,setMode,triggerShock,attack,advance,render,reset,units:units.map(({id,name})=>({id,name}))};
})();
