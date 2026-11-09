const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const THROTTLE_MS = 350;

let lastRequestTime = 0;
let admission = Promise.resolve();

function getApiKeyParam(): string {
  const apiKey = process.env.NCBI_API_KEY;
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
}

function throttle(): Promise<void> {
  const slot = admission.then(async () => {
    const wait = THROTTLE_MS - (Date.now() - lastRequestTime);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestTime = Date.now();
  });
  admission = slot.catch(() => {});
  return slot;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasError(value: Record<string, unknown>): boolean {
  return ["error", "ERROR", "errorlist"].some((key) => value[key] != null);
}

function encodedIds(ids: string[]): string {
  if (!ids.length || ids.some((id) => !/^[1-9]\d*$/.test(id))) {
    throw new Error("PubMed IDs must be positive digit strings");
  }
  return encodeURIComponent(ids.join(","));
}

export interface PubmedSearchResult {
  ids: string[];
  count: number | null;
}

export async function pubmedSearch(
  term: string,
  maxResults: number,
  options?: { mindate?: string; maxdate?: string; datetype?: string; rettype?: string }
): Promise<PubmedSearchResult> {
  await throttle();

  let url = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=${maxResults}&retmode=json${getApiKeyParam()}`;

  if (options?.mindate) {
    url += `&mindate=${encodeURIComponent(options.mindate)}`;
  }
  if (options?.maxdate) {
    url += `&maxdate=${encodeURIComponent(options.maxdate)}`;
  }
  if (options?.datetype) {
    url += `&datetype=${encodeURIComponent(options.datetype)}`;
  }
  if (options?.rettype) {
    url += `&rettype=${encodeURIComponent(options.rettype)}`;
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`PubMed esearch failed: ${response.status} ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  if (!object(payload) || hasError(payload) || !object(payload.esearchresult) || hasError(payload.esearchresult)) {
    throw new Error("PubMed ESearch returned an error or invalid envelope");
  }
  const result = payload.esearchresult;
  if (!Array.isArray(result.idlist) || result.idlist.some((id) => typeof id !== "string" || !/^[1-9]\d*$/.test(id))) {
    throw new Error("PubMed ESearch response is missing a valid ID list");
  }
  // A missing total is unavailable, never inferred from the returned page.
  let count: number | null = null;
  if (result.count != null) {
    if ((typeof result.count !== "string" && typeof result.count !== "number") ||
        !/^(0|[1-9]\d*)$/.test(String(result.count)) || !Number.isSafeInteger(Number(result.count))) {
      throw new Error("PubMed ESearch returned an invalid total count");
    }
    count = Number(result.count);
  }
  return { ids: result.idlist as string[], count };
}

export async function pubmedSummary(ids: string[]): Promise<Record<string, unknown>> {
  const idParam = encodedIds(ids);
  await throttle();

  const url = `${BASE_URL}/esummary.fcgi?db=pubmed&id=${idParam}&retmode=json${getApiKeyParam()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`PubMed esummary failed: ${response.status} ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  if (!object(payload) || hasError(payload) || !object(payload.result) || hasError(payload.result)) {
    throw new Error("PubMed ESummary returned an error or invalid envelope");
  }
  return payload.result;
}

export async function pubmedFetch(ids: string[]): Promise<string> {
  const idParam = encodedIds(ids);
  await throttle();

  const url = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${idParam}&rettype=abstract&retmode=xml${getApiKeyParam()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`PubMed efetch failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
