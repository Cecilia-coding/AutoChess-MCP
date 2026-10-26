import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { buildCompanionPrompt } from './companion-prompt';
import { runCursor } from './cursor';
import { requestValidRoomPlan } from './room-plan';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type { RoomStore } from './room-store';
import type { RoomCredentials, RoomView } from './room-types';
import type { CompanionSnapshot } from './companion-prompt';

/** Local adapter calls the actual MCP endpoint; it never mutates seat state directly. */
export class RoomCursor {
  private running = new Map<string, AbortController>();
  constructor(private store: RoomStore, private url: string) {}
  abort(roomId: string) { this.running.get(roomId)?.abort(); }
  stop(host: RoomCredentials) { this.store.invite(host); this.abort(host.roomId); this.store.cursorState(host,false,'已暂停，可继续'); }
  start(host: RoomCredentials) {
    this.store.invite(host);
    if (this.store.view(host).phase === 'finished') throw new Error('棋局已经结束');
    if (this.running.has(host.roomId) && !this.running.get(host.roomId)!.signal.aborted) return;
    const controller = new AbortController(); this.running.set(host.roomId,controller);
    this.store.cursorState(host,true,'正在通过 MCP 入座');
    void this.loop(host,controller).finally(() => { if(this.running.get(host.roomId)===controller)this.running.delete(host.roomId); });
  }
  private async loop(host: RoomCredentials, controller: AbortController) {
    const client = new Client({name:'autochess-cursor-adapter',version:'0.1.0'});
    controller.signal.addEventListener('abort',()=>{void client.close();},{once:true});
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(this.url)));
      const call = async (name:string,args:Record<string,unknown>) => {
        controller.signal.throwIfAborted();
        const response = await client.callTool({name,arguments:{...args,...(['read_turn','wait_turn','draft_action','submit_turn'].includes(name)?{verbose:true}:{})}});
        const item = (response.content as {type:string;text?:string}[]).find(c=>c.type==='text');
        const data = JSON.parse(item?.text ?? '{}'); if(response.isError) throw new Error(data.error ?? 'MCP操作失败'); return data;
      };
      const invitation = this.store.invite(host).invitation;
      const credentials = await call('join_room',{invitation,name:'Cursor · Composer',joinKey:`cursor-${host.token}`}) as RoomCredentials;
      let view = await call('read_turn',credentials) as RoomView & {modelSnapshot:CompanionSnapshot};
      while(!controller.signal.aborted && view.phase !== 'finished') {
        if(view.self!.ready || view.phase==='waiting') {
          view = await call('wait_turn',{...credentials,after:view.revision}); continue;
        }
        while(view.self!.draft) {
          view = await call('draft_action',{...credentials,round:view.round,revision:view.self!.revision,requestId:randomUUID(),kind:'roll_and_claim'});
        }
        this.store.cursorState(host,true,`正在思考第 ${view.round} 轮`);
        const attempts: {attempt:number;raw:string;reason:string}[]=[];
        const plan = await requestValidRoomPlan(view,buildCompanionPrompt(view.modelSnapshot),async prompt=>{
          controller.signal.throwIfAborted();
          return (await runCursor(prompt,controller.signal)).response;
        },(attempt,raw,reason)=>{
          attempts.push({attempt,raw,reason});
          const directory=join(this.store.directory,'decisions');mkdirSync(directory,{recursive:true});
          writeFileSync(join(directory,`${view.id}-${view.round}.json`),JSON.stringify({round:view.round,snapshot:view.modelSnapshot,attempts},null,2));
          if(reason&&attempt===1)this.store.cursorState(host,true,`正在修正第 ${view.round} 轮计划（最多一次）`);
        });
        controller.signal.throwIfAborted();
        view = await call('submit_turn',{...credentials,round:view.round,revision:view.self!.revision,requestId:randomUUID(),plan});
        if(view.phase!=='finished') this.store.cursorState(host,true,`第 ${view.self!.ready ? view.round : view.round-1} 轮已就绪`);
      }
    } catch(e) {
      if(!controller.signal.aborted) this.store.cursorState(host,false,e instanceof Error?e.message:'连接失败，可继续');
    } finally { await client.close().catch(()=>{}); }
  }
}
