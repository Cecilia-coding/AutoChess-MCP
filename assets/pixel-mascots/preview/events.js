'use strict';
// Event-driven overlays. Trigger eligibility, rolls, targets and durations belong to the game.
window.PixelEvents=(()=>{
const rows=[
 ['hurt','受击','common','*','impact','受击事件',650],
 ['heal','回血','common','*','heal','治疗事件',1200],
 ['shield_gain','获得护盾','common','*','shield','护盾获得',1400],
 ['shield_break','护盾破裂','common','*','break','护盾耗尽',1000],
 ['shield_expire','护盾到期','common','*','expire','护盾时间结束',1000],
 ['silence','沉默','common','*','silence','状态获得：silence',1500],
 ['stun','眩晕','common','*','stun','眩晕状态',1500],
 ['death','倒下','common','*','death','阵亡事件',1800],
 ['revive','重新入场','common','*','revive','新一轮入场或复活事件；不赋予角色复活能力',1600],
 ['buff_expire','增益结束','common','*','expire','增益到期',1000],
 ['claude_safety','Safety reminder','passive','claude','guard','passiveStats：常驻减伤',1600],
 ['claude_immune','挨打也不许控','reaction','claude','immune','onDamaged：400 ms 免控',1200],
 ['claude_ip_scan','查 IP · 扫描','hazard','claude','scan','hazard:ip-ban：战后判定',1800],
 ['claude_ip_pass','查 IP · 通过','hazard','claude','pass','hazard:ip-ban：未命中',1400],
 ['claude_ip_ban','查 IP · 封号离场','hazard','claude','ban','hazard:ip-ban：命中封号，装备退回背包',2000],
 ['claude_ip_immune','三星 · 免查','hazard','claude','crown','hazard:ip-ban：immuneAtStar 3',1600],
 ['gpt_safety','黑白防御层','passive','gpt','guard','passiveStats：常驻减伤',1600],
 ['gpt_codex','半血 · Codex 接棒','reaction','gpt,codex','transform','tick：引擎 reskin 换形、增攻、加速、破甲、回血',2200],
 ['deepseek_rage','思考外泄 · 怒气叠层','reaction','deepseek','rage','onDamaged：rage，最高 6 层',1700],
 ['deepseek_comeback','用户彻底怒了 · 救场','conditional','deepseek','comeback','cast conditional：全队血线低于 40% 时加攻、加速、回血',2200],
 ['deepseek_steal','代入 · 偷一点攻击','reaction','deepseek','steal','cast stealAtk：从目标取攻击',1700],
 ['deepseek_open','开源 · 阵亡传火','death','deepseek','legacy','onDeath：友军攻击增益',2200],
 ['deepseek_peak','错峰定价 · 波峰 +1','hazard','deepseek','priceUp','hazard:off-peak-pricing：波峰',1700],
 ['deepseek_trough','错峰定价 · 波谷 −1','hazard','deepseek','priceDown','hazard:off-peak-pricing：波谷',1700],
 ['characterai_memory','人设记忆','passive','characterai','memory','passiveStats：生命与减伤',1700],
 ['replika_regen','陪伴 · 持续回血','passive','replika','regen','passiveStats：每秒生命恢复',1800],
 ['grok_immune','无审查 · 开场免控','passive','grok','immune','onBattleStart：持续免控',1700],
 ['grok_followup','口无遮拦 · 追加追击','followup','grok','followup','cast rider：普攻追加物伤、随机目标真伤',1800],
 ['glm_soldout','Coding Plan · 售罄','hazard','glm','soldout','hazard:coding-plan-soldout：商店售罄',1800],
 ['glm_restock','Coding Plan · 可购买','hazard','glm','restock','hazard:coding-plan-soldout：本轮未售罄',1600],
 ['gemini_strike','官方活动 · 罢工','hazard','gemini','strike','hazard:official-event-strike：缺席本轮',2000],
 ['gemini_return','活动结束 · 归队','hazard','gemini','return','hazard:official-event-strike：缺席结束',1800],
 ['manus_followup','连续干活 · 换目标','followup','manus','dash','cast rider：追加物伤，移动到最远敌人',2000],
 ['copilot_guard','捆绑 · 常驻减伤','passive','copilot','guard','passiveStats：常驻减伤',1600],
 ['gemma_stats','开源小杯 · 底力','passive','gemma','stats','passiveStats：攻击和生命加成',1600],
 ['doubao_restore','掺豆包 · 到期还原','reaction','doubao','restore','reskin 与 silence 到期：恢复原棋子',2000]
];
const catalog=rows.map(([key,name,category,owners,recipe,trigger,durationMs])=>({key,name,category,owners:owners==='*'?'*':owners.split(','),recipe,trigger,durationMs}));
const byKey=new Map(catalog.map(e=>[e.key,e]));
const norm=id=>id.replace(/^ai-/,'');
function list(id){id=norm(id);PixelEffects.theme(id);return catalog.filter(e=>e.owners==='*'||e.owners.includes(id));}
function get(id,key){const e=byKey.get(key);if(!e||!(e.owners==='*'||e.owners.includes(norm(id))))throw Error('Event not supported: '+id+'/'+key);PixelEffects.theme(id);return e;}
function actor(id,key,ageMs){const e=get(id,key),p=ageMs/e.durationMs,active=ageMs>=0&&p<1;const result={id:norm(id),hp:null,opacity:1,offsetX:0};if(!active)return result;
 if(e.recipe==='death'||e.recipe==='legacy')result.hp=p>.15?0:20;
 if(['ban','strike'].includes(e.recipe))result.opacity=Math.max(.08,1-Math.max(0,p-.4)*2);
 if(['revive','return'].includes(e.recipe))result.opacity=Math.min(1,p*3);
 if(e.recipe==='transform')result.id=p<.45?'gpt':'codex';
 if(e.recipe==='restore')result.id=p<.55?'doubao':'musespark';
 return result;
}
const square=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h);};
function line(g,x,y,a,b,c,w=1){const n=Math.ceil(Math.max(Math.abs(a-x),Math.abs(b-y)));for(let i=0;i<=n;i++){const p=n?i/n:0;square(g,x+(a-x)*p,y+(b-y)*p,w,w,c);}}
const glyphs={I:['111','010','010','010','111'],P:['110','101','110','100','100'],B:['110','101','110','101','110'],A:['010','101','111','101','101'],N:['101','111','111','111','101'],O:['111','101','101','101','111'],F:['111','100','110','100','100'],Z:['111','001','010','100','111'],'+':['000','010','111','010','000'],'-':['000','000','111','000','000'],'1':['010','110','010','010','111']};
function label(g,str,y,t){const width=str.length*4-1;square(g,-width/2-3,y-3,width+6,11,t.dark);[...str].forEach((ch,i)=>(glyphs[ch]||glyphs.I).forEach((row,j)=>[...row].forEach((bit,k)=>{if(bit==='1')square(g,-width/2+i*4+k,y+j,1,1,t.light);})));}
function drawLocal(g,id,key,{x=0,y=0,scale=1,ageMs=0,stacks=3,reducedMotion=false}={}){
 const e=get(id,key);if(!Number.isFinite(ageMs)||ageMs<0||ageMs>=e.durationMs)return null;
 const t=PixelEffects.theme(id),p=ageMs/e.durationMs,q=reducedMotion?.5:p;
 g.save();g.translate(Math.round(x),Math.round(y));g.scale(scale,scale);g.imageSmoothingEnabled=false;
 const token=(symbol,x=0,y=0)=>PixelSkills.drawToken(g,id,symbol,{x,y,progress:p});
 const aura=()=>PixelEffects.drawLocal(g,id,'aura',{progress:q,scale:1,reducedMotion});
 const ray=(r,count=8)=>{for(let i=0;i<count;i++){const a=i*Math.PI*2/count;line(g,Math.cos(a)*r,Math.sin(a)*r,Math.cos(a)*(r+4),Math.sin(a)*(r+4),t.main,2);}};
 const recipe=e.recipe;
 if(recipe==='impact')PixelEffects.drawLocal(g,id,'impact',{progress:p,scale:.85,reducedMotion});
 else if(['heal','regen'].includes(recipe)){token('heal',0,8-q*18);if(recipe==='regen'){token('heal',-13,12-(q+.3)%1*14);token('heal',13,12-(q+.6)%1*14);}}
 else if(['shield','guard','immune'].includes(recipe)){aura();token(recipe==='immune'?'immune':'shield',0,-22);if(recipe==='immune'){line(g,-22,8,-13,-1,t.light,2);line(g,13,1,22,-8,t.light,2);}}
 else if(recipe==='break'||recipe==='expire'){g.globalAlpha*=1-p*.9;for(let i=0;i<8;i++){const a=i*Math.PI/4,r=18+q*11;line(g,Math.cos(a)*r,Math.sin(a)*r,Math.cos(a+.25)*r,Math.sin(a+.25)*r,t.dark,3);line(g,Math.cos(a)*r,Math.sin(a)*r,Math.cos(a+.25)*r,Math.sin(a+.25)*r,t.main,1);}if(recipe==='break'){line(g,-4,-15,3,-4,t.light,2);line(g,3,-4,-3,9,t.light,2);}}
 else if(recipe==='silence')token('silence',0,-18);
 else if(recipe==='stun'){for(let i=0;i<3;i++){const a=i*Math.PI*2/3+q*4,cx=Math.cos(a)*15,cy=-22+Math.sin(a)*4;square(g,cx-2,cy,5,1,t.main);square(g,cx,cy-2,1,5,t.light);}}
 else if(recipe==='death'){for(let i=0;i<12;i++){const a=i*2.4,r=4+q*20;square(g,Math.cos(a)*r,12+q*12+Math.sin(a)*5,2,2,i%2?t.main:t.dark);}line(g,-15,23,15,23,t.dark);}
 else if(['revive','return'].includes(recipe)){for(let i=0;i<5;i++)line(g,-16+i*8,22,-16+i*8,22-q*30,t.main,1);token('heal',0,-20);if(recipe==='return')label(g,'ON',5,t);}
 else if(recipe==='scan'){token('frame');line(g,-19,-15+q*30,19,-15+q*30,t.light,2);for(let i=0;i<3;i++){square(g,-21+i*18,25,6,4,t.main);}label(g,'IP',-29,t);}
 else if(recipe==='pass'){token('immune');label(g,'IP',-25,t);}
 else if(recipe==='ban'){token('frame');line(g,-15,-13,15,13,t.main,3);line(g,15,-13,-15,13,t.main,3);label(g,'BAN',-27,t);square(g,-8,21,16,9,t.dark);square(g,-5,18,10,5,t.main);}
 else if(recipe==='crown'){for(let i=-1;i<=1;i++){const cx=i*12;square(g,cx-3,-24,7,2,t.main);square(g,cx,-27,1,8,t.light);}token('immune');}
 else if(recipe==='transform'){token('frame');line(g,-22,-22+q*44,22,-22+q*44,t.light,2);token('attack',-18,26);token('speed',0,26);token('armor',18,26);}
 else if(recipe==='rage'){const n=Math.max(1,Math.min(6,Math.round(stacks)));for(let i=0;i<6;i++){square(g,-23+i*8,16,5,9,t.dark);if(i<n)square(g,-23+i*8,16,5,9,t.main);}token('page',0,-18);for(let i=0;i<n;i++)square(g,-20+i*8,-8-q*12,2,2,t.light);}
 else if(recipe==='comeback'){ray(17+q*10);token('attack',-17,-12);token('speed',17,-12);token('heal',0,12);}
 else if(recipe==='steal'){for(let i=0;i<5;i++)square(g,25-i*9-q*5,0,3,2,t.main);token('attack',-18,-17);}
 else if(recipe==='legacy'){ray(8+q*16,6);token('attack',0,-22);}
 else if(recipe==='priceUp'||recipe==='priceDown'){label(g,recipe==='priceUp'?'+1':'-1',-5,t);const sign=recipe==='priceUp'?1:-1;line(g,17,10*sign,17,-10*sign,t.main,2);line(g,17,-10*sign,12,-5*sign,t.main,2);line(g,17,-10*sign,22,-5*sign,t.main,2);token('page',-20,12);}
 else if(recipe==='memory'){token('page',-11,0);token('shield',13,0);token('heal',0,-23);}
 else if(recipe==='followup'||recipe==='dash'){for(let i=0;i<3;i++){const o=i*9;line(g,-19+o,15,-8+o,-12,t.dark,3);if(q*3>=i)line(g,-19+o,15,-8+o,-12,t.main,2);}if(recipe==='dash')token('range',0,23);}
 else if(recipe==='soldout'||recipe==='restock'){square(g,-20,-19,40,36,t.dark);square(g,-18,-17,36,6,t.main);for(let i=0;i<3;i++)square(g,-16+i*12,-16,6,5,t.light);label(g,recipe==='soldout'?'OFF':'ON',-3,t);if(recipe==='soldout')line(g,-20,20,20,-15,t.main,2);}
 else if(recipe==='strike'){label(g,'ZZ',-26,t);token('page');line(g,-16,21,16,21,t.main,2);}
 else if(recipe==='stats'){token('attack',-12,0);token('heal',12,0);ray(23,4);}
 else if(recipe==='restore'){token('frame');g.globalAlpha*=1-p;token('silence',0,-24);line(g,-20,15-q*30,20,15-q*30,t.light,2);}
 g.restore();return e;
}
function draw(g,id,key,{source={x:0,y:0},allies=[],foes=[],scale=2,ageMs=0,stacks=3,reducedMotion=false}={}){
 const e=drawLocal(g,id,key,{...source,scale,ageMs,stacks,reducedMotion});if(!e)return null;
 g.save();const t=PixelEffects.theme(id),p=ageMs/e.durationMs;
 if(e.recipe==='legacy')for(const pt of allies){line(g,source.x,source.y,source.x+(pt.x-source.x)*p,source.y+(pt.y-source.y)*p,t.main,2);if(p>.5)PixelSkills.drawToken(g,id,'attack',{...pt,scale:1.5});}
 if(e.recipe==='steal'&&foes[0]){const pt=foes[0];for(let i=0;i<4;i++){const q=(p+i*.2)%1;square(g,pt.x+(source.x-pt.x)*q,pt.y+(source.y-pt.y)*q,4,3,t.main);}}
 if(e.recipe==='followup'||e.recipe==='dash')for(const [i,pt]of foes.slice(0,2).entries()){if(p>i*.3)PixelEffects.drawLocal(g,id,'impact',{...pt,scale:1,progress:(p-i*.3)/(.99-i*.3),reducedMotion});if(e.recipe==='dash'){line(g,source.x,source.y,pt.x,pt.y,t.main,1);PixelSkills.drawToken(g,id,'frame',{...pt,scale:1.5});}}
 g.restore();return e;
}
return {catalog,list,get,actor,drawLocal,draw};
})();
