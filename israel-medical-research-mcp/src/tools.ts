import { z } from "zod";
import { pubmedSearch, pubmedSummary } from "./client.js";

// ─── Shared types ────────────────────────────────────────────────────────────

interface AuthorEntry {
  name?: string;
}

interface ArticleSummary {
  uid?: string;
  title?: string;
  authors?: AuthorEntry[];
  source?: string;
  fulljournalname?: string;
  pubdate?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  elocationid?: string;
}

const GEOGRAPHIC_SCOPE = "Text matches for israel[affiliation], not verified Israeli institutional provenance. This can include non-Israeli institutions named Beth Israel and retains genuine collaborations; older affiliation coverage can be incomplete.";

function requireArticle(value: unknown, id: string): ArticleSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`No citation metadata returned for PMID ${id}`);
  }
  const record = value as Record<string, unknown>;
  // Reject explicit errors without depending on one undocumented error shape.
  if (record.error != null || record.ERROR != null || typeof record.title !== "string" || !record.title.trim()) {
    throw new Error(`Citation metadata unavailable or invalid for PMID ${id}`);
  }
  return record as ArticleSummary;
}

function doiFromElocation(value?: string): string | null {
  const candidate = value?.replace(/^doi:\s*/i, "").trim();
  return candidate && /^10\.\d{4,9}\/\S+$/i.test(candidate) ? candidate : null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizePubMedInput(input: string): string {
  return input.replace(/[[\]()]/g, " ").replace(/\b(AND|OR|NOT)\b/gi, "").trim();
}

function buildIsraelQuery(parts: {
  query?: string;
  institution?: string;
}): string {
  const terms: string[] = [];

  if (parts.query) {
    terms.push(`(${sanitizePubMedInput(parts.query)}[Title/Abstract])`);
  }

  if (parts.institution) {
    terms.push(`(${sanitizePubMedInput(parts.institution)}[affiliation])`);
  }

  terms.push("(israel[affiliation])");

  return terms.join(" AND ");
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

async function searchAndSummarize(
  term: string,
  maxResults: number,
  searchOptions?: { mindate?: string; maxdate?: string; datetype?: string }
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const { ids, count } = await pubmedSearch(term, maxResults, searchOptions);
  const metadata = { query: term, geographic_scope: GEOGRAPHIC_SCOPE, total: count, total_available: count !== null, returned: ids.length };

  if (ids.length === 0) {
    return {
      content: [{ type: "text", text: JSON.stringify({ ...metadata, papers: [] }, null, 2) }],
    };
  }

  const result = await pubmedSummary(ids);

  const papers = ids.map((id) => {
    const article = requireArticle(result[id], id);
    return {
      pmid: id,
      title: article.title ?? "Unknown",
      authors: (article.authors ?? []).map((a) => a.name).filter(Boolean),
      journal: article.fulljournalname ?? article.source ?? "Unknown",
      pubdate: article.pubdate ?? "Unknown",
      doi: doiFromElocation(article.elocationid),
      elocationid: article.elocationid ?? null,
    };
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ ...metadata, papers }, null, 2),
      },
    ],
  };
}

// ─── Tool definitions ────────────────────────────────────────────────────────

export const searchPapersSchema = z.object({
  query: z.string().describe("Title/Abstract field query; multi-word text may be interpreted as a phrase by PubMed"),
  institution: z
    .string()
    .optional()
    .describe("Optional Israeli institution, e.g. 'Hadassah', 'Sheba', 'Weizmann'"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return (default 20)"),
});

export async function searchPapers(
  args: z.infer<typeof searchPapersSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const term = buildIsraelQuery({ query: args.query, institution: args.institution });
  return searchAndSummarize(term, args.max_results);
}

export const getPaperDetailsSchema = z.object({
  pmid: z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive().safe()]).describe("Positive numeric PubMed ID of the paper"),
});

export async function getPaperDetails(
  args: z.infer<typeof getPaperDetailsSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const id = String(args.pmid);
  const result = await pubmedSummary([id]);
  const article = requireArticle(result[id], id);

  const details = {
    pmid: id,
    title: article.title ?? "Unknown",
    authors: (article.authors ?? []).map((a) => a.name).filter(Boolean),
    journal: article.fulljournalname ?? article.source ?? "Unknown",
    pubdate: article.pubdate ?? "Unknown",
    volume: article.volume ?? null,
    issue: article.issue ?? null,
    pages: article.pages ?? null,
    doi: doiFromElocation(article.elocationid),
    elocationid: article.elocationid ?? null,
    pubmed_url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
  };
}

export const searchByInstitutionSchema = z.object({
  institution: z
    .string()
    .describe(
      "Israeli institution name, e.g. 'Hadassah Medical Center', 'Technion', 'Tel Aviv University'"
    ),
  topic: z.string().optional().describe("Optional topic to filter by"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return (default 20)"),
});

export async function searchByInstitution(
  args: z.infer<typeof searchByInstitutionSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const term = buildIsraelQuery({ query: args.topic, institution: args.institution });
  return searchAndSummarize(term, args.max_results);
}

export const getRecentPapersSchema = z.object({
  days_back: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Number of days to look back (default 30)"),
  topic: z.string().optional().describe("Optional topic to filter by"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return (default 20)"),
});

export async function getRecentPapers(
  args: z.infer<typeof getRecentPapersSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const now = new Date();
  const past = new Date(now.getTime() - args.days_back * 24 * 60 * 60 * 1000);

  const term = buildIsraelQuery({ query: args.topic });

  return searchAndSummarize(term, args.max_results, {
    mindate: formatDate(past),
    maxdate: formatDate(now),
    datetype: "pdat",
  });
}

export const countPapersSchema = z.object({
  query: z.string().optional().describe("Optional search query text"),
  institution: z
    .string()
    .optional()
    .describe("Optional Israeli institution name"),
});

export async function countPapers(
  args: z.infer<typeof countPapersSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const term = buildIsraelQuery({ query: args.query, institution: args.institution });

  const { count } = await pubmedSearch(term, 0);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            query: term,
            total_count: count,
            total_available: count !== null,
            geographic_scope: GEOGRAPHIC_SCOPE,
          },
          null,
          2
        ),
      },
    ],
  };
}
