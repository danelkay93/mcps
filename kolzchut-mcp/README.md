# Kolzchut MCP Server

Part of [skills-il](https://github.com/skills-il): browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


MCP server for [Kolzchut (All-Rights / כל-זכות)](https://www.kolzchut.org.il), Israel's authoritative knowledge base for rights and entitlements. Provides AI agents with access to thousands of structured articles covering rights for new immigrants (olim), tax benefits, housing, health insurance, employment, disability, elderly care, and more.

## Install

```bash
npx -y @skills-il/kolzchut-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kolzchut": {
      "command": "npx",
      "args": ["-y", "@skills-il/kolzchut-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add kolzchut npx -- -y @skills-il/kolzchut-mcp
```

## Features

- **Full-text search** across all Kolzchut rights articles in Hebrew and English
- **Article retrieval** with wikitext or plain text output
- **Section-level reading** for targeted information extraction
- **Category browsing** to discover rights by topic area
- **No authentication configured** - calls the site's MediaWiki API path, whose availability and permission for this use are unverified (see Data Source)

## Tools

| Tool | Description |
|------|-------------|
| `kolzchut_search_rights` | Search rights articles by keyword |
| `kolzchut_get_article` | Get full article content by title |
| `kolzchut_get_article_sections` | List section headings of an article |
| `kolzchut_get_article_section` | Read a specific section by index |
| `kolzchut_list_category_members` | List articles in a rights category |
| `kolzchut_list_categories` | Browse available rights categories |

## Installation

```bash
npm install
npm run build
```

## Usage

### Claude Code / Claude Desktop

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "kolzchut": {
      "command": "npx", "args": ["-y", "@skills-il/kolzchut-mcp"]
    }
  }
}
```

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Example Queries

- "What tax benefits do new immigrants get in Israel?"
- "Search for housing rights for olim"
- "What are the rights of people with disabilities in Israel?"
- "List all categories related to employment"

## Data Source

All data comes from [kolzchut.org.il](https://www.kolzchut.org.il), maintained by the Kolzchut (All-Rights) non-profit organization. The operator's [llms.txt](https://www.kolzchut.org.il/llms.txt), reviewed on 2026-10-28, states BY-NC-SA 2.5 IL and asks for credit and an article link. That conflicts with this project's former CC BY-SA 3.0 claim; the copyright page could not be verified during that review. Confirm the applicable content licence with the operator before reuse, especially commercial use. Article results include source URLs for attribution. The MIT licence below covers this server's code.

Requests are serialized with at least five seconds between admissions in this process. The operator's [robots.txt](https://www.kolzchut.org.il/robots.txt) and llms.txt restrict automated backend access; whether that covers on-demand agent calls remains an interpretation. The existing `/w/api.php` path has not been validated (the review encountered HTTP 403). Throttling does not establish permission or availability; do not bypass a refusal.

## License

MIT
