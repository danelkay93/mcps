import { z } from "zod";
import { datastoreSearch, RESOURCES } from "./client.js";

// ─── Amutot Registry Fields ─────────────────────────────────────────────────

const FIELDS = {
  regNumber: "מספר עמותה",
  regDate: "תאריך רישום עמותה",
  nameHe: "שם עמותה בעברית",
  nameEn: "שם עמותה באנגלית",
  statusDate: "תאריך עדכון סטטוס",
  status: "סטטוס עמותה",
  activityClass: "סיווג פעילות ענפי",
  secondaryActivity: "תחום פעילות משני",
  lastFinancialYear: "שנת דיווח דוח כספי אחרון",
  revenue: "מחזור כספי (הכנסות)",
  totalExpenses: "סך הוצאות העמותה",
  volunteers: "כמות מתנדבים",
  employees: "כמות עובדים",
  members: "מספר חברי עמותה",
  activityRegions: "איזורי פעילות",
  lastReportYear: "שנת דיווח אחרונה",
  city: "כתובת - ישוב",
  street: "כתובת - רחוב",
  zipCode: "כתובת - מיקוד",
  goals: "מטרות עמותה",
} as const;

// ─── Foreign Donations Fields ───────────────────────────────────────────────

const DONATION_FIELDS = {
  regNumber: "מספר עמותה",
  name: "שם עמותה",
  donationDate: "תאריך קבלת התרומה",
  donorEntity: "ישות מדינית זרה תורמת",
  donorType: "סוג ישות מדינית זרה תורמת (קוד)",
  amountILS: 'סכום התרומה בש"ח',
  currency: "מטבע",
  exchangeRate: "שער המרה",
  purpose: "מטרת תרומה",
  conditions: "התנאים לתרומה",
  year: "שנת תרומה",
  quarter: "רבעון תרומה",
  mainFunding: "עיקר מימון תרומות מישות מדינית זרה",
} as const;

// ─── Management Certificate Fields ──────────────────────────────────────────

const CERT_FIELDS = {
  regNumber: "מספר עמותה",
  name: "שם עמותה",
  year: "שנת האישור",
  applicationSubmitted: "הגשת בקשה",
  hasApproval: "האם יש אישור",
  lastUpdate: "תאריך עדכון אחרון של רשומה",
} as const;

// ─── Public Benefit Company Fields ──────────────────────────────────────────

const PBC_FIELDS = {
  regNumber: "מספר חלצ",
  regDate: "תאריך רישום חלצ",
  nameHe: "שם חלצ בעברית",
  nameEn: "שם חלצ באנגלית",
  status: "סטטוס חלצ",
  goals: "מטרות ארגון רשמיות",
  activityClass: "סיווג פעילות ענפי",
  activityField: "תחום פעילות",
  lastFinancialYear: "שנת דיווח דוח כספי אחרון",
  revenue: "מחזור - נתונים מדוח מילולי מקוון",
  volunteers: "מתנדבים- נתונים מדוח מילולי מקוון",
  employees: "עובדים- נתונים מדוח מילולי מקוון",
  activityRegions: "איזורי פעילות",
  activityLocations: "מקומות פעילות",
  lastUpdate: "תאריך עדכון אחרון של נתוני חלצ",
  city: "כתובת - ישוב",
  street: "כתובת - רחוב",
  zipCode: "כתובת - מיקוד",
  auditDate: "תאריך ביקורת עומק אחרונה",
} as const;

// ─── Shared Helpers ─────────────────────────────────────────────────────────

const SUMMARY_FIELDS = [
  FIELDS.regNumber,
  FIELDS.nameHe,
  FIELDS.nameEn,
  FIELDS.status,
  FIELDS.activityClass,
  FIELDS.city,
  FIELDS.regDate,
];

function formatRecord(record: Record<string, unknown>): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "_id") continue;
    if (value !== null && value !== undefined && value !== "") {
      formatted[key] = value;
    }
  }
  return formatted;
}

function formatResults(
  records: Record<string, unknown>[],
  total: number
): string {
  if (records.length === 0) {
    return `No results found. Total matching: ${total}`;
  }

  const formatted = records.map(formatRecord);
  return JSON.stringify({ total, count: formatted.length, records: formatted }, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXISTING TOOLS: Amutot Registry
// ═══════════════════════════════════════════════════════════════════════════

export const searchAmutaSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Search text (Hebrew or English name)"),
  number: z
    .number()
    .int()
    .optional()
    .describe("Registration number (starts with 58)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Max results to return (default 10, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
});

export async function searchAmuta(
  args: z.infer<typeof searchAmutaSchema>
): Promise<string> {
  if (!args.query && !args.number) {
    throw new Error("Provide either a search query (text) or a registration number.");
  }

  if (args.number) {
    const result = await datastoreSearch({
      resourceId: RESOURCES.amutot,
      filters: { [FIELDS.regNumber]: args.number },
      limit: 1,
    });
    return formatResults(result.result.records, result.result.total);
  }

  const result = await datastoreSearch({
    resourceId: RESOURCES.amutot,
    q: args.query,
    fields: SUMMARY_FIELDS,
    limit: args.limit,
    offset: args.offset,
  });
  return formatResults(result.result.records, result.result.total);
}

export const getAmutaDetailsSchema = z.object({
  registration_number: z
    .number()
    .int()
    .describe("Amuta registration number (starts with 58)"),
});

export async function getAmutaDetails(
  args: z.infer<typeof getAmutaDetailsSchema>
): Promise<string> {
  const result = await datastoreSearch({
    resourceId: RESOURCES.amutot,
    filters: { [FIELDS.regNumber]: args.registration_number },
    limit: 1,
  });

  if (result.result.records.length === 0) {
    return `No amuta found with registration number ${args.registration_number}`;
  }

  const record = formatRecord(result.result.records[0]);
  return JSON.stringify(record, null, 2);
}

export const searchByActivitySchema = z.object({
  activity_type: z
    .string()
    .describe("Activity classification in Hebrew (e.g. 'חינוך', 'בריאות')"),
  city: z
    .string()
    .optional()
    .describe("Filter by city name in Hebrew (optional)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Max results to return (default 10, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
});

export async function searchByActivity(
  args: z.infer<typeof searchByActivitySchema>
): Promise<string> {
  const filters: Record<string, string> = {
    [FIELDS.activityClass]: args.activity_type,
  };
  if (args.city) {
    filters[FIELDS.city] = args.city;
  }

  const result = await datastoreSearch({
    resourceId: RESOURCES.amutot,
    filters,
    fields: SUMMARY_FIELDS,
    limit: args.limit,
    offset: args.offset,
  });
  return formatResults(result.result.records, result.result.total);
}

export const getFinancialInfoSchema = z.object({
  registration_number: z
    .number()
    .int()
    .describe("Amuta registration number (starts with 58)"),
});

export async function getFinancialInfo(
  args: z.infer<typeof getFinancialInfoSchema>
): Promise<string> {
  const financialFields = [
    FIELDS.regNumber,
    FIELDS.nameHe,
    FIELDS.nameEn,
    FIELDS.lastFinancialYear,
    FIELDS.revenue,
    FIELDS.totalExpenses,
    FIELDS.volunteers,
    FIELDS.employees,
    FIELDS.members,
    FIELDS.lastReportYear,
  ];

  const result = await datastoreSearch({
    resourceId: RESOURCES.amutot,
    filters: { [FIELDS.regNumber]: args.registration_number },
    fields: financialFields,
    limit: 1,
  });

  if (result.result.records.length === 0) {
    return `No amuta found with registration number ${args.registration_number}`;
  }

  const record = formatRecord(result.result.records[0]);
  return JSON.stringify(record, null, 2);
}

export const countAmutotSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Filter by status in Hebrew (e.g. 'רשומה', 'מחוסלת')"),
  activity_type: z
    .string()
    .optional()
    .describe("Filter by activity classification in Hebrew"),
  city: z
    .string()
    .optional()
    .describe("Filter by city name in Hebrew"),
});

export async function countAmutot(
  args: z.infer<typeof countAmutotSchema>
): Promise<string> {
  const filters: Record<string, string> = {};
  if (args.status) {
    filters[FIELDS.status] = args.status;
  }
  if (args.activity_type) {
    filters[FIELDS.activityClass] = args.activity_type;
  }
  if (args.city) {
    filters[FIELDS.city] = args.city;
  }

  const result = await datastoreSearch({
    resourceId: RESOURCES.amutot,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    limit: 0,
  });

  const response: Record<string, unknown> = {
    total: result.result.total,
  };
  if (Object.keys(filters).length > 0) {
    response.filters = filters;
  }

  return JSON.stringify(response, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW TOOLS: Foreign Political Donations
// ═══════════════════════════════════════════════════════════════════════════

export const searchForeignDonationsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Search text (amuta name or donor entity name, in Hebrew)"),
  registration_number: z
    .number()
    .int()
    .optional()
    .describe("Amuta registration number to get all its foreign donations"),
  year: z
    .number()
    .int()
    .optional()
    .describe("Filter by donation year (e.g. 2024)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Max results to return (default 20, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
});

export async function searchForeignDonations(
  args: z.infer<typeof searchForeignDonationsSchema>
): Promise<string> {
  if (!args.query && !args.registration_number && !args.year) {
    throw new Error("Provide at least one filter: query text, registration_number, or year.");
  }

  const filters: Record<string, string | number> = {};
  if (args.registration_number) {
    filters[DONATION_FIELDS.regNumber] = args.registration_number;
  }
  if (args.year) {
    filters[DONATION_FIELDS.year] = args.year;
  }

  const result = await datastoreSearch({
    resourceId: RESOURCES.foreignDonations,
    q: args.query,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    limit: args.limit,
    offset: args.offset,
    sort: `${DONATION_FIELDS.year} desc`,
  });
  return formatResults(result.result.records, result.result.total);
}

export const getAmutaDonationSummarySchema = z.object({
  registration_number: z
    .number()
    .int()
    .describe("Amuta registration number (starts with 58)"),
});

export async function getAmutaDonationSummary(
  args: z.infer<typeof getAmutaDonationSummarySchema>
): Promise<string> {
  const result = await datastoreSearch({
    resourceId: RESOURCES.foreignDonations,
    filters: { [DONATION_FIELDS.regNumber]: args.registration_number },
    limit: 100,
    sort: `${DONATION_FIELDS.year} desc`,
  });

  if (result.result.records.length === 0) {
    return `No foreign donations found for amuta ${args.registration_number}`;
  }

  const records = result.result.records.map(formatRecord);
  let totalILS = 0;
  const donors = new Set<string>();
  const years = new Set<number>();

  for (const r of result.result.records) {
    const amount = Number(r[DONATION_FIELDS.amountILS]) || 0;
    totalILS += amount;
    if (r[DONATION_FIELDS.donorEntity]) donors.add(String(r[DONATION_FIELDS.donorEntity]));
    if (r[DONATION_FIELDS.year]) years.add(Number(r[DONATION_FIELDS.year]));
  }

  const isTruncated = result.result.total > result.result.records.length;
  return JSON.stringify({
    total_donations: result.result.total,
    total_amount_ils: totalILS,
    unique_donors: donors.size,
    years_covered: [...years].sort((a, b) => b - a),
    showing: records.length,
    ...(isTruncated && { warning: `Only ${records.length} of ${result.result.total} donations fetched; totals are partial` }),
    donations: records,
  }, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW TOOLS: Proper Management Certificate (Nihul Takin)
// ═══════════════════════════════════════════════════════════════════════════

export const checkManagementCertificateSchema = z.object({
  registration_number: z
    .number()
    .int()
    .describe("Amuta registration number (starts with 58)"),
  year: z
    .number()
    .int()
    .optional()
    .describe("Specific year to check (omit for a page across years; this does not establish current validity)"),
  offset: z.number().int().min(0).default(0).describe("Offset for certificate-record pagination (50 per page)"),
});

export async function checkManagementCertificate(
  args: z.infer<typeof checkManagementCertificateSchema>
): Promise<string> {
  // Certificate resource stores registration number as text
  const regStr = String(args.registration_number);
  const filters: Record<string, string | number> = {
    [CERT_FIELDS.regNumber]: regStr,
  };
  if (args.year) {
    filters[CERT_FIELDS.year] = args.year;
  }

  const result = await datastoreSearch({
    resourceId: RESOURCES.managementCertificate,
    filters,
    limit: 50,
    offset: args.offset,
    sort: `${CERT_FIELDS.year} desc`,
  });

  if (result.result.records.length === 0) {
    return `No management certificate records on this page for ${regStr}${args.year ? ` in ${args.year}` : ""}. Extract absence does not establish current validity or invalidity; verify with the Registrar.`;
  }

  const records = result.result.records.map(formatRecord);
  return JSON.stringify({
    total: result.result.total,
    returned: records.length,
    offset: args.offset,
    has_more: args.offset + records.length < result.result.total,
    next_offset: args.offset + records.length < result.result.total ? args.offset + records.length : null,
    current_validity: "not established by these extract records",
    data_date: "not established; inspect source record year/date fields",
    note: "Registry extracts may lag. Confirm current certificate status with the Registrar; these records do not establish donation tax treatment.",
    records,
  }, null, 2);
}

export const searchCertificatesSchema = z.object({
  year: z
    .number()
    .int()
    .describe("Year to check certificates for (e.g. 2024)"),
  has_approval: z
    .string()
    .optional()
    .describe("Filter by approval status: 'נחתם אישור' (approved) or 'אין אישור' (not approved)"),
  query: z
    .string()
    .optional()
    .describe("Search by amuta name in Hebrew"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Max results to return (default 20, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
});

export async function searchCertificates(
  args: z.infer<typeof searchCertificatesSchema>
): Promise<string> {
  const filters: Record<string, string | number> = {
    [CERT_FIELDS.year]: args.year,
  };
  if (args.has_approval) {
    filters[CERT_FIELDS.hasApproval] = args.has_approval;
  }

  const result = await datastoreSearch({
    resourceId: RESOURCES.managementCertificate,
    q: args.query,
    filters,
    limit: args.limit,
    offset: args.offset,
  });
  return formatResults(result.result.records, result.result.total) + "\nCertificate extract records do not establish current validity or donation tax treatment. Confirm current status with the Registrar; inspect source record year/date fields.";
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW TOOLS: Public Benefit Companies (חל"צ)
// ═══════════════════════════════════════════════════════════════════════════

const PBC_SUMMARY_FIELDS = [
  PBC_FIELDS.regNumber,
  PBC_FIELDS.nameHe,
  PBC_FIELDS.nameEn,
  PBC_FIELDS.status,
  PBC_FIELDS.activityClass,
  PBC_FIELDS.city,
  PBC_FIELDS.regDate,
];

export const searchPublicBenefitCompanySchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Search text (Hebrew or English name)"),
  number: z
    .number()
    .int()
    .optional()
    .describe("Public benefit company registration number"),
  activity_type: z
    .string()
    .optional()
    .describe("Activity classification in Hebrew"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Max results to return (default 10, max 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
});

export async function searchPublicBenefitCompany(
  args: z.infer<typeof searchPublicBenefitCompanySchema>
): Promise<string> {
  if (!args.query && !args.number && !args.activity_type) {
    throw new Error("Provide at least one filter: query text, number, or activity_type.");
  }

  if (args.number) {
    const result = await datastoreSearch({
      resourceId: RESOURCES.publicBenefitCompanies,
      filters: { [PBC_FIELDS.regNumber]: args.number },
      limit: 1,
    });
    return formatResults(result.result.records, result.result.total);
  }

  const filters: Record<string, string> = {};
  if (args.activity_type) {
    filters[PBC_FIELDS.activityClass] = args.activity_type;
  }

  const result = await datastoreSearch({
    resourceId: RESOURCES.publicBenefitCompanies,
    q: args.query,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    fields: PBC_SUMMARY_FIELDS,
    limit: args.limit,
    offset: args.offset,
  });
  return formatResults(result.result.records, result.result.total);
}

export const getPublicBenefitCompanyDetailsSchema = z.object({
  registration_number: z
    .number()
    .int()
    .describe("Public benefit company registration number"),
});

export async function getPublicBenefitCompanyDetails(
  args: z.infer<typeof getPublicBenefitCompanyDetailsSchema>
): Promise<string> {
  const result = await datastoreSearch({
    resourceId: RESOURCES.publicBenefitCompanies,
    filters: { [PBC_FIELDS.regNumber]: args.registration_number },
    limit: 1,
  });

  if (result.result.records.length === 0) {
    return `No public benefit company found with registration number ${args.registration_number}`;
  }

  const record = formatRecord(result.result.records[0]);
  return JSON.stringify(record, null, 2);
}
