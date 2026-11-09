# Israel Clinical Trials MCP Server

Part of [skills-il](https://github.com/skills-il): browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


An MCP (Model Context Protocol) server that searches active and completed clinical trials at Israeli hospitals and research centers via the [ClinicalTrials.gov v2 API](https://clinicaltrials.gov/data-api/api).

> **Disclaimer**: This tool is for informational purposes only and does not constitute medical advice. Clinical trial information may change frequently. Always consult qualified healthcare providers before making any medical decisions, including decisions about participating in clinical trials.

## Install

```bash
npx -y @skills-il/israel-clinical-trials-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-clinical-trials": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-clinical-trials-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-clinical-trials npx -- -y @skills-il/israel-clinical-trials-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `search_trials` | Search clinical trials in Israel by condition, keyword, or intervention |
| `get_trial_details` | Get full details for a specific trial by NCT ID |
| `find_trials_by_hospital` | Find trials at a specific Israeli hospital (e.g. Sheba, Hadassah, Ichilov, Rambam) |
| `list_recruiting_trials` | List currently recruiting trials in Israel, optionally filtered by condition |
| `get_trial_locations` | Get all Israeli sites and contact info for a specific trial |

## Installation

```bash
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "israel-clinical-trials": {
      "command": "npx", "args": ["-y", "@skills-il/israel-clinical-trials-mcp"]
    }
  }
}
```

## Usage with Claude Code

```bash
claude mcp add israel-clinical-trials npx -- -y @skills-il/israel-clinical-trials-mcp
```

## Example Queries

- "Find recruiting cancer trials in Israel"
- "What clinical trials are running at Hadassah hospital?"
- "Get details for trial NCT05659901"
- "Show me all Israeli sites for trial NCT05659901"
- "Find diabetes trials with pembrolizumab in Israel"

## API

This server uses the [ClinicalTrials.gov v2 API](https://clinicaltrials.gov/data-api/api), which is free and requires no authentication. Searches use upstream location terms, then verify that a listed site country is Israel. Hospital searches match the facility on that same Israeli site. RECRUITING requires a matching Israeli site marked RECRUITING; studies with unknown local status appear separately and are not counted as confirmed recruiting. Other status filters refer to worldwide study status. Direct NCT detail lookup can retrieve any trial, including one with no Israeli site.

## License

MIT

Search tools return one upstream page (limit 50 maximum), then apply local filters. Outputs separate upstream match total, upstream rows on the page, eligible-on-page, unknown local status and returned count. The upstream total is not an Israel-eligible total. Continue with page_token and unchanged filters even if local filtering leaves an empty page. Site statuses, posted update dates, and the ACTUAL/ESTIMATED marker on start, primary-completion and study-completion dates reflect the source record; confirm availability with the site. Admission is serialized at 200 ms spacing within this process.
