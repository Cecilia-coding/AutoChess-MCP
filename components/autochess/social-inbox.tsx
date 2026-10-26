'use client';
import { useEffect, useRef, useState } from 'react';
import type { SocialInvite, SocialSnapshot } from '@/lib/autochess/social-types';
import type { RoomCredentials } from '@/lib/autochess/room-types';
import { accountRequest } from './room-request';
import { readAccountToken } from './account-session';
import './social-inbox.css';

export function useSocialInbox(enabled = true) {
  const [data, setData] = useState<SocialSnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, sequence = 0, flight = false;
    const refresh = async () => {
      if (flight || stopped || document.hidden) return;
      const token = readAccountToken();
      if (!token) { setData(null); setError(''); return; }
      const request = ++sequence; flight = true;
      try {
        const result = await accountRequest<SocialSnapshot>('social', { token });
        if (!stopped && request === sequence && readAccountToken() === token) { setData(result); setError(''); }
      } catch (cause) { if (!stopped && request === sequence && readAccountToken() === token) { setData(null); setError((cause as Error).message); } }
      finally { flight = false; }
    };
    const changed = () => { sequence++; setData(null); setError(''); void refresh(); };
    const visible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    const timer = setInterval(() => void refresh(), 6000);
    window.addEventListener('chess-account-change', changed); window.addEventListener('storage', changed);
    document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('chess-account-change', changed); window.removeEventListener('storage', changed); document.removeEventListener('visibilitychange', visible); };
  }, [enabled]);
  return { data, error };
}

export function invitationLabel(invite: SocialInvite) {
  return invite.status === 'accepted' ? '已接受' : invite.status === 'declined' ? '已婉拒' : invite.status === 'expired' ? '已失效' : invite.seenAt ? '已查收' : '待查收';
}

type Acceptance = { invitation: SocialInvite; seat?: RoomCredentials; presentation?: { kind: 'direct'; receiptId: string } };
/** Extension point: presentation receives a committed receipt, never performs admission itself. */
export async function presentInvitationAcceptance(_receipt: Acceptance): Promise<void> {}

export default function SocialInbox({ onEnterRoom }: { onEnterRoom: (seat: RoomCredentials) => void }) {
  const { data, error: loadError } = useSocialInbox();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [handled, setHandled] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  useEffect(() => { const reset = () => { setOpen(false); setHandled([]); setError(''); }; window.addEventListener('chess-account-change',reset); window.addEventListener('storage',reset); return () => { window.removeEventListener('chess-account-change',reset); window.removeEventListener('storage',reset); }; }, []);
  const respond = async (invite: SocialInvite, accept: boolean) => {
    if (locked.current) return;
    const token = readAccountToken(); locked.current = true; setBusy(invite.id); setError('');
    try {
      const receipt = await accountRequest<Acceptance>('invitation_respond', { token, inviteId: invite.id, accept });
      if (readAccountToken() !== token) return;
      if (receipt.seat) {
        await presentInvitationAcceptance(receipt);
        if (readAccountToken() !== token) return;
        setOpen(false); onEnterRoom(receipt.seat);
      }
      setHandled(old => [...old, invite.id]);
    } catch (cause) { if (readAccountToken() === token) setError((cause as Error).message); }
    finally { locked.current = false; setBusy(''); }
  };
  const inbox = data?.inbox.filter(invite => !handled.includes(invite.id)) ?? [];
  return <>
    {data ? <button className="social-inbox-toggle" onClick={() => setOpen(true)}>✉ 邀约箱{inbox.length ? ` · ${inbox.length}` : ''}</button> : null}
    <dialog className="social-inbox-dialog" ref={dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header><h2>邀约箱</h2><button aria-label="关闭邀约箱" onClick={() => setOpen(false)}>×</button></header>
      <p>棋友在线 {data?.humans.filter(peer => peer.presence === 'online').length ?? 0} · 我的机 {data?.machines.length ?? 0}</p>
      {data?.currentRoom ? <button onClick={() => { setOpen(false); onEnterRoom(data.currentRoom!); }}>继续我的棋局</button> : null}
      <details><summary>看看谁在</summary>{data?.humans.map(peer => <p key={peer.id}>棋友 · {peer.username} · {peer.inGame ? '对局中' : '在线'}</p>)}{data?.machines.map(peer => <p key={peer.id}>机 · {peer.username} · {peer.inGame ? '对局中' : peer.presence === 'recent' ? '近期有响应' : '暂未响应'}</p>)}<p>开房后，在房间菜单的「邀请同席」直接发邀请。</p></details>
      {(['human','machine'] as const).map(kind => <section key={kind}><h3>{kind === 'human' ? '棋友的邀请' : '机的邀请'}</h3>
        {inbox.filter(invite => invite.fromKind === kind).map(invite => <article key={invite.id}>
          <strong>{invite.fromName}</strong><p>邀你同席 · {invite.packName}</p>
          <div><button disabled={!!busy} onClick={() => void respond(invite,true)}>{busy === invite.id ? '处理中…' : '接受入座'}</button><button disabled={!!busy} onClick={() => void respond(invite,false)}>这次先不了</button></div>
        </article>)}
        {!inbox.some(invite => invite.fromKind === kind) ? <p>暂时没有新的邀请。</p> : null}
      </section>)}
      <details><summary>我发出的邀请</summary>{data?.sent.map(invite => <p key={invite.id}>{invite.toKind === 'machine' ? '机 · ' : '棋友 · '}{invite.toName} · {invitationLabel(invite)}</p>)}</details>
      {error || loadError ? <p role="alert">{error || loadError}</p> : null}
    </dialog>
  </>;
}
