/**
 * Bank of Israel SDMX API client.
 * Fetches exchange rate data from the official BOI series database.
 */

const API_BASE =
  "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0";

interface ExchangeRateEntry {
  seriesCode: string;
  currency: string;
  date: string;
  rate: number;
  quotedRate: number;
  quotedPer: number;
  unitMultiplier: number;
  dataType: string;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseCSV(csv: string): ExchangeRateEntry[] {
  // SDMX comments can contain commas, quotes and newlines.
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closedQuote = false;
  const input = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
    } else if (char === '"' && field === "" && !closedQuote) {
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(field.trim()); field = ""; closedQuote = false;
      if (char !== ",") {
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        if (char === "\r" && input[i + 1] === "\n") i++;
      }
    } else {
      if (char === '"' || (closedQuote && !/\s/.test(char))) {
        throw new Error("Malformed CSV quoting from BOI API");
      }
      field += char;
    }
  }
  if (quoted) throw new Error("Unterminated CSV field from BOI API");
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  if (rows.length === 0) return [];

  const header = rows[0];
  const required = ["SERIES_CODE", "BASE_CURRENCY", "TIME_PERIOD", "OBS_VALUE",
    "DATA_TYPE", "UNIT_MULT", "COUNTER_CURRENCY", "UNIT_MEASURE"];
  if (required.some((name) => header.filter((column) => column === name).length !== 1)) {
    throw new Error("BOI CSV has missing or duplicate required metadata columns");
  }
  const seriesIdx = header.indexOf("SERIES_CODE");
  const currencyIdx = header.indexOf("BASE_CURRENCY");
  const dateIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  const dataTypeIdx = header.indexOf("DATA_TYPE");
  const multiplierIdx = header.indexOf("UNIT_MULT");
  const counterIdx = header.indexOf("COUNTER_CURRENCY");
  const measureIdx = header.indexOf("UNIT_MEASURE");

  if ([seriesIdx, currencyIdx, dateIdx, valueIdx, dataTypeIdx, multiplierIdx, counterIdx, measureIdx].includes(-1)) {
    throw new Error(
      "BOI CSV is missing required exchange-rate or quote-unit metadata; conversion refused"
    );
  }

  const entries: ExchangeRateEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length !== header.length) throw new Error("Incomplete BOI CSV row");
    if (cols[dataTypeIdx] !== "OF00") continue;
    // An empty observation is not a published rate; malformed numbers are errors.
    if (cols[valueIdx] === "") continue;
    const quotedRate = Number(cols[valueIdx]);
    const unitMultiplier = Number(cols[multiplierIdx]);
    if (cols[counterIdx] !== "ILS" || cols[measureIdx] !== "ILS" ||
        !/^[A-Z]{3}$/.test(cols[currencyIdx]) || !cols[seriesIdx] ||
        !validDate(cols[dateIdx]) ||
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(cols[valueIdx]) ||
        !/^-?\d+$/.test(cols[multiplierIdx]) || !Number.isSafeInteger(unitMultiplier) ||
        !Number.isFinite(quotedRate) || quotedRate <= 0) {
      throw new Error("Invalid BOI representative-rate value or quote-unit metadata");
    }
    const quotedPer = 10 ** unitMultiplier;
    const rate = quotedRate / quotedPer;
    if (!Number.isFinite(quotedPer) || quotedPer <= 0 || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("Unsupported BOI quote multiplier; conversion refused");
    }

    entries.push({
      seriesCode: cols[seriesIdx],
      currency: cols[currencyIdx],
      date: cols[dateIdx],
      rate,
      quotedRate,
      quotedPer,
      unitMultiplier,
      dataType: cols[dataTypeIdx],
    });
  }

  return entries;
}

function checkedEntries(csv: string, startDate: string, endDate: string, currency?: string): ExchangeRateEntry[] {
  const entries = parseCSV(csv);
  if (entries.some((entry) => entry.date < startDate || entry.date > endDate ||
      (currency !== undefined && entry.currency !== currency.toUpperCase()))) {
    throw new Error("BOI response does not match the requested currency/date range");
  }
  return entries;
}

function buildURL(params: {
  currency?: string;
  startDate?: string;
  endDate?: string;
  dataType?: string;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("format", "csv");

  if (params.dataType) {
    searchParams.set("c[DATA_TYPE]", params.dataType);
  }
  if (params.currency) {
    searchParams.set("c[BASE_CURRENCY]", params.currency.toUpperCase());
  }
  if (params.startDate) {
    searchParams.set("startperiod", params.startDate);
  }
  if (params.endDate) {
    searchParams.set("endperiod", params.endDate);
  }

  return `${API_BASE}?${searchParams.toString()}`;
}

let lastRequestTime = 0;
let admission: Promise<void> = Promise.resolve();
const MIN_REQUEST_INTERVAL_MS = 300;

async function fetchBOI(url: string): Promise<string> {
  // Serialize admission, not just timestamp reads, including after timer delays.
  const slot = admission.then(async () => {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestTime);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestTime = Date.now();
  });
  admission = slot.catch(() => undefined);
  await slot;

  const response = await fetch(url, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "No data found for the given parameters. Check that the currency code is valid and the date range contains business days."
      );
    }
    throw new Error(
      `BOI API returned status ${response.status}: ${response.statusText}`
    );
  }

  return response.text();
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function getLatestRate(
  currency: string
): Promise<ExchangeRateEntry> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 14);

  const url = buildURL({
    currency,
    startDate: formatDate(start),
    endDate: formatDate(end),
    dataType: "OF00",
  });

  const csv = await fetchBOI(url);
  const entries = checkedEntries(csv, formatDate(start), formatDate(end), currency);

  if (entries.length === 0) {
    throw new Error(
      `No representative rate found for ${currency.toUpperCase()}/ILS in the last 14 days. Verify the currency code is supported by the Bank of Israel.`
    );
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries[0];
}

export async function getHistoricalRates(
  currency: string,
  startDate: string,
  endDate: string
): Promise<ExchangeRateEntry[]> {
  const url = buildURL({
    currency,
    startDate,
    endDate,
    dataType: "OF00",
  });

  const csv = await fetchBOI(url);
  const entries = checkedEntries(csv, startDate, endDate, currency);

  if (entries.length === 0) {
    throw new Error(
      `No published representative rates found for ${currency.toUpperCase()}/ILS between ${startDate} and ${endDate}. Publication depends on foreign-exchange business days and holidays.`
    );
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

export async function listAvailableCurrencies(): Promise<string[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 14);

  const url = buildURL({
    startDate: formatDate(start),
    endDate: formatDate(end),
    dataType: "OF00",
  });

  const csv = await fetchBOI(url);
  const entries = checkedEntries(csv, formatDate(start), formatDate(end));

  const currencies = new Set<string>();
  for (const entry of entries) {
    if (entry.currency) {
      currencies.add(entry.currency);
    }
  }

  return Array.from(currencies).sort();
}
