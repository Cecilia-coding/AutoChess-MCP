import express, { type ErrorRequestHandler } from 'express';
import type { AccountStore } from './account-store';
import type { FeedbackStore } from './feedback-store';
import { FEEDBACK_LIMITS } from '../meta/feedback';

export function feedbackRouter(accounts: AccountStore, feedback: FeedbackStore) {
  const router = express.Router();
  let active = 0;
  const attempts = new Map<string, { at: number; count: number }>();
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    const account = accounts.authenticate(token);
    if (!account) { res.status(401).json({ error: '请先登录，再来反馈处' }); return; }
    const now = Date.now();
    for (const [key, value] of attempts) if (now - value.at >= 60_000) attempts.delete(key);
    const attempt = attempts.get(account.id) ?? { at: now, count: 0 };
    if (attempt.count >= 60 || active >= 4 || (!attempts.has(account.id) && attempts.size >= 2048)) { res.status(429).json({ error: '反馈处忙碌，请稍后重试' }); return; }
    attempt.count++; attempts.set(account.id, attempt);
    active++;
    let released = false;
    const release = () => { if (!released) { active--; released = true; } };
    res.on('close', release); res.on('finish', release);
    req.setTimeout(15_000, () => { req.destroy(); release(); });
    next();
  });
  router.post('/', express.json({ limit: FEEDBACK_LIMITS.bodyBytes, inflate: false }), async (req, res) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      const args = req.body ?? {};
      if (args.op === 'submit') res.json(await feedback.submit(token, args, 'web'));
      else if (args.op === 'list') res.json(feedback.list(token, args.admin === true, args.offset ?? 0, args.status ?? 'all'));
      else if (args.op === 'image') res.json(feedback.image(token, args.id, args.index));
      else if (args.op === 'review') res.json(feedback.review(token, args.id, args.decision, args.amount, args.currency));
      else if (args.op === 'cleanup') res.json(feedback.cleanup(token, args.ids, args.confirmed));
      else res.status(400).json({ error: '未知反馈操作' });
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : '反馈操作失败' }); }
  });
  const bodyError: ErrorRequestHandler = (_error, _req, res, _next) => { res.status(413).json({ error: '上传格式或大小超出限制，请减少截图后重试' }); };
  router.use(bodyError);
  return router;
}
