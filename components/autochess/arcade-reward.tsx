/* oxlint-disable next/no-img-element -- Authored SVG artwork and cosmetic catalog previews. */
/* oxlint-disable next/no-html-link-for-pages -- Host platforms may mount lobby/arcade at custom routes. */
'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ArcadePrize } from '@/lib/meta/arcade';
import { assetUrl } from '@/lib/meta/asset-url';
import { cosmeticById, cosmeticImage } from '@/lib/meta/cosmetics';
import { useAutochessHost } from './host-context';
import './wheel-reward.css';
import './wheel-reward-layout.css';

type Stage = 'arriving' | 'sealed' | 'opening' | 'revealed' | 'accepted' | 'stored';

function prizeLetterMeta(prize: ArcadePrize) {
  const sourceLabel =
    prize.source === 'slot-machine'
      ? '三轴老虎机'
      : prize.source === 'scratchcard'
        ? '像素刮刮乐'
        : prize.source === 'gift'
          ? '伙伴捎礼'
          : '典藏礼函';
  const gifted = prize.source === 'gift' || Boolean(prize.from?.name);
  const sender = prize.from?.name ?? '像素游乐摊';
  return {
    claimable: prize.status === 'pending',
    gifted,
    sender,
    source: sourceLabel,
    title: gifted ? `${sender} 送来「${prize.spec.name}」` : `游乐摊惊喜「${prize.spec.name}」`,
    note: prize.note,
  };
}

export default function ArcadeReward({
  prize,
  onClaim,
  onClose,
}: {
  prize: ArcadePrize;
  onClaim: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const host = useAutochessHost();
  const letter = prizeLetterMeta(prize);
  const cosmetic = cosmeticById(prize.spec.cosmeticId) ?? null;
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const [stage, setStage] = useState<Stage>(letter.claimable ? 'arriving' : 'revealed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    mounted.current = true;
    node?.showModal();
    const settle = () => {
      setHidden(document.hidden);
      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setStage(current =>
          current === 'arriving' ? 'sealed' : current === 'opening' ? 'revealed' : current === 'accepted' ? 'stored' : current,
        );
      }
    };
    settle();
    document.addEventListener('visibilitychange', settle);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', settle);
      node?.close();
    };
  }, []);

  useEffect(() => {
    const next: Partial<Record<Stage, Stage>> = { arriving: 'sealed', opening: 'revealed', accepted: 'stored' };
    if (!next[stage]) return;
    const delay =
      document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : stage === 'opening'
          ? 380
          : 750;
    const timer = setTimeout(() => setStage(next[stage]!), delay);
    return () => clearTimeout(timer);
  }, [stage]);

  const claim = async () => {
    if (submitting.current || !letter.claimable || stage !== 'revealed') return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await onClaim(prize.id);
      if (mounted.current) setStage('accepted');
    } catch (cause) {
      if (mounted.current) {
        const message = cause instanceof Error ? cause.message : '还没收好，再试一次。';
        setError(message.includes('网络中断') ? '领取结果还没传回来。连上后再试一次，会取回这笔结果。' : message);
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="wheel-reward-dialog"
      aria-label={`${letter.sender}的游乐摊礼函`}
      data-motion-paused={hidden}
      onCancel={event => {
        event.preventDefault();
        if (!submitting.current) onClose();
      }}
    >
      <button className="wheel-reward-close" type="button" aria-label="关闭礼函，稍后再收" disabled={busy} onClick={onClose}>
        ×
      </button>
      <div className="wheel-reward-dust" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            style={{ '--dust-x': `${(i * 37) % 100}%`, '--dust-delay': `${i * -0.73}s`, '--dust-speed': `${7 + (i % 5)}s` } as CSSProperties}
          >
            {i % 3 ? '·' : '✦'}
          </span>
        ))}
      </div>
      <div className="reward-stage-viewport" data-stage={stage}>
        {(stage === 'arriving' || stage === 'sealed') && (
          <div className="dove-carrier-actor is-flying-in" aria-hidden="true">
            <img src={assetUrl('/wheel-reward/dove.svg', host.assetBase)} alt="" />
          </div>
        )}
        {(stage === 'arriving' || stage === 'sealed' || stage === 'opening') && (
          <button
            type="button"
            className={`sealed-revival-parcel ${stage === 'opening' ? 'is-blooming' : ''}`}
            disabled={stage !== 'sealed'}
            onClick={() => setStage('opening')}
            aria-label="轻触启封心意"
          >
            <span className="parcel-foliage-texture" aria-hidden="true" />
            <span className="wheel-draw-tag">❖ 像素游乐摊 · {letter.source} ❖</span>
            <span className="revival-seal-core" aria-hidden="true">
              <img className="olive-wreath-ring" src={assetUrl('/wheel-reward/wreath.svg', host.assetBase)} alt="" />
              <span className="seal-wax-disc">
                <img className="seal-dove-icon" src={assetUrl('/wheel-reward/seal.svg', host.assetBase)} alt="" />
              </span>
            </span>
            <span className="parcel-text-block">
              <span className="parcel-title-text">{letter.title}</span>
              <span className="parcel-sub-text">PIXEL ARCADE · PRIZE</span>
            </span>
            <span className="parcel-hint-line">✦ 轻触启封礼盒 ✦</span>
          </button>
        )}
        {(stage === 'revealed' || stage === 'accepted') && (
          <article className={`revealed-revival-card is-active ${stage === 'accepted' ? 'is-claimed' : ''}`}>
            <div className="card-border-ornament" aria-hidden="true">
              {['tl', 'tr', 'bl', 'br'].map(corner => (
                <span key={corner} className={`fleuron-leaf fl-${corner}`}>
                  ✦
                </span>
              ))}
            </div>
            <header className="revival-card-header">
              <span className="header-season-pill">❖ {letter.source}</span>
              <span className="header-wheel-badge">ARCADE EXCLUSIVE</span>
            </header>
            <div className="reward-spotlight-box">
              <div className="reward-halo-bg" aria-hidden="true" />
              {cosmetic ? (
                <img className={`wheel-reward-art is-${cosmetic.kind}`} src={cosmeticImage(cosmetic.id, host.assetBase)} alt={cosmetic.name} />
              ) : (
                <span className="reward-visual-icon">{prize.spec.icon}</span>
              )}
              <h2 className="reward-name-title">{prize.spec.name}</h2>
              {cosmetic?.tagline && <p className="wheel-reward-theme">{cosmetic.tagline}</p>}
              {cosmetic?.giftIntro && <p className="wheel-reward-theme">{cosmetic.giftIntro}</p>}
              <div className="reward-tags-row">
                <span className="tag-rarity-pill">{cosmetic?.kind === 'frame' ? '头像框' : cosmetic?.kind === 'board' ? '棋盘' : '外观'}</span>
                <span className="tag-amount-pill">{letter.gifted ? '绑定伙伴赠礼' : '游乐摊限定掉落'}</span>
              </div>
            </div>
            <div className="revival-message-scroll">
              {letter.note && (
                <>
                  <span className="scroll-quote-mark" aria-hidden="true">
                    “
                  </span>
                  <p className="revival-quote-text">{letter.note}</p>
                </>
              )}
              <p className="revival-sender-credit">
                —— {letter.gifted ? `${letter.sender} 捎来的心意` : `${letter.sender} · ${letter.source}`}
              </p>
            </div>
            {error && (
              <p className="wheel-reward-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="claim-action-btn"
              disabled={busy || stage === 'accepted'}
              onClick={letter.claimable ? () => void claim() : onClose}
            >
              ✦ {busy ? '正在收好…' : !letter.claimable ? '妥善收好' : error ? '再试一次 · 收下心意' : '收进我的行囊'} ✦
            </button>
            {letter.claimable && <p className="wheel-reward-later">也可以先合上礼盒，留在奖品箱里稍后拆开或送给绑定伙伴。</p>}
          </article>
        )}
        {stage === 'stored' && (
          <output className="wheel-reward-finish">
            <span className="wheel-reward-finish-mark" aria-hidden="true">
              ❖
            </span>
            <strong>已经放进行囊</strong>
            <span>「{prize.spec.name}」可在我的装扮里随时佩戴。</span>
            <a className="claim-action-btn wheel-reward-equip" href={`${host.routes.lobby}#me`}>
              去换上装扮
            </a>
            <button type="button" className="claim-action-btn" onClick={onClose}>
              继续逛游乐摊
            </button>
          </output>
        )}
      </div>
    </dialog>
  );
}
