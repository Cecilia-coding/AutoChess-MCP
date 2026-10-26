import http from 'node:http';
import {spawn} from 'node:child_process';

// Ports are env-configurable so a second (isolated) instance can coexist on the same host.
// Defaults match the original production layout.
const WEB_PORT = Number(process.env.CHESS_WEB_PORT ?? 8787);
const MCP_PORT = Number(process.env.CHESS_ROOM_PORT ?? process.env.CHESS_MCP_PORT ?? 8791);
const GATEWAY_PORT = Number(process.env.CHESS_GATEWAY_PORT ?? 8792);
const GATEWAY_HOST = process.env.CHESS_GATEWAY_HOST ?? '127.0.0.1';

// Keep the gateway, the web API routes, and the room process on the same
// configured room port. This also makes custom-port deployments predictable.
const childEnv = {
  ...process.env,
  CHESS_ROOM_PORT: String(MCP_PORT),
  // Local one-port runs advertise the gateway instead of the private room/web ports.
  // Public deployments override this with their browser-visible origin.
  CHESS_PUBLIC_ORIGIN: process.env.CHESS_PUBLIC_ORIGIN?.trim() || `http://127.0.0.1:${GATEWAY_PORT}`,
};

// A single container owns the room store. Models connect from their own clients.
const children = [
  spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/chess-room-server.ts'],{stdio:'inherit',env:childEnv}),
  spawn(process.execPath,['node_modules/vinext/dist/cli.js','start','--port',String(WEB_PORT),'--hostname','127.0.0.1'],{stdio:'inherit',env:childEnv}),
];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');server.close();setTimeout(()=>process.exit(code),1500);}
for(const child of children){child.on('exit',()=>stop(1));child.on('error',()=>stop(1));}
process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
const server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'){res.writeHead(302,{Location:'/autochess/room'});res.end();return;}
  const isGet=req.method==='GET'||req.method==='HEAD';
  const mcp=path==='/mcp';
  const room=path==='/api/autochess/room';
  const account=path==='/api/autochess/account'||path==='/api/autochess/meta';
  const feedback=path==='/api/autochess/feedback';
  const health=path==='/health';
  // Publish the chess experience only, including the authenticated, bounded feedback proxy.
  if(!(isGet||mcp||room||account||feedback)){res.writeHead(404);res.end();return;}
  const port=mcp||health?MCP_PORT:WEB_PORT;
  const headers={...req.headers};
  // Web API routes validate the browser Origin against the request Host, so
  // preserve the public gateway Host. The room server only accepts loopback
  // hosts and therefore receives an internal Host for MCP/health traffic.
  if(mcp||health) headers.host=`127.0.0.1:${port}`;
  const upstream=http.request({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers},response=>{
      const headers={...response.headers,'x-content-type-options':'nosniff'};
      // HTML must pick up the current release; missing chunks must never be cached by the CDN.
      if((response.statusCode??502)>=400 || String(headers['content-type']).includes('text/html')) {
        headers['cache-control']='no-store';
        headers['cdn-cache-control']='no-store';
        headers['cloudflare-cdn-cache-control']='no-store';
      }
      res.writeHead(response.statusCode??502,headers);response.pipe(res);
    });
  upstream.setTimeout(65_000,()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end('棋室正在恢复，请稍后重试');});
  req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
});
server.listen(GATEWAY_PORT,GATEWAY_HOST,()=>console.log(`Chess gateway ready on ${GATEWAY_HOST}:${GATEWAY_PORT}`));
