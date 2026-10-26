'use client';
import {useEffect, useRef, useState} from 'react';
import {readAccountToken} from './account-session';
import {accountRequest} from './room-request';

/** Credentials stay in component memory and only arrive after an explicit reveal. */
export default function MachineCredential({ownerToken, aiId, name}: {ownerToken:string;aiId:string;name:string}) {
  const [credential,setCredential]=useState('');
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState('');
  const sequence=useRef(0);
  const inFlight=useRef(false);
  useEffect(()=>{
    const invalidate=()=>{sequence.current++;};
    const conceal=()=>{invalidate();inFlight.current=false;setCredential('');setPending(false);setNotice('');};
    const onVisibility=()=>{if(document.hidden)conceal();};
    window.addEventListener('chess-account-change',conceal);
    window.addEventListener('storage',conceal);
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>{invalidate();window.removeEventListener('chess-account-change',conceal);window.removeEventListener('storage',conceal);document.removeEventListener('visibilitychange',onVisibility);};
  },[ownerToken,aiId]);
  const reveal=async()=>{
    if(inFlight.current || readAccountToken()!==ownerToken)return;
    inFlight.current=true;const request=++sequence.current;setPending(true);setNotice('');
    try {
      const result=await accountRequest<{aiId:string;accountToken:string}>('machine_credential',{token:ownerToken,aiId});
      if(request!==sequence.current || readAccountToken()!==ownerToken)return;
      if(result.aiId!==aiId || !result.accountToken)throw Error('凭证没取到，再试一次');
      setCredential(result.accountToken);
    } catch(error) {if(request===sequence.current && readAccountToken()===ownerToken)setNotice((error as Error).message);}
    finally {if(request===sequence.current){inFlight.current=false;setPending(false);}}
  };
  const copy=async()=>{
    if(readAccountToken()!==ownerToken || !credential)return;
    const request=sequence.current;
    try {await navigator.clipboard.writeText(credential);if(request===sequence.current && readAccountToken()===ownerToken)setNotice('已复制，交给这只机保存就好');}
    catch {if(request===sequence.current && readAccountToken()===ownerToken)setNotice('复制没成功，可以长按凭证复制');}
  };
  return <div style={{flexBasis:'100%',minWidth:0}}>
    {credential && readAccountToken()===ownerToken ? <>
      <div className="lobby-row" style={{flexWrap:'wrap'}}>
        <input aria-label={`${name}的账号 token`} readOnly value={credential} autoComplete="off" spellCheck={false} style={{minWidth:0,maxWidth:'100%',flex:'1 1 180px'}} onFocus={event=>event.currentTarget.select()} />
        <button type="button" onClick={()=>void copy()}>复制 token</button>
        <button type="button" onClick={()=>{sequence.current++;setCredential('');setNotice('');}}>收起</button>
      </div>
      <small>这是它已有的账号凭证，只交给这只机。</small>
    </> : <button type="button" disabled={pending} onClick={()=>void reveal()}>{pending?'获取中…':'点击获取凭证'}</button>}
    {notice?<output className="lobby-hint" style={{display:'block'}}>{notice}</output>:null}
  </div>;
}
