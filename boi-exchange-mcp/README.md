# BOI Exchange MCP

Part of [skills-il](https://github.com/skills-il): browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


MCP server for official Bank of Israel exchange rates. Access daily representative rates (sha'ar yatzig) for the currencies returned by `list_currencies` against the Israeli New Shekel (ILS) via the official BOI SDMX API.

No API key required.

## Install

The commands below describe the upstream package. Local reviewed source changes are not published to npm; use the reviewed local build to obtain these corrections, after approving dependency installation/build. No integration has been activated by this review.

```bash
npx -y @skills-il/boi-exchange-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "boi-exchange": {
      "command": "npx",
      "args": ["-y", "@skills-il/boi-exchange-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add boi-exchange npx -- -y @skills-il/boi-exchange-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `get_exchange_rate` | Get the latest representative exchange rate for a currency against ILS |
| `get_historical_rates` | Get daily rates over a date range |
| `list_currencies` | List all supported currency codes |
| `get_rate_change` | Calculate rate change (absolute and percentage) between two dates |
| `convert_currency` | Convert an amount between ILS and another currency using the latest official rate |

## Local development

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "boi-exchange": {
      "command": "npx",
      "args": ["-y", "@skills-il/boi-exchange-mcp"]
    }
  }
}
```

### From source

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/boi-exchange-mcp
npm install
npm run build
```

Then add to your MCP config:

```json
{
  "mcpServers": {
    "boi-exchange": {
      "command": "node", "args": ["/absolute/path/to/mcps/boi-exchange-mcp/dist/index.js"]
    }
  }
}
```

## API Reference

This MCP wraps the Bank of Israel SDMX series database:

- **Base URL**: `https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0`
- **Data browser**: https://edge.boi.gov.il/FusionDataBrowser/?df=BOI.STATISTICS:EXR(1.0)
- **Documentation**: https://www.boi.org.il/en/economic-roles/statistics/
- **Auth**: None (public API)
- **Rate publishing schedule**: Foreign-exchange business days (normally Monday–Friday), excluding applicable holidays and other publication gaps. See [BOI explanatory notes](https://www.boi.org.il/en/economic-roles/financial-markets/explanatory-notes-to-the-representative-exchange-rates/) (retrieved 2026-10-28). Representative rates are informational; actual transaction rates can differ.
- **Units**: Outputs normalize `OBS_VALUE / 10^UNIT_MULT` to ILS per one foreign-currency unit and retain the original quote as `sourceQuote`. BOI quotes JPY per 100 yen (`UNIT_MULT=2`): 1.9557 ILS per 100 JPY on 2026-10-26 is 0.019557 ILS per JPY. Missing or invalid quote metadata stops conversion instead of assuming one unit. [BOI published table](https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/).

## Examples

**"What's the dollar rate today?"**
Calls `get_exchange_rate` with `currency: "USD"`.

**"Show me EUR/ILS for the last month"**
Calls `get_historical_rates` with `currency: "EUR"`, date range for the past 30 days.

**"Convert 1000 USD to shekels"**
Calls `convert_currency` with `amount: 1000`, `fromCurrency: "USD"`, `toCurrency: "ILS"`.

**"How much did the dollar change this year?"**
Calls `get_rate_change` with `currency: "USD"`, from Jan 1 to today.

## License

MIT
