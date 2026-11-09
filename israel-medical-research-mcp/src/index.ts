#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchPapers,
  searchPapersSchema,
  getPaperDetails,
  getPaperDetailsSchema,
  searchByInstitution,
  searchByInstitutionSchema,
  getRecentPapers,
  getRecentPapersSchema,
  countPapers,
  countPapersSchema,
} from "./tools.js";

const server = new McpServer({
  name: "israel-medical-research-mcp",
  version: "1.0.0",
});

function toolFailure(error: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "PubMed request failed" }],
  };
}

server.tool(
  "search_papers",
  "Search PubMed with israel[affiliation]. This is a text match, not verified Israeli provenance (it can include Beth Israel abroad). Returns citation summaries, upstream total and returned count; multi-word Title/Abstract text may be interpreted as a phrase.",
  searchPapersSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => searchPapers(searchPapersSchema.parse(args)).catch(toolFailure)
);

server.tool(
  "get_paper_details",
  "Get citation metadata by PubMed ID (PMID): title, authors, journal, publication date, recognized DOI and PubMed URL. Does not return an abstract or full text.",
  getPaperDetailsSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => getPaperDetails(getPaperDetailsSchema.parse(args)).catch(toolFailure)
);

server.tool(
  "search_by_institution",
  "Search PubMed affiliation text for an institution together with israel[affiliation]. Country and institutional provenance are not independently verified; genuine collaborations are retained.",
  searchByInstitutionSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => searchByInstitution(searchByInstitutionSchema.parse(args)).catch(toolFailure)
);

server.tool(
  "get_recent_papers",
  "Get PubMed papers in a publication-date range matching israel[affiliation], optionally filtered by topic. Geographic provenance is unverified; the affiliation text can also match institutions abroad.",
  getRecentPapersSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => getRecentPapers(getRecentPapersSchema.parse(args)).catch(toolFailure)
);

server.tool(
  "count_papers",
  "Count PubMed text-query matches including israel[affiliation]. This is not a verified count of papers from Israeli institutions; missing upstream counts are unavailable.",
  countPapersSchema.shape,
  { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  async (args) => countPapers(countPapersSchema.parse(args)).catch(toolFailure)
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Israel Medical Research MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
