'use strict';
(()=>{
const units=Mascots.units,byId=new Map(units.map(u=>[u.id,u])),canvas=document.querySelector('#arena'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const state={id:'doubao',hp:100,enemyHp:100,mode:'idle',time:0,paused:false,speed:1,shockUntil:0,shockAt:-9999,hitAt:-9999,attackAt:-9999,impactDone:true,nextAttack:0,enemyStrike:Infinity,kills:0};
let last=0,hidden=document.hidden;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hpInput=document.querySelector('#health'),hpValue=document.querySelector('#hpValue'),notice=document.querySelector('#notice');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const emotion=(hp,t=state.time,shock=state.shockUntil)=>hp<=0?'dead':t<shock?'shock':hp<=20?'cry':hp<=50?'serious':'happy';
const words={dead:'倒下休息',cry:'哭哭',shock:'吓一跳',serious:'认真脸',happy:'笑眯眯'};
function triggerShock(duration=650){if(state.hp<=0)return;state.shockAt=state.time;state.shockUntil=state.time+duration;}
function setHp(value,hit=false){let old=state.hp;state.hp=clamp(Number(value)||0,0,100);if(old>50&&state.hp<=50&&state.hp>20)triggerShock();if(state.hp>50||state.hp<=20)state.shockUntil=0;if(hit&&state.hp<old)state.hitAt=state.time;if(!state.hp){state.mode='idle';state.attackAt=-9999;state.enemyStrike=Infinity;state.impactDone=true;}hpInput.value=state.hp;hpValue.value=state.hp+'%';sync();}
function setMode(mode){if(!state.hp)return;state.mode=mode;if(mode==='fight')state.nextAttack=state.time;sync();}
function sync(){document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));document.querySelectorAll('.unit').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===state.id)));document.querySelector('#shock').disabled=!state.hp;document.querySelector('#attack').disabled=!state.hp||!state.enemyHp;document.querySelector('#damage').disabled=!state.hp;document.querySelector('#heal').disabled=state.hp===100;document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=!state.hp);const u=byId.get(state.id);document.querySelector('#chosen').textContent=u.name+' · '+({melee:'近战',ranged:'远程攻击',caster:'远程施法',support:'护盾反击'}[u.role]);}
function reset(){state.enemyHp=100;state.mode='idle';state.shockUntil=0;state.shockAt=-9999;state.hitAt=-9999;state.attackAt=-9999;state.enemyStrike=Infinity;state.impactDone=true;setHp(100);notice.textContent='满血了，又可以笑着出门。';}
function select(id){state.id=id;reset();notice.textContent=byId.get(id).name+' 准备好了。';}
function attack(){if(!state.hp||!state.enemyHp||state.time-state.attackAt<850)return;state.attackAt=state.time;state.impactDone=false;notice.textContent=byId.get(state.id).name+'：蓄力，出手！';}
function advance(dt){state.time+=dt;const t=state.time;if(state.mode==='fight'&&state.hp&&state.enemyHp&&t>=state.nextAttack){attack();state.nextAttack=t+1500;}if(!state.impactDone&&t-state.attackAt>=420){state.impactDone=true;state.enemyHp=Math.max(0,state.enemyHp-18);state.enemyStrike=state.enemyHp?t+430:Infinity;if(!state.enemyHp){state.mode='idle';notice.textContent='木桩打倒了！点击“满血重来”再练一轮。';sync();}}if(t>=state.enemyStrike){state.enemyStrike=Infinity;setHp(state.hp-16,true);notice.textContent=state.hp?'木桩反击！表情会跟着血量变。':'倒下啦，回点血就能站起来。';}}
hpInput.oninput=e=>setHp(e.target.value);document.querySelector('#damage').onclick=()=>{setHp(state.hp-30,true);notice.textContent='挨了一下：'+words[emotion(state.hp)]+'。'};document.querySelector('#heal').onclick=()=>{setHp(state.hp+30);notice.textContent='回血了：'+words[emotion(state.hp)]+'。'};document.querySelector('#shock').onclick=()=>{triggerShock(1000);notice.textContent='啊？！眼睛都吓白了。';};document.querySelector('#reset').onclick=reset;document.querySelector('#attack').onclick=attack;document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));document.querySelector('#speed').onchange=e=>state.speed=Number(e.target.value);document.querySelector('#pause').onclick=()=>{state.paused=!state.paused;document.querySelector('#pause').textContent=state.paused?'继续':'暂停';document.querySelector('#pause').setAttribute('aria-pressed',String(state.paused));};
const cards=[];units.forEach(u=>{const b=document.createElement('button');b.className='unit';b.dataset.id=u.id;b.setAttribute('aria-label','选择 '+u.name);b.innerHTML='<canvas width="48" height="52" aria-hidden="true"></canvas><span></span>';b.querySelector('span').textContent=u.name;b.onclick=()=>select(u.id);document.querySelector('#roster').append(b);cards.push({u,ctx:b.querySelector('canvas').getContext('2d')});});
const {rect,text,gait}=PixelMascots;
function drawActor(g,u,x,y,scale,t,hp,action='idle',age=9999,shock=0,hitAge=9999){
 return PixelMascots.drawActor(g,u,x,y,scale,t,hp,action,age,shock,hitAge,t-state.shockAt,reduced);
}
function shockEffect(x,y,t){
 if(emotion(state.hp)==='shock')PixelMascots.shockEffect(ctx,x,y,t-state.shockAt,state.shockUntil-state.shockAt,reduced);
}
function background(){rect(ctx,0,0,600,280,'#142f2d');for(let r=0;r<6;r++)for(let c=0;c<15;c++)rect(ctx,c*40,70+r*25,39,24,(r+c)%2?'#274b3b':'#294e3d');rect(ctx,0,68,600,2,'#668264');rect(ctx,0,220,600,4,'#668264');rect(ctx,0,224,600,9,'#203d31');for(const x of [28,568]){rect(ctx,x,44,5,19,'#617159');rect(ctx,x-2,39,9,7,'#f3c477');rect(ctx,x+1,40,3,4,'#ffebae');}text(ctx,'MOTION / '+byId.get(state.id).name.toUpperCase(),300,28,'#d6ddc2',11);}
function render(){const t=state.time,u=byId.get(state.id),age=t-state.attackAt,walking=state.mode==='walk'&&state.hp>0,offset=walking?Math.round(Math.sin(t/1300)*40):0,attackMove=u.role==='melee'&&age>=220&&age<850?Math.round(45*Math.sin((age-220)/630*Math.PI)):0,x=146+offset+attackMove,y=111;
 background();rect(ctx,x+18,208,66,5,'#18372e');rect(ctx,395,208,62,5,'#18372e');
 drawActor(ctx,u,x,y,4,t,state.hp,walking?'walk':'idle',age,state.shockUntil,t-state.hitAt);
 shockEffect(x,y,t);
 const hit=age>=420&&age<680,shake=hit&&!reduced?Math.round(Math.sin(age/20)*3):0,fall=state.enemyHp===0;
 ctx.save();ctx.translate(422+shake,207);if(fall)ctx.rotate(Math.PI/2);rect(ctx,-4,-76,8,76,'#806342');rect(ctx,-22,-70,44,40,'#ae8757');rect(ctx,-25,-58,50,5,'#e5bd75');rect(ctx,-12,-63,3,3,'#483d30');rect(ctx,10,-63,3,3,'#483d30');rect(ctx,-8,-49,16,2,'#483d30');if(hit){ctx.globalAlpha=.45;rect(ctx,-22,-70,44,40,'#fff7d1');}ctx.restore();ctx.globalAlpha=1;
 if(age>=220&&age<600&&state.hp>0){const p=clamp((age-220)/200,0,1);if(u.role==='melee'){for(let i=0;i<6;i++)rect(ctx,385+i*6,133+i*6,4,8,u.color);}else{const px=242+(402-242)*p,py=148-15*Math.sin(p*Math.PI);rect(ctx,px,py,7,7,u.color);rect(ctx,px-9,py+2,5,3,'#dce8b3');}if(age>=420){text(ctx,'−18',423,104-(age-420)/25,'#ffe9ad',13);for(let i=0;i<8;i++){const a=i*Math.PI/4,r=8+(age-420)/8;rect(ctx,421+Math.cos(a)*r,150+Math.sin(a)*r,3,3,u.color);}}}
 if(u.id==='gpt'&&state.hp>20){ctx.strokeStyle='#a6ccc3';ctx.lineWidth=2;ctx.strokeRect(x-3,y-5,102,89);}
 const bars=[[x+10,state.hp,u.color],[393,state.enemyHp,'#d1aa70']];for(const [bx,hp,color]of bars){rect(ctx,bx,87,76,5,'#122b25');rect(ctx,bx,87,Math.round(76*hp/100),5,color);}
 text(ctx,words[emotion(state.hp)],x+48,76,'#e9e8cb',10);text(ctx,'训练木桩',430,76,'#c9d7b3',10);text(ctx,`${state.hp}%`,x+48,104,'#e2ddc4',9);text(ctx,`${state.enemyHp}%`,430,104,'#e2ddc4',9);
 const actionLabel=state.hp===0?'倒下':emotion(state.hp)==='shock'?'吃惊！':age<220?'蓄力':age<440?'出手':age<850?'收回':walking?'交替迈步':'待机';text(ctx,actionLabel,300,252,'#bcd0aa',11);text(ctx,'满血笑 / 半血惊一下 / 残血哭哭',300,270,'#76957c',9);
 for(const card of cards){const g=card.ctx;g.clearRect(0,0,48,52);g.imageSmoothingEnabled=false;drawActor(g,card.u,0,1,2,t,state.hp,state.mode==='walk'?'walk':'idle',state.mode==='fight'?age:9999,state.shockUntil,9999);}
}
function tick(now){const delta=last?Math.min(50,now-last):0;last=now;if(!state.paused&&!hidden)advance(delta*state.speed);render();requestAnimationFrame(tick);}document.addEventListener('visibilitychange',()=>{hidden=document.hidden;last=0});sync();requestAnimationFrame(tick);
window.motionLab={state,emotion,gait,select,setHp,setMode,triggerShock,attack,advance,render,reset,units:units.map(({id,name})=>({id,name}))};
})();
