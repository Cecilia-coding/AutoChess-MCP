import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { feedbackImage as sharp } from './feedback-image';
import { AccountStore } from './account-store';
import { FEEDBACK_GUIDE, FEEDBACK_KINDS, FEEDBACK_LIMITS as LIMITS, feedbackWeek, isRewardFeedback, type FeedbackKind } from '../meta/feedback';
import { FEEDBACK_REWARD, type FeedbackCredit, type CurrencyId } from '../meta/economy';

export type FeedbackEntry = { id: string; accountId: string; name: string; isAi: boolean; source: 'web' | 'mcp'; category: FeedbackKind; at: number; week: string; digest: string; text?: string; roomId?: string; images: number; status: 'pending' | 'processed' | 'cleaned'; decision?: 'valid' | 'dismiss' | 'compensate'; credit?: FeedbackCredit; cleanedAt?: number };
export type FeedbackInput = { requestId?: unknown; category?: unknown; text?: unknown; roomId?: unknown; images?: unknown };
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const fail = (text: string): never => { throw new Error(text); };

/** Single room-server writer; images are private, normalized, and counted including crash leftovers. */
export class FeedbackStore {
  private entries: FeedbackEntry[] = [];
  private submitting = false;
  readonly directory: string;
  private file: string;
  constructor(directory: string, private accounts: AccountStore, private now = Date.now, private limits = LIMITS) {
    this.directory = resolve(directory, 'feedback');
    mkdirSync(this.directory, { recursive: true });
    this.file = join(this.directory, 'index.json');
    if (existsSync(this.file)) {
      if (statSync(this.file).size > 24 * 1024 * 1024) fail('反馈索引超过安全大小');
      const saved = JSON.parse(readFileSync(this.file, 'utf8'));
      if (saved.version !== 1 || !Array.isArray(saved.entries)) fail('反馈存档格式无效');
      this.entries = saved.entries;
    }
  }
  private actor(token: unknown, admin = false) {
    const actor = this.accounts.authenticate(token);
    if (!actor) return fail('请先登录，再来反馈处');
    if (admin && !actor.isAdmin) return fail('只有管理员可以处理反馈');
    return actor;
  }
  private imagePath(id: string, index: number) {
    if (!/^[a-f0-9]{64}$/.test(id) || !Number.isInteger(index) || index < 0 || index >= LIMITS.images) return fail('图片编号无效');
    const path = resolve(this.directory, `${id}-${index}.webp`);
    if (dirname(path) !== this.directory) return fail('图片路径无效');
    return path;
  }
  private save(entries: FeedbackEntry[]) {
    const data = JSON.stringify({ version: 1, entries });
    if (Buffer.byteLength(data) > 20 * 1024 * 1024) fail('反馈处已满，请等待管理员处理');
    writeFileSync(this.file + '.pending', data, { mode: 0o600 });
    renameSync(this.file + '.pending', this.file);
    this.entries = entries;
  }
  private imageBytes() {
    return readdirSync(this.directory).filter(name => /^[a-f0-9]{64}-[0-2]\.webp$/.test(name))
      .reduce((total, name) => total + statSync(join(this.directory, name)).size, 0);
  }
  list(token: unknown, admin = false, offset = 0, status = 'all') {
    const actor = this.actor(token, admin);
    if (!Number.isSafeInteger(offset) || offset < 0) fail('分页无效');
    const selected = this.entries.filter(e => (admin || e.accountId === actor.id) && (status === 'all' || e.status === status));
    if (!admin) selected.reverse();
    return { guide: FEEDBACK_GUIDE, canAdmin: actor.isAdmin, entries: selected.slice(offset, offset + 40).map(({ digest: _digest, ...entry }) => entry), total: selected.length, offset,
      ...(admin ? { storageBytes: this.imageBytes(), storageLimit: this.limits.storageBytes } : {}) };
  }
  async submit(token: unknown, raw: FeedbackInput, source: 'web' | 'mcp') {
    const actor = this.actor(token);
    if (!raw || typeof raw !== 'object') return fail('请填写反馈内容');
    if (typeof raw.requestId !== 'string' || !/^[\w-]{8,80}$/.test(raw.requestId)) return fail('提交编号无效');
    if (typeof raw.category !== 'string' || !Object.hasOwn(FEEDBACK_KINDS, raw.category)) return fail('请选择反馈类型');
    const category = raw.category as FeedbackKind;
    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!text || text.length > LIMITS.text) return fail('请填写1至3000字的说明');
    const roomId = raw.roomId === undefined || raw.roomId === '' ? undefined : raw.roomId;
    if (roomId !== undefined && (typeof roomId !== 'string' || !/^[a-f0-9]{12}$/.test(roomId))) return fail('房间号格式无效');
    const images = raw.images ?? [];
    if (!Array.isArray(images) || images.length > LIMITS.images || (category !== 'bug_image' && images.length) || (category === 'bug_image' && !images.length)) return fail('图片bug请附1至3张截图；其它类型走文字入口');
    if (source === 'mcp' && images.length) return fail('机请提交文字bug，截图可由人在网页补充');
    const buffers = images.map(value => {
      if (typeof value !== 'string' || value.length > Math.ceil(LIMITS.imageBytes * 4 / 3) + 64 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return fail('只接收512KB以内的JPEG、PNG或WebP截图');
      const buffer = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
      if (buffer.length > LIMITS.imageBytes) return fail('截图过大');
      const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const png = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const webp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
      if (!jpeg && !png && !webp) return fail('文件不是支持的截图格式');
      return buffer;
    });
    const id = hash(actor.id + ':' + raw.requestId);
    const digest = hash(JSON.stringify([category, text, roomId, buffers.map(hash)]));
    const previous = this.entries.find(e => e.id === id);
    if (previous) {
      if (previous.digest !== digest) return fail('重试编号已用于另一条反馈，请重新提交');
      return { id, status: previous.status, replayed: true };
    }
    const same = this.entries.find(e => e.accountId === actor.id && e.digest === digest);
    if (same) return { id: same.id, status: same.status, replayed: true };
    const now = this.now();
    const recent = this.entries.filter(e => e.accountId === actor.id && e.at > now - 86400_000);
    if (recent.length >= this.limits.daily || recent.some(e => now - e.at < this.limits.intervalMs)) return fail('请稍后再提交：每分钟1条、每天最多5条');
    if (this.entries.length >= this.limits.receipts || this.entries.filter(e => e.status !== 'cleaned').length >= this.limits.active) return fail('反馈处已满，请等待管理员处理');
    if (this.submitting) return fail('正在接收另一条反馈，请稍后用相同编号重试');
    this.submitting = true;
    const written: string[] = [];
    try {
      const normalized: Buffer[] = [];
      for (const buffer of buffers) {
        try {
          const input = sharp(buffer, { failOn: 'warning', limitInputPixels: LIMITS.imagePixels, limitInputChannels: 4 });
          const meta = await input.metadata();
          if (!['jpeg','png','webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1 || !meta.width || !meta.height || meta.width * meta.height > LIMITS.imagePixels) fail('图片尺寸过大或包含动图');
          const output = await input.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).timeout({ seconds: 4 }).toBuffer();
          if (output.length > LIMITS.imageBytes) fail('压缩后图片仍过大');
          normalized.push(output);
        } catch { return fail('截图无法安全读取，请换一张静态截图'); }
      }
      this.actor(token); // An async decode must not resurrect a revoked session.
      if (normalized.length && this.imageBytes() + normalized.reduce((sum, buffer) => sum + buffer.length, 0) > this.limits.storageBytes) return fail('截图空间已满，仍可提交文字bug');
      normalized.forEach((buffer, index) => { const path = this.imagePath(id, index); writeFileSync(path, buffer, { flag: 'wx', mode: 0o600 }); written.push(path); });
      const entry: FeedbackEntry = { id, accountId: actor.id, name: actor.username, isAi: actor.isAi, source, category, at: now, week: feedbackWeek(now), digest, text, roomId: roomId as string | undefined, images: normalized.length, status: 'pending' };
      this.save([...this.entries, entry]);
      return { id, status: entry.status, message: '反馈收到了，集中处理后可在这里查看结果。' };
    } catch (error) {
      // Only uncommitted files created by this request are rolled back.
      for (const path of written) if (existsSync(path)) unlinkSync(path);
      throw error;
    } finally { this.submitting = false; }
  }
  image(token: unknown, id: string, index: number) {
    const actor = this.actor(token), entry = this.entries.find(e => e.id === id);
    if (!entry || (!actor.isAdmin && entry.accountId !== actor.id) || entry.status === 'cleaned' || index >= entry.images) return fail('截图不存在或无权查看');
    return { image: 'data:image/webp;base64,' + readFileSync(this.imagePath(id, index)).toString('base64') };
  }
  review(token: unknown, id: string, decision: 'valid' | 'dismiss' | 'compensate', amount = 0, currency: CurrencyId = 'bot') {
    this.actor(token, true);
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return fail('反馈不存在');
    if (!['valid','dismiss','compensate'].includes(decision)) return fail('请选择处理方式');
    if (entry.status !== 'pending') {
      if (entry.decision !== decision || (decision === 'compensate' && (entry.credit?.amount !== amount || entry.credit.currency !== currency))) return fail('反馈已处理，请勿改变旧回执');
      return { entry, replayed: true };
    }
    const reward = isRewardFeedback(entry.category);
    if ((reward && decision === 'compensate') || (!reward && decision === 'valid')) return fail('建议/repo走奖励，bug走补偿或直接结案');
    const persistedCredit = this.accounts.feedbackCredit(token, entry.accountId, id);
    if (persistedCredit && decision === 'dismiss') return fail('这条已发币，请重试原审核动作以恢复回执');
    if (reward && decision === 'valid' && this.entries.some(e => e.accountId === entry.accountId && e.week === entry.week && isRewardFeedback(e.category) && e.status === 'pending' && this.entries.indexOf(e) < this.entries.indexOf(entry))) return fail('请先审核这个账号本周更早的建议/repo，再按提交顺序发奖');
    if (decision === 'compensate' && (!Number.isSafeInteger(amount) || amount <= 0 || amount > FEEDBACK_REWARD.compensationMax)) return fail('补偿金额需要1至10000之间的整数');
    const credit = decision === 'dismiss' ? undefined : this.accounts.creditFeedback(token, entry.accountId, { id, week: entry.week, kind: reward ? 'reward' : 'compensation', currency: reward ? 'bot' : currency, amount: reward ? FEEDBACK_REWARD.amount : amount });
    const next: FeedbackEntry = { ...entry, status: 'processed', decision, credit };
    // Account credit is independently durable/idempotent. A failed index write can safely retry.
    this.save(this.entries.map(e => e.id === id ? next : e));
    return { entry: next };
  }
  cleanup(token: unknown, ids: unknown, confirmed: unknown) {
    this.actor(token, true);
    if (confirmed !== true || !Array.isArray(ids) || !ids.length || ids.length > 40 || ids.some(id => typeof id !== 'string')) return fail('请确认要清理的已处理反馈，最多40条');
    const selected = this.entries.filter(e => ids.includes(e.id));
    if (selected.length !== new Set(ids).size || selected.some(e => e.status === 'pending')) return fail('只能清理已处理的反馈');
    for (const entry of selected) for (let i = 0; i < entry.images; i++) {
      const path = this.imagePath(entry.id, i);
      if (existsSync(path)) unlinkSync(path);
    }
    this.save(this.entries.map(e => ids.includes(e.id) ? { ...e, name: '', text: undefined, roomId: undefined, images: 0, status: 'cleaned', cleanedAt: this.now() } : e));
    return { cleaned: selected.length, message: '正文和截图已清理，最小审核与发币凭据保留。' };
  }
}
