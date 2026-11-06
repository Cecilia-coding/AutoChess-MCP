'use strict';
// Stateless canvas renderer. Load mascots.js first; no DOM controls or combat timers required.
window.PixelMascots=(()=>{
const byId=new Map(Mascots.units.map(u=>[u.id,u]));
const emotion=(hp,t=0,shock=0)=>hp<=0?'dead':t<shock?'shock':hp<=20?'cry':hp<=50?'serious':'happy';
function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h)}
function text(g,str,x,y,color,size=10){g.fillStyle=color;g.font=`${size}px monospace`;g.textAlign='center';g.fillText(str,Math.round(x),Math.round(y));}
function gait(t){const frame=Math.floor(t/115)%4;return [[-2,2,0,-1],[0,0,-1,0],[2,-2,-1,0],[0,0,0,-1]][frame];}
function drawFace(g,u,mood,t){const f=u.face,x=f.x,y=f.y,c=f.color;if(f.back)rect(g,x-4,y-2,9,8,f.back);const d=f.small?2:3;
 if(mood==='dead'){for(const a of [-d,d]){rect(g,x+a-1,y,1,1,c);rect(g,x+a+1,y,1,1,c);rect(g,x+a,y+1,1,1,c);rect(g,x+a-1,y+2,1,1,c);rect(g,x+a+1,y+2,1,1,c)}rect(g,x-1,y+4,3,1,c);return;}
 if(mood==='happy'){for(const a of [-d,d]){rect(g,x+a-1,y+1,1,1,c);rect(g,x+a,y,1,1,c);rect(g,x+a+1,y+1,1,1,c)}rect(g,x-2,y+3,1,1,c);rect(g,x+2,y+3,1,1,c);rect(g,x-1,y+4,3,1,c);}
 else if(mood==='shock'){
  // Hollow comic eyes: dark rims and white centers, even on white-face characters.
  for(const a of [-d,d]){rect(g,x+a-1,y-2,3,4,'#25232d');rect(g,x+a,y-1,1,2,'#ffffff');}
  rect(g,x-1,y+3,3,3,'#25232d');rect(g,x,y+4,1,1,'#fff1d4');
 }
 else if(mood==='cry'){for(const a of [-d,d]){rect(g,x+a-1,y,3,1,c);rect(g,x+a,y+1,1,2,'#80cde7');rect(g,x+a,y+3+Math.floor(t/180)%3,1,2,'#80cde7')}rect(g,x-1,y+3,3,1,c);rect(g,x-2,y+4,1,1,c);rect(g,x+2,y+4,1,1,c);}
 else{rect(g,x-d,y,1,2,c);rect(g,x+d,y,1,2,c);rect(g,x-2,y+4,5,1,c);}}
function drawActor(g,u,x,y,scale,t,hp,action='idle',age=9999,shock=0,hitAge=9999,shockAge=9999,reduced=false){
 const mood=emotion(hp,t,shock),walk=action==='walk'&&hp>0,feet=walk?gait(t):[0,0,0,0],bob=walk?Math.abs(feet[0])*.5:!reduced&&hp>0?Math.floor(Math.sin(t/450)*.6):0;
 let dx=0,lean=0,stretch=1;if(age>=0&&age<850&&hp>0){if(age<220){dx=-Math.floor(age/55);lean=-.08;}else if(age<440){dx=Math.round(6*Math.sin((age-220)/220*Math.PI/2));lean=.12;}else{dx=Math.round(6*(1-(age-440)/410));}stretch=age<220?.94:1;}
 if(mood==='shock'&&!reduced){if(shockAge<220)dx+=Math.round(Math.sin(shockAge/22)*1.8*(1-shockAge/220));if(shockAge<300)y-=Math.round(Math.sin(shockAge/300*Math.PI)*scale*2);}
 if(hitAge>=0&&hitAge<240&&!reduced){dx-=Math.round(Math.sin(hitAge/240*Math.PI)*3);lean=-.12;}
 g.save();g.translate(Math.round(x+dx*scale),Math.round(y));g.scale(scale,scale);g.imageSmoothingEnabled=false;
 if(hp<=0){g.translate(11,20);g.rotate(Math.PI/2);g.translate(-11,-20);}
 rect(g,7+feet[0],19+feet[2],2,4,u.feet);rect(g,6+feet[0],22+feet[2],4,2,u.feet);rect(g,15+feet[1],19+feet[3],2,4,u.feet);rect(g,15+feet[1],22+feet[3],4,2,u.feet);
 g.translate(12,19-bob);g.rotate(reduced?0:lean);g.scale(1,stretch);g.translate(-12,-19);g.drawImage(u.body,0,0);drawFace(g,u,mood,t);
 if(hitAge>=0&&hitAge<100){g.globalAlpha=.4;g.globalCompositeOperation='source-atop';rect(g,1,0,22,20,'#ffffff');g.globalCompositeOperation='source-over';g.globalAlpha=1;}
 g.restore();return {mood,feet,dx};
}
function shockEffect(ctx,x,y,age,life,reduced){
 const fade=Math.min(1,(life-age)/180),cx=x+48,cy=y+40;
 ctx.save();ctx.globalAlpha=Math.max(0,fade);
 // A localized manga burst; no full-screen flashing or camera shake.
 if(!reduced){const length=age<220?16:9;for(let i=0;i<10;i++){
  const a=(i/10)*Math.PI*2+.1,r=57+(age<160?Math.floor(age/40):4);
  for(let n=0;n<length;n+=2){const px=cx+Math.cos(a)*(r+n),py=cy+Math.sin(a)*(r+n)*.64;rect(ctx,px+1,py+1,2,2,'#122e28');rect(ctx,px,py,2,2,'#fff0b5');}
 }}
 const markX=x+101,markY=y+2-(reduced?0:Math.round(Math.max(0,1-age/180)*7));
 rect(ctx,markX-2,markY-2,11,23,'#20352d');rect(ctx,markX,markY,6,13,'#ffe09a');rect(ctx,markX,markY+17,6,4,'#ffe09a');
 // One small blue sweat bead slides down beside the cheek.
 const dropY=y+30+(reduced?0:Math.min(14,Math.floor(age/45)));
 rect(ctx,x+87,dropY,3,3,'#c5f1f7');rect(ctx,x+85,dropY+3,6,7,'#82cddf');
 ctx.restore();
}

function draw(g,id,options={}){
 const u=byId.get(id.replace(/^ai-/,''));if(!u)throw new Error('Unknown mascot: '+id);
 const {x=0,y=0,scale=1,timeMs=0,hp=100,action='idle',attackAgeMs=9999,hitAgeMs=9999,shockAgeMs=9999,shockDurationMs=650,reducedMotion=false,effects=true,shield=false}=options;
 const shocked=shockAgeMs>=0&&shockAgeMs<shockDurationMs&&hp>0;
 const result=drawActor(g,u,x,y,scale,timeMs,hp,action,attackAgeMs,shocked?timeMs+1:0,hitAgeMs,shockAgeMs,reducedMotion);
 if(effects&&shocked){g.save();g.translate(x,y);g.scale(scale/4,scale/4);shockEffect(g,0,0,shockAgeMs,shockDurationMs,reducedMotion);g.restore();}
 if(shield&&hp>0){g.save();g.strokeStyle='#a6ccc3';g.lineWidth=scale/2;g.strokeRect(x-scale*.75,y-scale*1.25,scale*25.5,scale*22.25);g.restore();}
 return result;
}
return {draw,drawActor,shockEffect,drawFace,gait,emotion,rect,text};
})();
