/**
 * Gemini REST client（2 バックエンド対応）。
 *
 * - **aistudio**: generativelanguage.googleapis.com（API キー認証）
 * - **vertex**: {region}-aiplatform.googleapis.com（GCP ADC / Bearer トークン認証）
 *
 * `GEMINI_BACKEND=vertex` で Vertex AI を使用。Vertex は GCP プロジェクト課金の
 * クォータを使うため、AI Studio 無料枠の日次上限を回避できる。
 * 管理画面のエージェント専用・開発環境のみ（呼び出し側で assertDev() ガード）。
 */

const AISTUDIO_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TIMEOUT_MS = 60_000;

/** 既定モデル。AI Studio / Vertex 双方で利用可能なことを動作確認済み。 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export type GeminiBackend = 'aistudio' | 'vertex';

/** 使用バックエンドを決定する。GEMINI_BACKEND を優先、無ければ AI Studio。 */
export function getGeminiBackend(): GeminiBackend {
  const b = (process.env.GEMINI_BACKEND ?? '').trim().toLowerCase();
  if (b === 'vertex') return 'vertex';
  if (b === 'aistudio') return 'aistudio';
  // 明示が無い場合、Vertex 用の設定があれば vertex、それ以外は aistudio
  if (process.env.GOOGLE_CLOUD_PROJECT) return 'vertex';
  return 'aistudio';
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

function resolveSignal(signal: AbortSignal | undefined): AbortSignal | undefined {
  if (signal) return signal;
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return undefined;
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;
  return AbortSignal.timeout(timeoutMs);
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

const VERTEX_DEFAULT_REGION = 'us-central1';

// google-auth-library のクライアントを使い回す（トークンは内部でキャッシュ/更新）。
let cachedAuth: { getAccessToken: () => Promise<string | null | undefined>; getProjectId: () => Promise<string> } | null = null;

async function getVertexConfig(): Promise<{ project: string; region: string; token: string }> {
  const region = process.env.GOOGLE_CLOUD_REGION?.trim() || VERTEX_DEFAULT_REGION;
  // ADC から認証クライアントを取得（動的 import で edge バンドルへ混入させない）
  if (!cachedAuth) {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    cachedAuth = {
      getAccessToken: () => client.getAccessToken().then((r) => r.token),
      getProjectId: () => auth.getProjectId(),
    };
  }
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim() || (await cachedAuth.getProjectId());
  if (!project) {
    throw new GeminiError('GOOGLE_CLOUD_PROJECT が解決できません。.env か gcloud のデフォルトプロジェクトを設定してください。');
  }
  const token = await cachedAuth.getAccessToken();
  if (!token) {
    throw new GeminiError('Vertex AI のアクセストークンを取得できません。`gcloud auth application-default login` を実行してください。');
  }
  return { project, region, token };
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
  error?: {
    message?: string;
    details?: { '@type'?: string; retryDelay?: string }[];
  };
};

/** 429 応答の RetryInfo から待機秒数を取り出す（"21.6s" → 21.6）。なければ null。 */
function parseRetryDelaySec(resp: GeminiResponse): number | null {
  const detail = resp.error?.details?.find((d) => typeof d.retryDelay === 'string');
  if (!detail?.retryDelay) return null;
  const m = detail.retryDelay.match(/([\d.]+)s/);
  return m ? Number(m[1]) : null;
}

/**
 * Gemini にテキスト生成を依頼し、生成テキストを返す。
 */
export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;
  const backend = getGeminiBackend();
  const signal = resolveSignal(opts.signal);

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

  // バックエンドごとに URL とヘッダを構築する。
  let url: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (backend === 'vertex') {
    const { project, region, token } = await getVertexConfig();
    url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;
    headers.Authorization = `Bearer ${token}`;
  } else {
    url = `${AISTUDIO_ENDPOINT}/${model}:generateContent?key=${getGeminiApiKey()}`;
  }

  // 一時的エラー（429 レート超過 / 500・503 過負荷）は再試行。
  // 429 はサーバ指定の retryDelay を尊重する（無駄打ちでレート窓をさらに圧迫しないため）。
  const MAX_RETRIES = 3;
  /** retryDelay がこの秒数を超える場合は待たずに諦める（呼び出し側を長時間ブロックしない）。 */
  const MAX_WAIT_SEC = 30;
  let data: GeminiResponse | null = null;
  let lastStatus = 0;
  let lastMessage = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
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
    // 待機秒数: 429 はサーバ指定の retryDelay を優先（+1s 余裕）。なければ指数バックオフ。
    const serverDelay = res.status === 429 ? parseRetryDelaySec(json) : null;
    const waitSec = serverDelay !== null ? serverDelay + 1 : 2 ** attempt;
    if (waitSec > MAX_WAIT_SEC) {
      throw new GeminiError(`${lastMessage}（推奨待機 ${Math.round(waitSec)}s が上限超過のため中断）`, res.status);
    }
    await new Promise((r) => setTimeout(r, waitSec * 1000));
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
