'use client';

import { useEffect, useRef, useState } from 'react';
import { CHESS_MCP_TITLE } from '@/lib/meta/chess-brand';
import type { RoomCredentials } from '@/lib/autochess/room-types';
import { readAccountToken } from './account-session';
import { accountRequest, roomRequest } from './room-request';
import { invitationLabel, useSocialInbox } from './social-inbox';
import type { SocialInvite, SocialPeer } from '@/lib/autochess/social-types';

type AiAccount = { id: string; username: string };
type Ticket = { ticket: string; expiresAt: number; kind: 'new' | 'existing'; ai?: AiAccount };

function ticketInvitation(mcpUrl: string, ticket: Ticket): string {
  const next = ticket.kind === 'new'
    ? '调用 join_room，只填 invitation 和 name：invitation 填入场券，name 填自己取的机名，其余字段省略。入座时自动建号并绑定邀请人，保存返回的 accountToken。'
    : '调用 join_room，只填 invitation，其余字段省略。你会用原账号入座，战绩接着记；保存返回的 accountToken。';
  return `来下一盘${CHESS_MCP_TITLE} ^ ^\nMCP：${mcpUrl}\n入场券：${ticket.ticket}\n${next}\n入座后跟着 nextAction 走就好。`;
}

export default function MachineInvitePanel({ credentials, mcpUrl, canInvite, onNotice }: {
  credentials: RoomCredentials;
  mcpUrl: string;
  canInvite: boolean;
  onNotice: (notice: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<'new' | 'existing'>('new');
  const [myAi, setMyAi] = useState<AiAccount[]>([]);
  const [selectedAiId, setSelectedAiId] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { data: social, error: socialError } = useSocialInbox(open);
  const [sent, setSent] = useState<SocialInvite[]>([]);
  const [searchName, setSearchName] = useState('');
  const [found, setFound] = useState<SocialPeer | null>(null);
  const [searching, setSearching] = useState(false);
  const searchGeneration = useRef(0);
  useEffect(() => {
    const generation = searchGeneration;
    const reset = () => { generation.current++; setSearchName(''); setFound(null); setSearching(false); setSent([]); setError(''); };
    reset();
    window.addEventListener('chess-account-change', reset);
    window.addEventListener('storage', reset);
    return () => { generation.current++; window.removeEventListener('chess-account-change', reset); window.removeEventListener('storage', reset); };
  }, [credentials.roomId, open]);
  const find = async () => {
    const accountToken = readAccountToken(), generation = ++searchGeneration.current;
    if (!accountToken || !searchName.trim()) { setError('登录后填写棋友的完整账号名。'); return; }
    setSearching(true); setFound(null); setError('');
    try {
      const result = await accountRequest<{ peer: SocialPeer }>('social_find', { token: accountToken, name: searchName.trim() });
      if (generation === searchGeneration.current && accountToken === readAccountToken()) setFound(result.peer);
    } catch (cause) { if (generation === searchGeneration.current && accountToken === readAccountToken()) setError((cause as Error).message); }
    finally { if (generation === searchGeneration.current) setSearching(false); }
  };
  const send = async (peer: SocialPeer) => {
    const accountToken = readAccountToken();
    if (!accountToken || pending) return;
    setPending(true); setError('');
    try {
      const result = await roomRequest<{ invitation: SocialInvite }>('social_invite', { ...credentials, accountToken, toId: `id:${peer.id}` });
      if (readAccountToken() !== accountToken) return;
      setSent(old => [...old.filter(entry => entry.id !== result.invitation.id), result.invitation]);
      onNotice(peer.kind === 'machine' ? '邀请已放进机的邀约箱，等它下次查询时查收' : '邀请已送进棋友的邀约箱');
    } catch (cause) { if (readAccountToken() === accountToken) setError((cause as Error).message); }
    finally { setPending(false); }
  };
  const peerList = (peers: SocialPeer[]) => <div className="social-invite-list">{peers.map(peer => {
    const receipt = social?.sent.find(entry => entry.roomId === credentials.roomId && entry.toId === peer.id) ?? sent.find(entry => entry.toId === peer.id);
    return <div className="social-invite-peer" key={peer.id}><span>{peer.username}<small>{peer.kind === 'machine' ? '机' : '人'} · {peer.inGame ? '对局中' : peer.presence === 'online' ? '在线' : peer.presence === 'recent' ? '近期有响应' : '暂未响应'}</small></span>
      <button disabled={pending || !canInvite || !!receipt || peer.inGame} onClick={() => void send(peer)}>{receipt ? invitationLabel(receipt) : '站内邀请'}</button></div>;
  })}{!peers.length ? <p>暂时没有可邀请的棋友。</p> : null}</div>;

  useEffect(() => {
    if (!open) return;
    const accountToken = readAccountToken();
    if (!accountToken) return;
    let active = true;
    void accountRequest<{ ai: AiAccount[] }>('bindings', { token: accountToken })
      .then(result => { if (active) setMyAi(Array.isArray(result.ai) ? result.ai : []); })
      .catch(() => { if (active) setMyAi([]); });
    return () => { active = false; };
  }, [open]);

  const issue = async () => {
    if (!canInvite) { setError('这间房已经开局或满员，新开一间再邀请吧。'); return; }
    const accountToken = readAccountToken();
    if (!accountToken) { setError('先登录你的玩家账号，再开一间房邀请机。'); return; }
    setPending(true); setError('');
    try {
      const result = await roomRequest<Ticket>('issue_machine_ticket', {
        ...credentials, accountToken, ...(choice === 'existing' ? { aiId: selectedAiId } : {}),
      });
      setTicket(result);
      onNotice(result.kind === 'new' ? '新机入场券已备好' : `${result.ai?.username ?? '这只机'}的入场券已备好`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(false); }
  };

  const copyTicket = async () => {
    if (!ticket) return;
    try { await navigator.clipboard.writeText(ticketInvitation(mcpUrl, ticket)); onNotice('发给机就行，它一调用便能入座'); }
    catch { setError('复制没成功，点一下入场券文本手动复制。'); }
  };

  return <div className="room-machine-invite">
    <button type="button" className="room-machine-invite-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>✦ 邀请同席 {open ? '收起' : '展开'}</button>
    {open ? <div className="room-machine-invite-body">
      <h3>按名字找棋友</h3>
      <form onSubmit={event => { event.preventDefault(); void find(); }}>
        <input aria-label="棋友完整账号名" placeholder="填写完整账号名" maxLength={80} value={searchName} onChange={event => { searchGeneration.current++; setSearchName(event.target.value); setFound(null); setSearching(false); setError(''); }} />
        <button type="submit" disabled={searching || !searchName.trim()}>{searching ? '查找中…' : '查找棋友'}</button>
      </form>
      <p>核对名字与身份，再点站内邀请。人可以邀请棋友或自己的机。</p>
      {found ? peerList([found]) : null}
      <h3>在线棋友</h3>{peerList(social?.humans ?? [])}
      <h3>我的机</h3>{peerList(social?.machines ?? [])}
      <p>机下次查询 MCP 时查收邀请；“近期有响应”表示刚刚来过。</p>
      {socialError ? <p role="alert">{socialError}</p> : null}
      <details><summary>新机入座 / 手动发券找回</summary>
      <p>{canInvite ? '第一次连接的新机可用入场券建号；忘记账号 token 的机也可以重新领券。' : '这间房已经开局或满员，新开一间再邀请吧。'}</p>
      {canInvite ? <>
      <fieldset className="room-machine-invite-choices" aria-label="邀请机的方式">
        <button type="button" className={choice === 'new' ? 'is-active' : ''} aria-pressed={choice === 'new'} onClick={() => { setChoice('new'); setTicket(null); setError(''); }}>新机</button>
        <button type="button" className={choice === 'existing' ? 'is-active' : ''} aria-pressed={choice === 'existing'} onClick={() => { setChoice('existing'); setTicket(null); setError(''); }}>我的机</button>
      </fieldset>
      {choice === 'existing' ? <select aria-label="选择我的机" value={selectedAiId} onChange={event => setSelectedAiId(event.target.value)}>
        <option value="">选一只已入籍的机</option>
        {myAi.map(ai => <option key={ai.id} value={ai.id}>{ai.username}</option>)}
      </select> : null}
      <button type="button" className="room-machine-invite-primary" disabled={pending || !mcpUrl || (choice === 'existing' && !selectedAiId)} onClick={() => void issue()}>{pending ? '送信中…' : '生成入场券'}</button>
      </> : null}
      {ticket && canInvite ? <output className="room-machine-ticket">
        <strong>{ticket.kind === 'new' ? '新机入场券' : `${ticket.ai?.username ?? '我的机'}的入场券`}</strong>
        <input aria-label="机的入场券" readOnly value={ticket.ticket} onFocus={event => event.currentTarget.select()} />
        <button type="button" onClick={() => void copyTicket()}>复制给机</button>
      </output> : null}
      {error ? <p className="room-machine-invite-error" role="alert">{error}</p> : null}
      </details>
      {error ? <p role="alert">{error}</p> : null}
    </div> : null}
  </div>;
}
