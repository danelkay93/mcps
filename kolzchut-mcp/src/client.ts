/**
 * Kolzchut MediaWiki API client.
 * Wraps the public API at https://www.kolzchut.org.il/w/api.php
 */

const API_BASE = "https://www.kolzchut.org.il/w/api.php";
const REQUEST_TIMEOUT = 15_000;
const CHARACTER_LIMIT = 25_000;
const MIN_INTERVAL_MS = 5_000;
let lastRequestTime = 0;
let admission = Promise.resolve();

function articleUrl(title: string): string {
  return "https://www.kolzchut.org.il/he/" + encodeURIComponent(title.replace(/ /g, "_"));
}

function throttle(): Promise<void> {
  const slot = admission.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestTime);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestTime = Date.now();
  });
  admission = slot.catch(() => {});
  return slot;
}

interface MediaWikiSearchResult {
  ns: number;
  title: string;
  pageid: number;
  snippet: string;
  size: number;
  wordcount: number;
  timestamp: string;
}

interface MediaWikiSearchResponse {
  query: {
    searchinfo: { totalhits: number };
    search: MediaWikiSearchResult[];
  };
  continue?: { sroffset: number };
}

interface MediaWikiParseResponse {
  parse: {
    title: string;
    pageid: number;
    wikitext?: { "*": string };
    text?: { "*": string };
    sections?: Array<{
      toclevel: number;
      level: string;
      line: string;
      number: string;
      index: string;
    }>;
  };
}

interface MediaWikiCategoryMembersResponse {
  query: {
    categorymembers: Array<{
      pageid: number;
      ns: number;
      title: string;
    }>;
  };
  continue?: { cmcontinue: string };
}

interface MediaWikiAllCategoriesResponse {
  query: {
    allcategories: Array<{
      "*": string;
    }>;
  };
  continue?: { accontinue: string };
}

export interface SearchResult {
  url: string;
  title: string;
  pageid: number;
  snippet: string;
  size: number;
  wordcount: number;
  timestamp: string;
}

export interface SearchOutput {
  total: number;
  count: number;
  offset: number;
  results: SearchResult[];
  has_more: boolean;
  next_offset?: number;
}

export interface ArticleOutput {
  url: string;
  title: string;
  pageid: number;
  content: string;
  truncated?: boolean;
}

export interface SectionInfo {
  index: string;
  level: string;
  number: string;
  heading: string;
}

export interface ArticleSectionsOutput {
  url: string;
  title: string;
  pageid: number;
  sections: SectionInfo[];
}

export interface CategoryMember {
  url: string;
  pageid: number;
  title: string;
}

export interface CategoryMembersOutput {
  category: string;
  count: number;
  members: CategoryMember[];
  has_more: boolean;
  continue_token?: string;
}

export interface CategoryInfo {
  name: string;
}

export interface CategoriesOutput {
  count: number;
  categories: CategoryInfo[];
  has_more: boolean;
  continue_token?: string;
}

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  await throttle();
  const url = new URL(API_BASE);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "kolzchut-mcp-server/1.0" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Kolzchut API error: HTTP ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchRights(
  query: string,
  limit: number,
  offset: number
): Promise<SearchOutput> {
  const data = await apiFetch<MediaWikiSearchResponse>({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    sroffset: String(offset),
    srprop: "snippet|size|wordcount|timestamp",
  });

  const total = data.query.searchinfo.totalhits;
  const results = data.query.search.map((r) => ({
    url: articleUrl(r.title),
    title: r.title,
    pageid: r.pageid,
    snippet: stripHtml(r.snippet),
    size: r.size,
    wordcount: r.wordcount,
    timestamp: r.timestamp,
  }));

  return {
    total,
    count: results.length,
    offset,
    results,
    has_more: total > offset + results.length,
    ...(total > offset + results.length
      ? { next_offset: offset + results.length }
      : {}),
  };
}

export async function getArticle(
  title: string,
  format: "wikitext" | "html"
): Promise<ArticleOutput> {
  const prop = format === "wikitext" ? "wikitext" : "text";
  const data = await apiFetch<MediaWikiParseResponse>({
    action: "parse",
    page: title,
    prop,
    disablelimitreport: "true",
    disableeditsection: "true",
  });

  let content =
    format === "wikitext"
      ? data.parse.wikitext?.["*"] ?? ""
      : stripHtml(data.parse.text?.["*"] ?? "");

  let truncated = false;
  if (content.length > CHARACTER_LIMIT) {
    content = content.slice(0, CHARACTER_LIMIT);
    truncated = true;
  }

  return {
    title: data.parse.title,
    url: articleUrl(data.parse.title),
    pageid: data.parse.pageid,
    content,
    ...(truncated ? { truncated: true } : {}),
  };
}

export async function getArticleSections(
  title: string
): Promise<ArticleSectionsOutput> {
  const data = await apiFetch<MediaWikiParseResponse>({
    action: "parse",
    page: title,
    prop: "sections",
  });

  return {
    title: data.parse.title,
    url: articleUrl(data.parse.title),
    pageid: data.parse.pageid,
    sections: (data.parse.sections ?? []).map((s) => ({
      index: s.index,
      level: s.level,
      number: s.number,
      heading: s.line,
    })),
  };
}

export async function getArticleSection(
  title: string,
  section: number,
  format: "wikitext" | "html"
): Promise<ArticleOutput> {
  const prop = format === "wikitext" ? "wikitext" : "text";
  const data = await apiFetch<MediaWikiParseResponse>({
    action: "parse",
    page: title,
    prop,
    section: String(section),
    disablelimitreport: "true",
    disableeditsection: "true",
  });

  let content =
    format === "wikitext"
      ? data.parse.wikitext?.["*"] ?? ""
      : stripHtml(data.parse.text?.["*"] ?? "");

  let truncated = false;
  if (content.length > CHARACTER_LIMIT) {
    content = content.slice(0, CHARACTER_LIMIT);
    truncated = true;
  }

  return {
    title: data.parse.title,
    url: articleUrl(data.parse.title),
    pageid: data.parse.pageid,
    content,
    ...(truncated ? { truncated: true } : {}),
  };
}

export async function listCategoryMembers(
  category: string,
  limit: number,
  continueToken?: string
): Promise<CategoryMembersOutput> {
  let cmtitle = category;
  if (cmtitle.startsWith("Category:")) {
    cmtitle = `קטגוריה:${cmtitle.slice("Category:".length)}`;
  } else if (!cmtitle.startsWith("קטגוריה:")) {
    cmtitle = `קטגוריה:${cmtitle}`;
  }
  const params: Record<string, string> = {
    action: "query",
    list: "categorymembers",
    cmtitle,
    cmlimit: String(limit),
    cmtype: "page|subcat",
  };
  if (continueToken) {
    params.cmcontinue = continueToken;
  }

  const data = await apiFetch<MediaWikiCategoryMembersResponse>(params);
  const members = data.query.categorymembers.map((m) => ({
    url: articleUrl(m.title),
    pageid: m.pageid,
    title: m.title,
  }));

  return {
    category: params.cmtitle,
    count: members.length,
    members,
    has_more: !!data.continue?.cmcontinue,
    ...(data.continue?.cmcontinue
      ? { continue_token: data.continue.cmcontinue }
      : {}),
  };
}

export async function listCategories(
  prefix: string,
  limit: number,
  continueToken?: string
): Promise<CategoriesOutput> {
  const params: Record<string, string> = {
    action: "query",
    list: "allcategories",
    aclimit: String(limit),
  };
  if (prefix) {
    params.acprefix = prefix;
  }
  if (continueToken) {
    params.accontinue = continueToken;
  }

  const data = await apiFetch<MediaWikiAllCategoriesResponse>(params);
  const categories = data.query.allcategories.map((c) => ({
    name: c["*"],
  }));

  return {
    count: categories.length,
    categories,
    has_more: !!data.continue?.accontinue,
    ...(data.continue?.accontinue
      ? { continue_token: data.continue.accontinue }
      : {}),
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtml(html: string): string {
  // Walk characters to strip all tags and skip style/script block content.
  // Uses a state machine instead of regex to avoid scanner findings.
  let result = "";
  let inTag = false;
  let skipContent = false;
  let tagName = "";
  let collectingTagName = false;

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === "<") {
      inTag = true;
      tagName = "";
      collectingTagName = true;
    } else if (ch === ">") {
      inTag = false;
      collectingTagName = false;
      const lower = tagName.toLowerCase();
      if (lower === "style" || lower === "script") {
        skipContent = true;
      } else if (lower === "/style" || lower === "/script") {
        skipContent = false;
      }
    } else if (inTag && collectingTagName) {
      if (ch === " " || ch === "\t" || ch === "\n") {
        collectingTagName = false;
      } else {
        tagName += ch;
      }
    } else if (!inTag && !skipContent) {
      result += ch;
    }
  }

  // Decode entities once after all HTML is removed (avoids double-escaping)
  result = decodeHtmlEntities(result);

  return result.replace(/\n{3,}/g, "\n\n").trim();
}
