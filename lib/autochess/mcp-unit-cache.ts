import {createHash} from 'node:crypto';
import {packRoster} from '../../packs/registry';
import {autochessCostOf} from '../../content/autochess/units';

// Public reference-material receipt, not an identity/session credential. A caller
// echoes it only while retaining those definitions; omission safely starts over.
const catalogs=new Map<string,{ids:string[];version:string}>();
function catalog(pack:string){
  let cached=catalogs.get(pack);
  if(!cached){
    const rows=packRoster(pack).map(u=>[u.id,u.name,autochessCostOf(u),u.role,[...u.factions,...u.jobs],u.skillNote]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    cached={ids:rows.map(row=>String(row[0])),version:createHash('sha256').update(JSON.stringify([pack,rows])).digest('hex').slice(0,16)};
    catalogs.set(pack,cached);
  }
  return cached;
}

export function unitCacheReply(pack:string,definitions:Record<string,unknown>,receipt?:string,full=false){
  const {ids,version}=catalog(pack),size=Math.ceil(ids.length/8);
  const parts=receipt?.split('.');
  const bytes=parts?.length===3&&parts[0]==='u1'&&parts[1]===version&&/^[A-Za-z0-9_-]+$/.test(parts[2])?Buffer.from(parts[2],'base64url'):undefined;
  const valid=bytes?.length===size&&bytes.toString('base64url')===parts?.[2];
  const known=valid?bytes!:Buffer.alloc(size),fresh:Record<string,unknown>={};
  for(const [id,definition] of Object.entries(definitions)){
    const index=ids.indexOf(id),mask=1<<(index%8);
    if(full||index<0||!(known[Math.floor(index/8)]&mask))fresh[id]=definition;
    if(index>=0)known[Math.floor(index/8)]|=mask;
  }
  return {units:Object.keys(fresh).length?fresh:undefined,unitCache:`u1.${version}.${known.toString('base64url')}`,unitDetails:full||!valid?'full':'new_only'};
}
