import { cosmeticById } from './cosmetics';

export type GiftPresentationSource = 'ordinary' | 'wheel';
/** Describes the recipient's webpage, not whether anybody has opened it. */
export type GiftPresentation = {
  styleId: string;
  name: string;
  summary: string;
  steps: string[];
  notePlacement: string;
  theme?: string;
  intro?: string;
};

const STYLES: Record<GiftPresentationSource, Omit<GiftPresentation, 'theme' | 'intro'>> = {
  ordinary: {
    styleId: 'gift-letter-v1',
    name: '封蜡礼函',
    summary: '网页收礼入口呈现浅紫纸面、封蜡与金色细饰的礼函。',
    steps: ['封蜡信封', '轻触启封', '展开真实外观、主题、寄语与署名', '确认收下后存入行囊'],
    notePlacement: '寄语在外观与主题下方独立展示，落款是送礼人的账号名；未附寄语时保留署名。',
  },
  wheel: {
    styleId: 'wheel-letter-v1',
    name: '白鸽 · 复苏礼函',
    summary: '网页收礼入口以白鸽、橄榄环和封蜡呈现绿金色春日礼函。',
    steps: ['白鸽捎信', '橄榄环与封蜡封套', '轻触启封春日卡片', '展开真实外观、主题、寄语与署名', '确认收下后存入行囊'],
    notePlacement: '寄语在外观与主题下方的卡片中展示，落款注明送礼人捎来的心意；未附寄语时保留署名。',
  },
};

/** Omit cosmeticId for a general guide. For wheel rewards, call only for cosmetics. */
export function giftPresentation(source: GiftPresentationSource, cosmeticId?: string): GiftPresentation {
  const style = STYLES[source];
  const cosmetic = cosmeticById(cosmeticId);
  const theme = cosmetic?.tagline, intro = cosmetic?.giftIntro;
  return { ...style, steps: [...style.steps], ...(theme ? { theme } : {}), ...(intro ? { intro } : {}) };
}
