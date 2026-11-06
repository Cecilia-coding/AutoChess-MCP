'use strict';
// All artwork is rendered on a 24×24 grid; bodies and faces are separate from feet.
window.Mascots=(()=>{
const ink='#221e25',white='#fff4dc';
const definitions=[
['claude','Claude','#e88743','melee'],['gpt','GPT','#d9e0db','support'],['codex','Codex','#f4f4ef','ranged'],['deepseek','DeepSeek','#527cff','caster'],['gemini','Gemini','#9970f4','caster'],['grok','Grok','#747d88','melee'],['kimi','Kimi','#487fff','ranged'],['qwen','Qwen','#ad70e8','caster'],['glm','GLM','#4785ff','caster'],['minimax','MiniMax','#ff8d55','caster'],['characterai','Character.AI','#d6d3cd','support'],['replika','Replika','#d7a9e9','support'],['talkie','Talkie','#ffc247','ranged'],['xiaoice','Xiaoice','#9ae9ee','support'],['doubao','豆包','#f04a45','caster'],['llama','Llama','#a68af3','ranged'],['mistral','Mistral','#f69532','ranged'],['copilot','Copilot','#5ac9e8','support'],['ernie','ERNIE','#8d7cf3','caster'],['hunyuan','Hunyuan','#71e2a4','caster'],['musespark','Muse','#e2ccaa','ranged'],['nai','Nai','#a56ae0','caster'],['tripo','Tripo','#67dfc4','caster'],['manus','Manus','#faf0d9','melee'],['kiro','Kiro','#ba81ec','melee'],['jimeng','即梦','#ee60c7','caster'],['gemma','Gemma','#75cce4','caster'],['kling','Kling','#b9f43f','caster'],['ollama','Ollama','#f4e6ce','support']];
const units=definitions.map(([id,name,color,role])=>({id,name,color,role}));
const source={"flower": [".......a........", ".....a.a..a.....", "..a..a.a..a..a..", "...a..aa.a..a...", "....a.aaa.aa....", ".aa..aaaaa....aa", "...aaaaaaaaaaa..", "....aaaaaaa.....", "aaaa.aaaaaaaaaa.", "....aaaaaa.a....", "...a..a.aa..aaa.", "..a...a.a.a....a", ".....a...a.a....", ".....a...a......", ".....a....a.....", "....rr....rr...."], "gpt": [".....kkkk.......", "....kwwwwkkkk...", "...kwwwkkwwwwk..", "..kkwkkwwwkwwkk.", ".kwkwkwwkkwkwwk.", "kwwkwkwkkwwwkkk.", "kwwkwkkwwkkwwwk.", "kwwkwkwwwwkkkwwk", "kwwkkkwwwwkwkwwk", ".kwwwkkwwkkwkwwk", ".kkkwwwkkwkwkwwk", ".kwwkkkwwwkwkwk.", "..kwwwwwwkwwkk..", "..kkwwwkkwwwk...", "...kkkkkwwwk....", "........kkk....."], "codex": ["................", "..kkkkkkkkkkkk..", ".kwwwwwwwwwwwwk.", ".kwkkkkkkkkkkwk.", ".kwkkkkkkkkkkwk.", ".kwkwkkkkkkkkwk.", ".kwkkwkkkkkkkwk.", ".kwkkkwkkkkkkwk.", ".kwkkwkkkkkkkwk.", ".kwkwkkwwwwkkwk.", ".kwkkkkkkkkkkwk.", ".kwkkkkkkkkkkwk.", ".kwwwwwwwwwwwwk.", "..kkkkkkkkkkkk..", ".....k....k.....", "....kk....kk...."]};
function make(unit){
 const c=document.createElement('canvas');c.width=c.height=24;const g=c.getContext('2d');
 const rect=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h)};
 const pix=(x,y,color)=>rect(x,y,1,1,color);
 const ellipse=(cx,cy,rx,ry,color)=>{for(let y=0;y<20;y++)for(let x=0;x<24;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)pix(x,y,color)};
 const line=(x1,y1,x2,y2,color,width=1)=>{let n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));for(let i=0;i<=n;i++)rect(Math.round(x1+(x2-x1)*i/(n||1)),Math.round(y1+(y2-y1)*i/(n||1)),width,width,color)};
 const star=(cx,cy,r,col)=>{for(let y=0;y<20;y++)for(let x=0;x<24;x++)if(Math.sqrt(Math.abs(x-cx))+Math.sqrt(Math.abs(y-cy))<=Math.sqrt(r))pix(x,y,col)};
 const ring=(cx,cy,r,col)=>{ellipse(cx,cy,r,r,col);ellipse(cx,cy,r-2,r-2,ink)};
 let face={x:12,y:10,color:ink,back:null};let feet=unit.color;
 const outlineCircle=(col,rx=9,ry=8)=>{ellipse(12,10,rx+1,ry+1,ink);ellipse(12,10,rx,ry,col)};
 switch(unit.id){
 case 'doubao':
 ellipse(12,10,10,9,ink);ellipse(12,9,9,8,'#543b39');rect(5,10,15,7,'#ffedce');rect(5,8,4,4,'#543b39');rect(8,7,5,3,'#543b39');rect(13,7,5,4,'#543b39');rect(4,10,2,8,'#543b39');rect(19,10,2,8,'#543b39');rect(7,2,3,2,'#6c4b45');rect(12,1,2,3,'#543b39');rect(6,17,14,2,'#f53b39');rect(18,18,3,2,'#bd292d');rect(6,14,2,1,'#f5a4a1');rect(17,14,2,1,'#f5a4a1');face={x:12,y:12,color:ink};feet='#513833';break;
 case 'claude':
 for(const [x,y] of [[12,0],[17,1],[21,4],[22,9],[22,14],[19,17],[14,19],[8,18],[3,16],[1,11],[2,5],[6,1]])line(11,9,x,y,unit.color,1);
 ellipse(11,9,4,4,unit.color);face={x:11,y:8,color:'#773b29'};feet='#c8612e';break;
 case 'gpt': {
 const rows=source.gpt||[];rows.forEach((r,y)=>[...r].forEach((v,x)=>{if(v!=='.')pix(x+4,y+2,v==='k'?'#18191c':'#f4f4ef')}));face={x:12,y:8,color:'#f4f4ef',back:'#18191c'};feet='#18191c';break;}
 case 'codex':rect(3,2,18,17,ink);rect(4,3,16,15,'#f5f5ed');rect(5,4,14,13,ink);line(7,6,10,9,white);line(10,9,7,12,white);rect(12,12,4,1,white);face={x:14,y:6,color:white,small:true};feet=ink;break;
 case 'deepseek':outlineCircle('#3c62ee',8,6);ellipse(11,13,7,3,'#d1edff');line(17,12,22,5,'#3c62ee',2);rect(21,4,3,3,'#3c62ee');rect(10,1,2,4,'#84d7ff');rect(8,1,6,2,'#84d7ff');face={x:10,y:9,color:ink};feet='#3655c6';break;
 case 'gemini':case 'gemma':star(12,10,10,unit.color);star(10,9,7,'#61bce8');face={x:12,y:8,color:ink};feet='#334e9d';if(unit.id==='gemma'){rect(7,1,10,2,ink);rect(10,0,4,2,ink);rect(17,2,1,4,'#efc64d')}break;
 case 'grok':outlineCircle('#343741');line(7,16,18,4,'#f1eee1',2);face={x:9,y:8,color:white,back:'#343741'};feet='#4a515b';break;
 case 'kimi':rect(4,3,17,16,ink);rect(6,5,3,11,white);line(9,11,15,5,white,2);line(9,10,15,15,white,2);rect(6,17,12,1,'#ddd5b4');star(19,3,3,'#578bff');face={x:14,y:12,color:white,back:ink,small:true};feet=ink;break;
 case 'qwen':for(const [x,y] of [[12,5],[7,12],[17,12]]){ring(x,y,5,'#ab72e6')}face={x:12,y:10,color:white,back:'#8e54bd'};feet='#8e54bd';break;
 case 'glm':rect(4,3,16,4,'#3e7af4');line(16,6,5,15,'#3e7af4',4);rect(4,15,16,4,'#3e7af4');face={x:12,y:8,color:ink,back:'#3e7af4'};feet='#244db4';break;
 case 'minimax':for(let i=0;i<3;i++){rect(3+i*6,4+(i%2)*5,3,12-(i%2)*4,i%2?'#ffae4c':'#ef6a58');rect(5+i*6,3+(i%2)*5,4,3,'#ff9352')}face={x:12,y:10,color:ink,back:'#ff9352'};feet='#e77b41';break;
 case 'characterai':outlineCircle('#333337');rect(3,15,4,4,'#333337');rect(6,5,4,1,white);rect(6,6,1,3,white);rect(6,9,4,1,white);rect(12,9,1,1,white);rect(15,5,2,5,white);face={x:12,y:12,color:white};feet=ink;break;
 case 'replika':outlineCircle('#d9b5ef',7,9);rect(8,14,8,3,'#ee87be');rect(10,17,4,2,'#ee87be');face={x:12,y:8,color:ink};feet='#af8bc8';break;
 case 'talkie':outlineCircle('#ffc23e');rect(5,16,3,3,'#ffc23e');rect(17,7,1,6,'#ee6b91');rect(19,5,1,10,'#ee6b91');face={x:10,y:9,color:ink};feet='#d99a28';break;
 case 'xiaoice':for(const [x,y] of [[12,0],[12,19],[3,3],[21,3],[3,17],[21,17]])line(12,10,x,y,'#a2edee',2);ellipse(12,10,5,5,'#a2edee');rect(6,15,13,2,'#3e83e1');rect(16,17,2,3,'#3e83e1');face={x:12,y:8,color:ink};feet='#3567b1';break;
 case 'llama':ring(7,12,5,'#6e9ae9');ring(16,12,5,'#a28ae5');rect(15,2,2,6,'#b29be9');rect(19,2,2,6,'#b29be9');ellipse(18,8,4,4,'#b29be9');face={x:17,y:7,color:ink,small:true};feet='#4667af';break;
 case 'mistral':rect(3,3,5,16,'#e45a36');rect(16,3,5,16,'#e45a36');rect(3,3,5,4,'#ffd54b');rect(16,3,5,4,'#ffd54b');rect(7,7,10,7,'#ff9d2c');rect(10,14,4,2,'#ff9d2c');face={x:12,y:8,color:ink};feet='#963b31';break;
 case 'copilot':rect(5,3,14,4,'#4194eb');rect(3,7,6,8,'#41ccd9');rect(15,7,6,8,'#a46bed');rect(5,15,14,4,'#f0b94f');rect(5,15,5,4,'#b1df43');rect(9,7,6,8,'#fff0c4');face={x:12,y:9,color:ink};feet='#235b59';break;
 case 'ernie':rect(4,3,16,16,'#8575ef');rect(5,18,15,2,white);line(6,12,9,15,white);line(9,15,12,12,white);line(12,12,15,15,white);line(15,15,18,12,white);face={x:12,y:7,color:ink};feet='#6a4bac';break;
 case 'hunyuan':
 // Broad jade yuanbao: shallow top, raised ends, one continuous boat-shaped body.
 rect(8,4,8,1,ink);rect(6,5,12,1,ink);rect(5,6,14,3,ink);rect(7,5,10,1,'#8debd0');rect(6,6,12,3,'#71dfb2');
 rect(1,6,4,3,ink);rect(19,6,4,3,ink);rect(2,7,3,2,'#adf4d8');rect(19,7,3,2,'#adf4d8');
 for(let y=9;y<=18;y++){const inset=Math.floor((y-9)/3),x=1+inset,w=22-inset*2;rect(x,y,w,1,ink);rect(x+1,y,w-2,1,y<14?'#65ddb1':'#21a875');}
 rect(5,18,14,1,ink);rect(4,9,16,1,'#a3f1d4');rect(4,10,2,2,'#defbe8');
 face={x:12,y:11,color:'#174634'};feet='#18885f';break;
 case 'musespark':
 // Muse: beige plush bean from the user's reference; empty hands, no heart/prop.
 ellipse(12,10,8,10,'#bca487');ellipse(12,9,7,9,'#e4d1af');
 ellipse(12,15,9,6,'#bca487');ellipse(12,14,8,6,'#dcc5a1');
 rect(7,2,10,2,'#edddbd');rect(5,5,2,6,'#edddbd');
 ellipse(12,7,6,5,'#c9ac86');ellipse(12,7,5,4,'#f8e7bd');
 rect(7,7,10,3,'#f8e7bd');rect(7,9,2,1,'#e9b5a0');rect(16,9,2,1,'#e9b5a0');
 ellipse(6,14,3,4,'#c7af8e');ellipse(6,13,2,3,'#e7d4b3');
 ellipse(18,14,3,4,'#c7af8e');ellipse(18,13,2,3,'#e7d4b3');
 rect(9,18,6,1,'#e5d0ad');face={x:12,y:6,color:'#302820'};feet='#c9b18e';break;
 case 'nai':rect(3,5,18,14,'#9a5ac8');rect(4,17,17,2,'#f0e2b4');rect(11,5,1,13,'#633482');line(17,10,22,1,white,2);face={x:10,y:9,color:ink};feet='#8445aa';break;
 case 'tripo':rect(4,6,16,13,'#42c4ac');for(let y=1;y<7;y++)rect(12-y,y,y*2,1,'#8cf1d7');rect(12,7,8,12,'#25ad9a');line(4,6,12,9,ink);line(12,9,20,6,ink);line(12,9,12,19,ink);face={x:12,y:11,color:ink};feet='#227a70';break;
 case 'manus':rect(5,9,15,8,'#f4ecdf');for(let i=0;i<4;i++)rect(6+i*4,2+Math.abs(1-i),2,9,'#f4ecdf');rect(2,8,4,6,'#f4ecdf');rect(6,17,13,3,ink);face={x:12,y:10,color:ink};feet=ink;break;
 case 'kiro':outlineCircle('#bb83e9',8,8);rect(3,12,18,5,'#bb83e9');rect(1,15,4,3,'#bb83e9');rect(19,15,4,3,'#bb83e9');face={x:12,y:8,color:ink};feet='#9161bb';break;
 case 'jimeng':ellipse(8,11,6,7,'#53c5ea');ellipse(16,11,6,7,'#ed61c3');rect(8,8,8,6,'#24516c');face={x:12,y:8,color:white};feet='#9141a8';break;
 case 'kling':rect(3,3,4,16,'#b1eb41');line(7,11,14,3,'#b1eb41',3);line(7,11,14,16,'#b1eb41',3);rect(14,5,7,12,'#91c934');rect(15,8,4,5,ink);face={x:12,y:9,color:white,back:ink};feet=ink;break;
 case 'ollama':rect(6,0,3,10,'#f1e2c7');rect(15,0,3,10,'#f1e2c7');rect(7,2,1,5,'#e6aba2');rect(16,2,1,5,'#e6aba2');ellipse(12,13,8,6,'#f1e2c7');face={x:12,y:10,color:ink};feet=ink;break;
 }
 return {...unit,body:c,face,feet};
}
return {units:units.map(make)};
})();
