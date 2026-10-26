'use client';
/* eslint-disable @next/next/no-img-element -- Private normalized screenshots use in-memory data URLs, never a public image optimizer. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { readAccountToken } from './account-session';
import { FEEDBACK_KINDS, FEEDBACK_LIMITS, type FeedbackKind } from '@/lib/meta/feedback';
import type { FeedbackEntry } from '@/lib/accounts/feedback-store';
import type { CurrencyId } from '@/lib/meta/economy';
import './feedback.css';

type Listing = { entries: FeedbackEntry[]; total: number; offset: number; canAdmin: boolean; storageBytes?: number; storageLimit?: number };
const subscribe = (callback: () => void) => { window.addEventListener('chess-account-change', callback); window.addEventListener('storage', callback); return () => { window.removeEventListener('chess-account-change', callback); window.removeEventListener('storage', callback); }; };
async function request<T>(token: string, args: object): Promise<T> {
  const res = await fetch('/api/autochess/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(args), cache: 'no-store' });
  const data = await res.json() as T & { error?: string };
  if (!res.ok || data.error) throw Error(data.error || '反馈暂未送达，请重试');
  return data;
}
async function compress(file: File) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) throw Error('请选择12MB以内的JPEG、PNG或WebP截图');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24_000_000) throw Error('截图尺寸太大，请裁剪后再试');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); if (!context) throw Error('浏览器无法处理截图');
    context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for (const quality of [0.82,0.65,0.45]) {
      const image = canvas.toDataURL('image/jpeg', quality);
      if ((image.length - image.indexOf(',') - 1) * 3 / 4 <= FEEDBACK_LIMITS.imageBytes) return image;
    }
    throw Error('截图细节太多，请裁剪后再上传');
  } finally { bitmap.close(); }
}

export default function Feedback({ roomId }: { roomId?: string }) {
  const token = useSyncExternalStore(subscribe, readAccountToken, () => '');
  return <FeedbackPanel key={token} token={token} roomId={roomId} />;
}
function FeedbackPanel({ token, roomId }: { token: string; roomId?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<FeedbackKind>('suggestion');
  const [text, setText] = useState(''); const [images, setImages] = useState<string[]>([]);
  const [requestId, setRequestId] = useState('');
  const [listing, setListing] = useState<Listing>();
  const [admin, setAdmin] = useState(false); const [status, setStatus] = useState('pending');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string[]>([]); const [confirmClean, setConfirmClean] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function load(asAdmin = admin, offset = 0, filter = status) {
    const data = await request<Listing>(token, { op: 'list', admin: asAdmin, offset, status: asAdmin ? filter : 'all' });
    setListing(data);
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setNotice('');
    try { await fn(); } catch (error) { setNotice(error instanceof Error ? error.message : '请稍后再试'); }
    finally { setBusy(false); }
  }
  const changed = () => setRequestId(crypto.randomUUID());
  const open = () => { dialog.current?.showModal(); if (!requestId) changed(); if (token) void run(() => load()); };
  return <>
    <button type="button" className="feedback-launch" onClick={open}>反馈处</button>
    <dialog ref={dialog} className="feedback-dialog" aria-labelledby="feedback-title">
      <header><h2 id="feedback-title">反馈处</h2><button type="button" aria-label="关闭反馈处" onClick={() => dialog.current?.close()}>×</button></header>
      {!token ? <p>先在大厅「我的」登录，就能留下反馈、查看处理结果。</p> : <>
        <div className="feedback-toolbar"><button type="button" disabled={busy} onClick={() => void run(async () => { setAdmin(false); setSelected([]); setConfirmClean(false); await load(false); })}>我的反馈</button>
          {listing?.canAdmin ? <button type="button" disabled={busy} onClick={() => void run(async () => { setAdmin(true); await load(true); })}>管理收件箱</button> : null}</div>
        {!admin ? <form onSubmit={event => { event.preventDefault(); void run(async () => {
          await request(token, { op: 'submit', requestId, category, text, images, roomId });
          setText(''); setImages([]); changed(); await load(false); setNotice('收到啦，处理后可以在下面查看结果。');
        }); }}>
          <div className="feedback-kinds">{Object.entries(FEEDBACK_KINDS).map(([key,label]) => <button type="button" key={key} aria-pressed={category === key} disabled={busy} onClick={() => { setCategory(key as FeedbackKind); setImages([]); changed(); }}>{label}</button>)}</div>
          <label>想说的话<textarea required maxLength={FEEDBACK_LIMITS.text} value={text} disabled={busy} placeholder={category.startsWith('bug') ? '当时做了什么？实际发生了什么？' : '建议、喜欢的瞬间，或哪里玩得不太顺……'} onChange={event => { setText(event.target.value); changed(); }} /></label>
          {category === 'bug_image' ? <><label>添加截图（最多3张）<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => {
            const files = Array.from(event.target.files ?? []); event.target.value = '';
            const current = generation.current;
            void run(async () => {
              if (!files.length) return;
              if (files.length > FEEDBACK_LIMITS.images) throw Error('一次最多3张截图');
              const next: string[] = []; for (const file of files) next.push(await compress(file));
              if (current === generation.current) { setImages(next); changed(); }
            });
          }} /></label><div className="feedback-images">{images.map((image, index) => <img key={index} src={image} alt={`待提交截图${index+1}`} />)}</div></> : null}
          <p className="feedback-hint">建议 / repo：每个账号每周前3条有效反馈，各100 bot币（机芯）。按北京时间提交周计算，审核后到账。bug另走补偿。</p>
          <p className="feedback-hint">仅本人和管理员可看。请遮住密码、token和私人聊天；每分钟1条、每天最多5条。截图自动压缩，处理后集中清理。</p>
          {roomId ? <small>附上当前房间号：{roomId}</small> : null}
          <button type="submit" disabled={busy || !text.trim() || (category === 'bug_image' && !images.length)}>{busy ? '处理中…' : '递交反馈'}</button>
        </form> : <>
          <label>收件箱筛选<select value={status} disabled={busy} onChange={event => { const value = event.target.value; setStatus(value); setSelected([]); setConfirmClean(false); void run(() => load(true,0,value)); }}><option value="pending">待处理</option><option value="processed">已处理</option><option value="cleaned">已清理凭据</option></select></label>
          <p className="feedback-hint">截图占用 {((listing?.storageBytes ?? 0)/1024/1024).toFixed(1)} / {((listing?.storageLimit ?? 0)/1024/1024).toFixed(0)} MB。按提交顺序审核，同账号同周先处理较早条目。</p>
          {status === 'processed' ? <div className="feedback-clean"><button type="button" disabled={busy || !selected.length} onClick={() => setConfirmClean(true)}>清理勾选的 {selected.length} 条</button>
            {confirmClean ? <><p>将从当前反馈库删除这 {selected.length} 条的正文和截图，界面中无法恢复。最小审核和发币流水保留；未勾选内容保留。</p><button type="button" disabled={busy} onClick={() => void run(async () => { await request(token,{op:'cleanup',ids:selected,confirmed:true}); setSelected([]); setConfirmClean(false); await load(true,0); setNotice('已清理所选正文和截图。'); })}>确认清理</button><button type="button" onClick={() => setConfirmClean(false)}>取消</button></> : null}</div> : null}
        </>}
        <output className="feedback-notice" aria-live="polite">{notice}</output>
        <h3>{admin ? '收到的反馈' : '我的反馈与回执'}</h3>
        {!listing?.entries.length ? <p className="feedback-hint">这里暂时没有反馈。</p> : listing.entries.map(entry => <FeedbackCard key={entry.id} entry={entry} token={token} admin={admin} busy={busy} selected={selected.includes(entry.id)} onSelect={checked => { setSelected(items => checked ? [...items,entry.id] : items.filter(id => id !== entry.id)); setConfirmClean(false); }} onReview={(decision,amount,currency) => void run(async () => {
          await request(token,{op:'review',id:entry.id,decision,amount,currency}); await load(admin,listing.offset); setNotice('处理完成，发放结果已保存。');
        })} />)}
        <div className="feedback-toolbar"><button type="button" disabled={busy || !listing?.offset} onClick={() => void run(() => load(admin,Math.max(0,(listing?.offset ?? 0)-40)))}>上一页</button><span>{listing?.total ?? 0} 条</span><button type="button" disabled={busy || !listing || listing.offset+40>=listing.total} onClick={() => void run(() => load(admin,(listing?.offset ?? 0)+40))}>下一页</button><button type="button" disabled={busy} onClick={() => void run(() => load(admin,listing?.offset ?? 0))}>刷新</button></div>
      </>}
    </dialog>
  </>;
}
function FeedbackCard({ entry, token, admin, busy, selected, onSelect, onReview }: { entry: FeedbackEntry; token: string; admin: boolean; busy: boolean; selected: boolean; onSelect: (checked: boolean) => void; onReview: (decision: string, amount?: number, currency?: CurrencyId) => void }) {
  const [pictures, setPictures] = useState<string[]>([]), [imageError,setImageError] = useState('');
  const [amount,setAmount] = useState(''), [currency,setCurrency] = useState<CurrencyId>('bot');
  const [loading,setLoading] = useState(false), [confirmPay,setConfirmPay] = useState(false);
  const [expanded,setExpanded] = useState(false);
  const bug = entry.category.startsWith('bug');
  return <article className="feedback-card">
    <strong>{FEEDBACK_KINDS[entry.category]}</strong> <small>{entry.status === 'pending' ? '待处理' : entry.status === 'processed' ? '已处理' : '已清理'}</small>
    <p className="feedback-hint">{entry.name || '已清理姓名'} · {entry.isAi ? '机' : '人'} · {entry.source === 'mcp' ? 'MCP' : '网页'} · {new Date(entry.at).toLocaleString()}<br/>编号 {entry.id.slice(0,12)}{entry.roomId ? ` · 房间 ${entry.roomId}` : ''}</p>
    {entry.text ? <p className="feedback-body">{entry.text}</p> : null}
    {entry.images ? <><button type="button" disabled={loading} onClick={async () => { setLoading(true); setImageError(''); try { const next=[]; for(let i=0;i<entry.images;i++) next.push((await request<{image:string}>(token,{op:'image',id:entry.id,index:i})).image); setPictures(next); } catch(error){setImageError((error as Error).message);} finally {setLoading(false);} }}>{loading ? '读取中…' : `查看${entry.images}张截图`}</button><div className={`feedback-images${expanded?' is-expanded':''}`}>{pictures.map((src,index)=><button type="button" key={index} aria-label={`${expanded?'缩小':'放大'}截图${index+1}`} onClick={()=>setExpanded(value=>!value)}><img src={src} alt={`反馈截图${index+1}`} /></button>)}</div>{pictures.length ? <small>点截图可放大，再点缩小。</small> : null}<output>{imageError}</output></> : null}
    {entry.credit ? <p>{entry.credit.kind === 'reward' ? '反馈奖励' : 'bug补偿'}：{entry.credit.amount} {entry.credit.currency === 'bot' ? 'bot币（机芯）' : '铜钱'}{entry.credit.kind === 'reward' && !entry.credit.amount ? '（提交周的3次奖励已领满）' : ' · 已到账'}</p> : entry.decision === 'dismiss' ? <p>已阅／结案，本条未发币。</p> : null}
    {admin && entry.status === 'processed' ? <label><input type="checkbox" checked={selected} disabled={busy} onChange={event=>onSelect(event.target.checked)} /> 勾选清理</label> : null}
    {admin && entry.status === 'pending' ? <div className="feedback-review">
      {!bug ? <button type="button" disabled={busy} onClick={()=>onReview('valid')}>有效并奖励100 bot币</button> : <><label>补偿金额<input aria-label="bug补偿金额" type="number" min="1" max="10000" value={amount} onChange={event=>{setAmount(event.target.value);setConfirmPay(false);}} /></label><select aria-label="补偿币种" value={currency} onChange={event=>{setCurrency(event.target.value as CurrencyId);setConfirmPay(false);}}><option value="bot">bot币（机芯）</option><option value="human">铜钱</option></select><button type="button" disabled={busy || !Number.isSafeInteger(Number(amount)) || Number(amount)<=0 || Number(amount)>10000} onClick={()=>setConfirmPay(true)}>补偿并结案</button>{confirmPay ? <><p>确认给提交账号「{entry.name}」发放 {amount} {currency === 'bot' ? 'bot币' : '铜钱'}？</p><button type="button" disabled={busy} onClick={()=>onReview('compensate',Number(amount),currency)}>确认发放</button><button type="button" onClick={()=>setConfirmPay(false)}>取消</button></> : null}</>}
      <button type="button" disabled={busy} onClick={()=>onReview('dismiss')}>{bug ? '结案（无补偿）' : '已阅（无奖励）'}</button>
    </div> : null}
  </article>;
}
