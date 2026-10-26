export type AgyPromptInput = {
  round: number;
  gold: number;
  capacity: number;
  shop: string[];
  board: string[];
  bench: string[];
};

export type AgyParsedResult = {
  response: string;
  totalTokens: number;
};

const SCHEMA_TEXT = '{"say":"30字内一句话","sell":["piece-id"],"buy":[3,0],"field":["piece-id","shop:3"]}';

export function buildAgyPrompt(input: AgyPromptInput): string {
  const shop = input.shop.map((entry, index) => `${index}:${entry}`).join('|');
  const board = input.board.join('|');
  const bench = input.bench.join('|');
  return [
    '你是自走棋回合助手Anti。',
    `仅输出一个JSON对象且不要任何额外文字，键必须且仅能是:${SCHEMA_TEXT}`,
    '规则:say为1-30个Unicode字符;sell最多3个且互不重复且必须是现有id;buy最多5个且互不重复且仅0..4;',
    'field元素需互不重复,每项为现有id或shop:N(N为0..4),field总人数不得超过capacity;你只选上阵名单,坐标由本地代码决定。',
    `状态:round=${input.round},gold=${input.gold},capacity=${input.capacity}`,
    `shop=${shop}`,
    `board=${board}`,
    `bench=${bench}`,
  ].join('\n');
}

function parseLineAsJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    throw new Error('AGY_BAD_NDJSON');
  }
}

export function parseAgyStreamJsonNdjson(stdoutText: string): AgyParsedResult {
  const lines = stdoutText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error('AGY_BAD_NDJSON');
  }

  const entries = lines.map(parseLineAsJson);
  const last = entries[entries.length - 1];
  if (!last || typeof last !== 'object' || Array.isArray(last)) {
    throw new Error('AGY_BAD_RESULT');
  }
  const record = last as Record<string, unknown>;
  if (record.event !== 'result') {
    throw new Error('AGY_BAD_RESULT');
  }
  const result = record.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('AGY_BAD_RESULT');
  }
  const r = result as Record<string, unknown>;
  if (r.status !== 'SUCCESS') {
    throw new Error('AGY_NOT_SUCCESS');
  }
  if (typeof r.response !== 'string') {
    throw new Error('AGY_BAD_RESULT');
  }
  const usage = r.usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    throw new Error('AGY_BAD_RESULT');
  }
  const total = (usage as Record<string, unknown>).total_tokens;
  if (typeof total !== 'number' || !Number.isFinite(total)) {
    throw new Error('AGY_BAD_RESULT');
  }
  return { response: r.response, totalTokens: total };
}
