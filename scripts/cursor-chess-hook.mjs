import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const URL=process.env.CHESS_HOOK_MCP_URL||'http://127.0.0.1:8791/mcp';
const URLS=new Set([URL,'http://127.0.0.1:8791/mcp']);
const root=process.env.CHESS_HOOK_STATE_DIR||join(homedir(),'.cursor','chess-wake');
const parse=x=>typeof x==='string'?JSON.parse(x.replace(/^\uFEFF/,'')):x;
const payload=x=>{x=parse(x);if(x?.result)x=x.result;if(x?.content)x=JSON.parse(x.content.find(c=>c.type==='text')?.text||'{}');return x;};
export async function handle(input,{call=rpc,waitMs=150_000}={}){
  if(typeof input.conversation_id!=='string'||!input.conversation_id)return {};
  mkdirSync(root,{recursive:true});const file=join(root,createHash('sha256').update(input.conversation_id).digest('hex')+'.json');
  let state;try{state=JSON.parse(readFileSync(file,'utf8'));}catch{}
  const save=s=>{const temp=file+'.'+randomUUID()+'.pending';writeFileSync(temp,JSON.stringify(s),{mode:0o600});renameSync(temp,file);};
  if(input.hook_event_name==='afterMCPExecution'){
    if(!URLS.has(input.mcp_server_url?.split('?')[0]))return {};
    const args=parse(input.tool_input||'{}');const result=payload(input.result_json||'{}');
    const auth=result?.roomId&&result?.token?result:args;
    if(!/^[a-f0-9]{12}$/.test(auth.roomId||'')||typeof auth.token!=='string'||auth.token.length<20)return {};
    const turn=result.current??result.turn??result;
    const unitCache=typeof turn.unitCache==='string'&&turn.unitCache.length<=256?turn.unitCache:state?.roomId===auth.roomId?state.unitCache:undefined;
    save({roomId:auth.roomId,token:auth.token,enabled:turn.phase!=='finished'&&turn.modelSnapshot?.hp!==0&&turn.self?.hp!==0,url:input.mcp_server_url,unitCache,units:args.units??(state?.roomId===auth.roomId?state.units:undefined),afterEvent:state?.roomId===auth.roomId?state.afterEvent:undefined});return {};
  }
  if(!state?.enabled)return {};
  if(input.hook_event_name==='sessionEnd'||input.status==='aborted'||input.status==='error') {save({...state,enabled:false});return {};}
  if(input.hook_event_name!=='stop'||input.status!=='completed'||(input.loop_count??0)>=40)return {};
  const lock=file+'.lock';try{mkdirSync(lock);}catch{return {};}
  try{
    const until=Date.now()+waitMs;
    while(Date.now()<until){
      const reply=await call('wait_for_wake',{roomId:state.roomId,token:state.token,...(state.unitCache?{unitCache:state.unitCache}:{}),...(state.units&&!(state.unitCache&&state.units==='current')?{units:state.units}:{}),...(state.afterEvent?{afterEvent:state.afterEvent}:{})},state.url?.includes('profile=player')?state.url.replace('profile=player','profile=adapter'):state.url);
      if(reply.finished&&!reply.event){save({...state,enabled:false});return {};}
      if(!reply.event)continue;
      await call('acknowledge_wake',{roomId:state.roomId,token:state.token,eventId:reply.event.id},state.url?.includes('profile=player')?state.url.replace('profile=player','profile=adapter'):state.url);
      const turn=reply.turn;
      const snapshot=turn?.id===state.roomId&&turn.round===reply.event.round&&turn.self?.revision===reply.event.revision&&turn.nextAction&&turn.modelSnapshot
        ?JSON.stringify(turn,(key,value)=>['token','joinKey','invitation'].includes(key)?undefined:value):null;
      save({...state,afterEvent:reply.event.id,enabled:!reply.finished,unitCache:snapshot&&typeof turn.unitCache==='string'&&turn.unitCache.length<=256?turn.unitCache:state.unitCache});
      if(reply.finished)return {followup_message:`这局结束啦。看看最终战报，跟玩家聊一句这场；想把话留在棋室，就用 ${state.url?.includes('profile=player')?'act':'prepare_turn'} kind=say。${snapshot?'\n<chess-state>\n'+snapshot+'\n</chess-state>':'先用 read_turn 看最终结果。'}`};
      return {followup_message:`第 ${reply.event.round} 轮到你了。${snapshot?'按下方 nextAction 落子':'用已有席位 read_turn，再按 nextAction 落子'}；下完就结束回复，下一轮会再叫你。${snapshot?'\n<chess-state>\n'+snapshot+'\n</chess-state>':''}`};
    }
    return {};
  }finally{rmdirSync(lock);}
}
async function rpc(name,args,url=URL){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw Error('Wake connection failed');const result=await response.json();if(result.error||result.result?.isError)throw Error('Wake request rejected');return payload(result);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{process.stdin.setEncoding('utf8');let text='';for await(const chunk of process.stdin){text+=chunk;if(text.length>512_000)throw Error('Input too large');}process.stdout.write(JSON.stringify(await handle(parse(text))));}
  catch(error){process.stdout.write('{}');const kind=error instanceof SyntaxError?'invalid-json':'execution-failed';process.stderr.write(`Chess wake stopped (${kind}); no automatic retry.\n`);}
}
