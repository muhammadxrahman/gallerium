export interface FetchFallbackOptions {
  retries?: number; // extra attempts per URL after the first (default 1)
  timeoutMs?: number; // per-attempt timeout (default 15000)
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Try each URL in order, retrying transient failures, until one returns an ok
// response. Throws the last error if every URL/attempt fails. This is what makes
// data loading resilient: a single mirror going down (or a slow/hung request)
// no longer breaks the app — it falls through to the next source.
export async function fetchWithFallback(
  urls: string[],
  opts: FetchFallbackOptions = {}
): Promise<Response> {
  const retries = opts.retries ?? 1;
  const timeoutMs = opts.timeoutMs ?? 15000;
  let lastError: unknown = new Error("No URLs provided");

  for (const url of urls) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchWithTimeout(url, timeoutMs);
        if (res.ok) return res;
        lastError = new Error(`HTTP ${res.status} from ${url}`);
      } catch (e) {
        lastError = e;
      }
    }
  }

  throw lastError;
}
