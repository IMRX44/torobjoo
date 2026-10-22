import "server-only";
import { fetch as proxiedFetch, ProxyAgent } from "undici";
import { parseSSE } from "./sse";
export class ProviderError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(code);
  }
}
let last: {
  reachable: boolean | null;
  lastErrorCode: string | null;
  status: number;
  model: string | null;
} = { reachable: null, lastErrorCode: null, status: 0, model: null };
const models = () =>
  [process.env.LLM_MODEL, ...(process.env.LLM_FALLBACK_MODEL || "").split(",")]
    .map((m) => m?.trim())
    .filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
export function health() {
  return {
    configured: !!(process.env.LLM_API_KEY && process.env.LLM_BASE_URL && models().length),
    ...last,
    model: last.model || models()[0] || null,
  };
}
const codeFor = (status: number, type: string) =>
  status === 403
    ? "PROVIDER_BLOCKED"
    : status === 401
      ? "AUTH_401"
      : status === 404
        ? "MODEL_404"
        : status === 429
          ? "RATE_LIMIT"
          : type.includes("html")
            ? "PROVIDER_HTML"
            : "PROVIDER_ERROR";
// Errors where another attempt or model on the same gateway may still answer.
const retryable = new Set(["MODEL_404", "RATE_LIMIT", "PROVIDER_ERROR", "PROVIDER_HTML", "EMPTY_RESPONSE", "TIMEOUT", "INVALID_RESPONSE", "NETWORK_ERROR"]);
// Node's fetch ignores HTTPS_PROXY; on networks that drop direct connections the gateway is
// only reliably reachable through the system proxy, so honor it (LLM_PROXY overrides, "off" disables).
const proxyUrl = process.env.LLM_PROXY ?? process.env.HTTPS_PROXY ?? process.env.https_proxy;
const dispatcher = proxyUrl && proxyUrl !== "off" ? new ProxyAgent(proxyUrl) : undefined;
async function call(
  model: string,
  messages: any[],
  tools: any[],
  signal: AbortSignal,
  onText: (t: string) => void,
) {
  const url = process.env.LLM_BASE_URL!.replace(/\/$/, "") + "/chat/completions";
  const init = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      Accept: "text/event-stream, application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(tools.length ? { tools } : {}),
      stream: true,
      // Reasoning models spend part of this on hidden thinking before the answer.
      max_tokens: Number(process.env.LLM_MAX_TOKENS) || 4096,
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS) || 60000)]),
  };
  const started = Date.now();
  let response;
  try {
    response = await proxiedFetch(url, { ...init, dispatcher });
  } catch (e: any) {
    // Proxy configured but not running: go direct instead of failing every request.
    if (!dispatcher || e?.cause?.code !== "ECONNREFUSED") throw e;
    response = await proxiedFetch(url, init);
  }
  const type = response.headers.get("content-type") || "";
  if (!response.ok || type.includes("text/html")) {
    const text = (await response.text().catch(() => "")).slice(0, 300);
    if (process.env.LLM_DEBUG) console.error(`[llm] ${model} HTTP ${response.status}`, text);
    // Gateway-wide maintenance: every model is down, so retrying only delays the fallback.
    if (response.status === 503 && /maintenance|upgrad/i.test(text))
      throw new ProviderError("PROVIDER_MAINTENANCE", 503);
    throw new ProviderError(codeFor(response.status, type), response.status);
  }
  const headersAt = Date.now() - started;
  let content = "",
    usage: any;
  const calls: any[] = [];
  if (type.includes("text/event-stream") && response.body) {
    for await (const event of parseSSE(response.body as ReadableStream<Uint8Array>)) {
      if (event.data === "[DONE]") break;
      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        continue;
      }
      if (parsed.error) throw new ProviderError("PROVIDER_ERROR", response.status);
      if (parsed.usage) usage = parsed.usage;
      const chunk = parsed.choices?.[0]?.delta;
      if (!chunk) continue;
      if (chunk.content) {
        content += chunk.content;
        onText(chunk.content);
      }
      for (const t of chunk.tool_calls || []) {
        const i = t.index ?? 0;
        calls[i] ??= { id: "", type: "function", function: { name: "", arguments: "" } };
        if (t.id) calls[i].id = t.id;
        if (t.function?.name) calls[i].function.name += t.function.name;
        if (t.function?.arguments) calls[i].function.arguments += t.function.arguments;
      }
    }
  } else if (type.includes("application/json")) {
    const data: any = await response.json();
    content = data.choices?.[0]?.message?.content || "";
    if (content) onText(content);
    calls.push(...(data.choices?.[0]?.message?.tool_calls || []));
  } else throw new ProviderError("INVALID_RESPONSE", response.status);
  if (process.env.LLM_DEBUG)
    console.log(`[llm] ${model} headers ${headersAt}ms total ${Date.now() - started}ms`, JSON.stringify(usage || {}));
  const toolCalls = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
  if (!content && !toolCalls.length) throw new ProviderError("EMPTY_RESPONSE");
  return {
    role: "assistant",
    content: content || null,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };
}
/**
 * One chat completion with native tool calling. Text deltas stream through onText.
 * Tries LLM_MODEL, then each LLM_FALLBACK_MODEL, but only before any text was streamed.
 */
export async function completion(
  messages: any[],
  tools: any[],
  signal: AbortSignal,
  onText: (t: string) => void,
) {
  if (!health().configured) throw new ProviderError("NOT_CONFIGURED");
  let error: ProviderError | undefined;
  const list = models(),
    deadline = Date.now() + (Number(process.env.LLM_TOTAL_TIMEOUT_MS) || 90000);
  for (const [attempt, model] of [list[0], ...list].entries()) {
    if (attempt) {
      // Retries stop once the buyer has waited long enough; the local guide takes over.
      if (Date.now() > deadline - 15000) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    signal.throwIfAborted();
    let streamed = false;
    try {
      const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(Math.max(5000, deadline - Date.now()))]);
      const result = await call(model, messages, tools, attemptSignal, (t) => {
        streamed = true;
        onText(t);
      });
      last = { reachable: true, lastErrorCode: null, status: 200, model };
      return result;
    } catch (e) {
      if (!(e instanceof ProviderError) && !signal.aborted) console.error("[llm]", model, e);
      error =
        e instanceof ProviderError
          ? e
          : new ProviderError(
              signal.aborted
                ? "CANCELLED"
                : e instanceof Error && e.name === "TimeoutError"
                  ? "TIMEOUT"
                  : "NETWORK_ERROR",
            );
      last = { reachable: false, lastErrorCode: error.code, status: error.status, model };
      if (signal.aborted || streamed || !retryable.has(error.code)) break;
    }
  }
  throw error!;
}
