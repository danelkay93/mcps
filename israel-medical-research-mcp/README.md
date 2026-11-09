# israel-medical-research-mcp

Part of [skills-il](https://github.com/skills-il): browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


MCP server for medical research searches via the [PubMed E-utilities API](https://www.ncbi.nlm.nih.gov/books/NBK25501/). Every search adds `israel[affiliation]`, a text match rather than verified institutional geography. It can include institutions abroad named Beth Israel. No blanket exclusion is applied, because that would also remove genuine collaborations. Affiliation indexing is less complete in older records.

## Install

```bash
npx -y @skills-il/israel-medical-research-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-medical-research": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-medical-research-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-medical-research npx -- -y @skills-il/israel-medical-research-mcp
```

## Tools

- `search_papers`: PubMed Title/Abstract field search with the affiliation-text filter. Multi-word queries may be interpreted as phrases by PubMed.
- `search_by_institution`: Add an institution-name affiliation query (Weizmann, Hadassah, Tel Aviv University, etc.); this does not verify institutional identity or country.
- `get_recent_papers`: Recent papers in a date range, optionally narrowed by topic.
- `get_paper_details`: Citation metadata by PMID; abstracts and full text are not returned. DOI is returned only when the electronic-location value has a recognizable DOI format; the original electronic-location value is retained.
- `count_papers`: Upstream query-match count without fetching summaries, not a geographically verified Israeli-paper count.

Search outputs distinguish upstream total from returned count. Missing totals are `null`/unavailable; malformed envelopes and unavailable citation records are errors. Request admission is serialized at 350 ms spacing within this process; other processes sharing an IP or key need their own coordination.

See `src/tools.ts` for parameter schemas.

## Data source

[NCBI PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/): public API, no key required for typical query rates.

## Local development

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-medical-research-mcp
npm install
npm run build
node dist/index.js
```

## License

MIT
