/* oxlint-disable next/no-img-element -- 外观目录含生成的 data URL，使用原图展示。 */
'use client';
import { useEffect, useRef, useState } from 'react';
import { cosmeticImage, type Cosmetic } from '@/lib/meta/cosmetics';
import './gift-reveal.css';

export type GiftLetter = { id: string; fromName: string; cosmeticId: string; at: number; note?: string; claimedAt?: number };

export default function GiftReveal({ gift, cosmetic, onClaim, onClose }: {
  gift: GiftLetter; cosmetic?: Cosmetic; onClaim: (giftId: string) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [stage, setStage] = useState<'sealed' | 'opening' | 'revealed' | 'accepted'>(gift.claimedAt ? 'revealed' : 'sealed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    if (stage !== 'opening') return;
    const timer = setTimeout(() => setStage('revealed'), 350);
    return () => clearTimeout(timer);
  }, [stage]);
  const accept = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await onClaim(gift.id); setStage('accepted'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '还没收好，再试一次'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const date = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(gift.at);
  return <dialog ref={dialog} className="gift-reveal-modal" aria-label={`${gift.fromName}的礼函`}
    onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }}>
    <button type="button" className="gift-close" aria-label="关闭礼函" disabled={busy} onClick={onClose}>×</button>
    <div className="gift-viewport">
      {(!gift.claimedAt && stage !== 'accepted') && <button type="button" className={`sealed-parcel ${stage !== 'sealed' ? 'is-bursting' : ''}`}
        disabled={stage !== 'sealed'} onClick={() => setStage('opening')} aria-label="轻触启封">
        <span className="envelope-seam-v" aria-hidden="true" />
        <span className="wax-seal" aria-hidden="true"><span className="wax-seal-symbol">✦</span></span>
        <span className="parcel-caption"><span className="parcel-title">{gift.fromName} 寄来一份心意</span><span className="parcel-sub">A GIFT FOR YOU</span></span>
        <span className="hint-click">❖ 轻触启封 ❖</span>
      </button>}
      {(stage === 'revealed' || stage === 'accepted') && <article className={`revealed-codex is-active ${stage === 'accepted' ? 'is-accepted' : ''}`}>
        <div className="codex-border-frame" aria-hidden="true">{['tl', 'tr', 'bl', 'br'].map(corner => <span key={corner} className={`corner-fleuron fleuron-${corner}`}>✦</span>)}</div>
        <header className="codex-header"><span className="header-tag">❖ {gift.claimedAt ? '珍藏的心意' : '心意已启封'}</span><time className="header-date" dateTime={new Date(gift.at).toISOString()}>{date}</time></header>
        <div className="gift-main-artifact">
          {cosmetic ? <img className={`gift-preview gift-preview-${cosmetic.kind}`} src={cosmeticImage(cosmetic.id)} alt={cosmetic.name} /> : <span className="artifact-icon">✧</span>}
          <h2 className="artifact-title">{cosmetic?.name ?? gift.cosmeticId}</h2>
          <p className="gift-theme">{cosmetic?.tagline}</p>
          {cosmetic?.giftIntro && <p className="gift-theme">{cosmetic.giftIntro}</p>}
          <div className="artifact-meta-pills"><span className="pill-rarity">✦ {cosmetic?.kind === 'frame' ? '头像框' : '棋盘'}</span><span className="pill-count">一份心意</span></div>
        </div>
        {gift.note ? <div className="gift-letter-scroll"><span className="quote-mark-top" aria-hidden="true">“</span><p className="letter-message">{gift.note}</p><p className="letter-sender">—— {gift.fromName}</p></div> : <p className="letter-sender gift-signed">—— {gift.fromName}</p>}
        {error && <p className="gift-error" role="alert">{error}</p>}
        <button type="button" className="accept-action-btn" disabled={busy || stage === 'accepted'} onClick={gift.claimedAt ? onClose : () => void accept()}>
          ✦ {gift.claimedAt ? '妥善收好' : busy ? '正在收好…' : '收下心意 · 存入行囊'} ✦
        </button>
      </article>}
      {stage === 'accepted' && <output className="gift-finish"><span aria-hidden="true">✦</span><p>礼物已收好，寄语留在赠礼簿。</p><button type="button" className="accept-action-btn" onClick={onClose}>妥善收好</button></output>}
    </div>
  </dialog>;
}
