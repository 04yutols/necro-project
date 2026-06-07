/**
 * Gemini (Google AI Studio) REST client.
 *
 * 管理画面のエージェント専用。重い SDK を入れず、REST を直接叩くことで
 * AI Studio の API キー形式（AQ.* / AIza* 双方）に依存せず制御する。
 * 開発環境でのみ利用する前提（呼び出し側で assertDev() ガードを通す）。
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** 既定モデル。AI Studio で利用可能なことを動作確認済み。 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.GEMINI;
  if (!key) {
    throw new GeminiError(
      'GEMINI_API_KEY が設定されていません。.env に GEMINI_API_KEY を追加してください。',
    );
  }
  return key.trim();
}

export type GenerateOptions = {
  model?: string;
  /** system 相当の指示。Gemini では systemInstruction として渡す。 */
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** true の場合 responseMimeType を application/json に固定する。 */
  json?: boolean;
  /**
   * thinking（推論）トークンの予算。0=無効 / 正数=固定上限 / -1=動的(無制限)。
   * 既定: JSON生成時は 1024（小さめの固定予算）。難しい生成では引き上げ可。
   */
  thinkingBudget?: number;
  signal?: AbortSignal;
};

type GeminiCandidate = {
  content?: { parts?: { text?: string }[] };
  finishReason?: string;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
};

/**
 * Gemini にテキスト生成を依頼し、生成テキストを返す。
 */
export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const apiKey = getGeminiApiKey();
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;

  // JSON 生成時は thinking を「小さめの固定予算」に絞る。完全無効化(0)だと制約充足や
  // 設計の質が落ちやすく、無制限(動的)だと出力枠を食って JSON が切れる。1024 トークンの
  // 推論余地を残しつつ、maxOutputTokens(8192) で JSON 本体の枠を確保する。
  const JSON_THINKING_BUDGET = 1024;
  const thinkingBudget = opts.thinkingBudget ?? (opts.json ? JSON_THINKING_BUDGET : undefined);
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxOutputTokens ?? (opts.json ? 8192 : 2048),
    ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    ...(thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget } } : {}),
  };
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  // 一時的エラー（429 レート超過 / 500・503 過負荷）は指数バックオフで最大3回再試行。
  const MAX_RETRIES = 3;
  let data: GeminiResponse | null = null;
  let lastStatus = 0;
  let lastMessage = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    const json = (await res.json()) as GeminiResponse;
    if (res.ok) {
      data = json;
      break;
    }
    lastStatus = res.status;
    lastMessage = json.error?.message ?? `Gemini API エラー (HTTP ${res.status})`;
    const transient = res.status === 429 || res.status === 500 || res.status === 503;
    if (!transient || attempt === MAX_RETRIES) {
      throw new GeminiError(lastMessage, res.status);
    }
    // 1s, 2s, 4s バックオフ
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  if (!data) {
    throw new GeminiError(lastMessage || 'Gemini API への接続に失敗しました。', lastStatus);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new GeminiError(`Gemini から空の応答が返りました${reason ? `（finishReason: ${reason}）` : ''}。`);
  }
  return text;
}

/**
 * JSON 応答を生成し、パースして返す。
 * ```json``` フェンスが付いた場合も剥がす。
 */
export async function generateJson<T = unknown>(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<T> {
  const raw = await generateText(prompt, { ...opts, json: true });
  return parseJsonLoose<T>(raw);
}

/** ```json フェンスや前後ノイズを許容して JSON を抽出する。 */
export function parseJsonLoose<T = unknown>(raw: string): T {
  let text = raw.trim();
  // ```json ... ``` フェンスを除去
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  // 最初の { から最後の } までを抽出（前置き文混入対策）
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new GeminiError(
      `Gemini 応答を JSON としてパースできませんでした: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
