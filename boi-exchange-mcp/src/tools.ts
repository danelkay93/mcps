/**
 * Tool registrations for boi-exchange-mcp.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getLatestRate,
  getHistoricalRates,
  listAvailableCurrencies,
} from "./client.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Date must be a real calendar date");

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

function errorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

// Decimal places of a parsed source quote, from its shortest round-trip form.
function decimalPlaces(value: number): number {
  const [mantissa, exponent = "0"] = String(value).split("e");
  return Math.max(0, (mantissa.split(".")[1] ?? "").length - Number(exponent));
}

export function registerTools(server: McpServer): void {
  // --- get_exchange_rate ---
  server.registerTool(
    "get_exchange_rate",
    {
      title: "Get Exchange Rate",
      description:
        "Get the latest official representative exchange rate (sha'ar yatzig) published by the Bank of Israel for a currency against the Israeli New Shekel (ILS). Returns the most recent rate available, typically from the last business day.",
      inputSchema: {
        currency: z
          .string()
          .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
          .describe(
            "ISO 4217 currency code, e.g. USD, EUR, GBP, JPY, CHF, CAD, AUD"
          ),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ currency }) => {
      try {
        const entry = await getLatestRate(currency);
        const output = {
          currency: currency.toUpperCase(),
          rate: entry.rate,
          sourceQuote: { rate: entry.quotedRate, per: entry.quotedPer, unitMultiplier: entry.unitMultiplier },
          date: entry.date,
          unit: `1 ${currency.toUpperCase()} = ${entry.rate} ILS`,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- get_historical_rates ---
  server.registerTool(
    "get_historical_rates",
    {
      title: "Get Historical Rates",
      description:
        "Get official Bank of Israel representative exchange rates for a currency against ILS over a date range. Returns available published observations within the range; weekends, holidays and other publication gaps are omitted. Rates are normalized to ILS per one foreign-currency unit.",
      inputSchema: {
        currency: z
          .string()
          .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
          .describe("ISO 4217 currency code, e.g. USD, EUR, GBP"),
        startDate: dateSchema
          .describe("Start date in YYYY-MM-DD format"),
        endDate: dateSchema
          .describe("End date in YYYY-MM-DD format"),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ currency, startDate, endDate }) => {
      if (startDate > endDate) {
        return errorResult("startDate must be before or equal to endDate");
      }
      try {
        const entries = await getHistoricalRates(currency, startDate, endDate);
        const output = {
          currency: currency.toUpperCase(),
          startDate,
          endDate,
          count: entries.length,
          unit: `ILS per 1 ${currency.toUpperCase()}`,
          rates: entries.map((e) => ({ date: e.date, rate: e.rate,
            sourceQuote: { rate: e.quotedRate, per: e.quotedPer, unitMultiplier: e.unitMultiplier } })),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- list_currencies ---
  server.registerTool(
    "list_currencies",
    {
      title: "List Currencies",
      description:
        "List all currency codes for which the Bank of Israel publishes representative exchange rates against the Israeli New Shekel (ILS). Returns ISO 4217 codes.",
      inputSchema: {},
      annotations: TOOL_ANNOTATIONS,
    },
    async () => {
      try {
        const currencies = await listAvailableCurrencies();
        const output = {
          count: currencies.length,
          currencies,
          note: "Returned rates are normalized to ILS per one foreign-currency unit using BOI UNIT_MULT; sourceQuote preserves the original quote",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- get_rate_change ---
  server.registerTool(
    "get_rate_change",
    {
      title: "Get Rate Change",
      description:
        "Calculate the change in the Bank of Israel representative exchange rate for a currency against ILS between two dates. Returns the absolute change in ILS per one foreign-currency unit, at the precision of the normalized source quotes, and the percentage change rounded to two decimals.",
      inputSchema: {
        currency: z
          .string()
          .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
          .describe("ISO 4217 currency code, e.g. USD, EUR, GBP"),
        startDate: dateSchema
          .describe("Start date in YYYY-MM-DD format"),
        endDate: dateSchema
          .describe("End date in YYYY-MM-DD format"),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ currency, startDate, endDate }) => {
      if (startDate > endDate) {
        return errorResult("startDate must be before or equal to endDate");
      }
      try {
        const entries = await getHistoricalRates(currency, startDate, endDate);
        const first = entries[0];
        const last = entries[entries.length - 1];
        // Source quotes are exact decimals, so the normalized difference needs no
        // more places than the finer quote plus its UNIT_MULT (JPY per 100 adds 2).
        // Rounding there removes only division noise; a fixed 4 places erased
        // real per-yen moves.
        const places = Math.max(0, ...[first, last].map((entry) =>
          decimalPlaces(entry.quotedRate) + entry.unitMultiplier));
        const scale = 10 ** places;
        const absoluteChange = Math.round((last.rate - first.rate) * scale) / scale;
        const percentChange = (absoluteChange / first.rate) * 100;
        if (![absoluteChange, percentChange, percentChange * 100].every(Number.isFinite)) {
          return errorResult("Rate change exceeds the supported numeric range");
        }

        const direction =
          absoluteChange > 0
            ? "weakened"
            : absoluteChange < 0
              ? "strengthened"
              : "unchanged";

        const output = {
          currency: currency.toUpperCase(),
          startDate: first.date,
          startRate: first.rate,
          unit: `ILS per 1 ${currency.toUpperCase()}`,
          startSourceQuote: { rate: first.quotedRate, per: first.quotedPer },
          endDate: last.date,
          endRate: last.rate,
          endSourceQuote: { rate: last.quotedRate, per: last.quotedPer },
          absoluteChange,
          percentChange: Math.round(percentChange * 100) / 100,
          direction: `ILS ${direction} against ${currency.toUpperCase()}`,
          dataPoints: entries.length,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // --- convert_currency ---
  server.registerTool(
    "convert_currency",
    {
      title: "Convert Currency",
      description:
        "Convert an amount between ILS and another currency using the latest official Bank of Israel representative rate. One of fromCurrency or toCurrency must be ILS.",
      inputSchema: {
        amount: z
          .number()
          .finite()
          .positive()
          .describe("Amount to convert"),
        fromCurrency: z
          .string()
          .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
          .describe("Source currency code, e.g. USD, ILS"),
        toCurrency: z
          .string()
          .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
          .describe("Target currency code, e.g. ILS, EUR"),
      },
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ amount, fromCurrency, toCurrency }) => {
      try {
        const from = fromCurrency.toUpperCase();
        const to = toCurrency.toUpperCase();

        if (from !== "ILS" && to !== "ILS") {
          return errorResult(
            "One of fromCurrency or toCurrency must be ILS. The Bank of Israel publishes rates against the shekel only."
          );
        }

        if (from === "ILS" && to === "ILS") {
          return errorResult(
            "fromCurrency and toCurrency cannot both be ILS."
          );
        }

        const foreignCurrency = from === "ILS" ? to : from;
        const entry = await getLatestRate(foreignCurrency);

        let result: number;
        if (from === "ILS") {
          result = amount / entry.rate;
        } else {
          result = amount * entry.rate;
        }

        if (!Number.isFinite(result) || !Number.isFinite(result * 100)) {
          return errorResult("Converted amount exceeds the supported numeric range");
        }

        const output = {
          from: { currency: from, amount },
          to: {
            currency: to,
            amount: Math.round(result * 100) / 100,
          },
          rate: entry.rate,
          sourceQuote: { rate: entry.quotedRate, per: entry.quotedPer, unitMultiplier: entry.unitMultiplier },
          rateDate: entry.date,
          rateDescription: `1 ${foreignCurrency} = ${entry.rate} ILS`,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}
