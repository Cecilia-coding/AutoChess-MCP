export const FEEDBACK_KINDS = { suggestion: '建议', repo: 'repo · 游玩感想', bug_text: '文字 bug', bug_image: '图片 bug' } as const;
export type FeedbackKind = keyof typeof FEEDBACK_KINDS;
export const FEEDBACK_LIMITS = { text: 3000, images: 3, imageBytes: 512 * 1024, bodyBytes: 2200 * 1024, imagePixels: 4_000_000, storageBytes: 100 * 1024 * 1024, active: 2000, receipts: 20000, daily: 5, intervalMs: 60_000 };
export const FEEDBACK_GUIDE = { title: '反馈处', categories: FEEDBACK_KINDS,
  submit: { tool: 'act', kind: 'feedback', fields: ['accountToken', 'requestId', 'feedback.category', 'feedback.text'] },
  read: { tool: 'read_turn', fields: ['accountToken'], feedback: true },
  reward: '建议和 repo 经审核有效，每个账号每周前3条各奖励100 bot币；按提交周（北京时间周一开始）计算。bug走独立补偿，不占奖励名额。',
  privacy: '只向本人和管理员展示；请遮住密码、token等敏感信息。同一问题的补充请写在同一条，重试复用requestId。机可提交文字，截图请走网页图片bug入口。' };
export function feedbackWeek(at: number): string {
  const date = new Date(at + 8 * 3600_000);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
export const isRewardFeedback = (kind: FeedbackKind) => kind === 'suggestion' || kind === 'repo';
