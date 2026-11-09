#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchAmuta,
  searchAmutaSchema,
  getAmutaDetails,
  getAmutaDetailsSchema,
  searchByActivity,
  searchByActivitySchema,
  getFinancialInfo,
  getFinancialInfoSchema,
  countAmutot,
  countAmutotSchema,
  searchForeignDonations,
  searchForeignDonationsSchema,
  getAmutaDonationSummary,
  getAmutaDonationSummarySchema,
  checkManagementCertificate,
  checkManagementCertificateSchema,
  searchCertificates,
  searchCertificatesSchema,
  searchPublicBenefitCompany,
  searchPublicBenefitCompanySchema,
  getPublicBenefitCompanyDetails,
  getPublicBenefitCompanyDetailsSchema,
} from "./tools.js";

const server = new McpServer({
  name: "israel-amutot-mcp",
  version: "2.0.0",
});

const TOOL_HINTS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

function toolHandler<T>(
  schema: { parse: (args: unknown) => T },
  handler: (args: T) => Promise<string>
) {
  return async (args: unknown) => {
    try {
      const result = await handler(schema.parse(args));
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
    }
  };
}

// ─── Amutot Registry Tools ──────────────────────────────────────────────────

server.tool(
  "search_amuta",
  "Search Israeli non-profit organizations (amutot) by name (Hebrew or English) or registration number. Returns matching organizations with key details including status, activity classification, and location.",
  searchAmutaSchema.shape,
  TOOL_HINTS,
  toolHandler(searchAmutaSchema, searchAmuta)
);

server.tool(
  "get_amuta_details",
  "Get full details of an Israeli non-profit organization (amuta) by its registration number. Returns all available fields including financials, employee count, volunteer count, goals, address, and activity classification.",
  getAmutaDetailsSchema.shape,
  TOOL_HINTS,
  toolHandler(getAmutaDetailsSchema, getAmutaDetails)
);

server.tool(
  "search_by_activity",
  "Search Israeli non-profit organizations (amutot) by activity classification type, optionally filtered by city. Activity types and city names should be in Hebrew.",
  searchByActivitySchema.shape,
  TOOL_HINTS,
  toolHandler(searchByActivitySchema, searchByActivity)
);

server.tool(
  "get_financial_info",
  "Get financial information for an Israeli non-profit organization (amuta) by registration number. Returns revenue, expenses, volunteer count, employee count, member count, and last reporting year.",
  getFinancialInfoSchema.shape,
  TOOL_HINTS,
  toolHandler(getFinancialInfoSchema, getFinancialInfo)
);

server.tool(
  "count_amutot",
  "Count Israeli non-profit organizations (amutot) matching optional filter criteria. Filters by status, activity type, and/or city. All filter values should be in Hebrew. Returns total count without fetching records.",
  countAmutotSchema.shape,
  TOOL_HINTS,
  toolHandler(countAmutotSchema, countAmutot)
);

// ─── Foreign Political Donations Tools ──────────────────────────────────────

server.tool(
  "search_foreign_donations",
  "Search donations from foreign political entities to Israeli amutot. Filter by amuta name, registration number, or donation year. Returns donor entity, amount in ILS, currency, purpose, and conditions. Data from the Corporations Authority mandatory disclosure reports.",
  searchForeignDonationsSchema.shape,
  TOOL_HINTS,
  toolHandler(searchForeignDonationsSchema, searchForeignDonations)
);

server.tool(
  "get_amuta_donation_summary",
  "Get a summary of all foreign political entity donations received by a specific amuta. Returns total amount, unique donors, years covered, and full donation list sorted by year. Useful for transparency research and due diligence.",
  getAmutaDonationSummarySchema.shape,
  TOOL_HINTS,
  toolHandler(getAmutaDonationSummarySchema, getAmutaDonationSummary)
);

// ─── Proper Management Certificate Tools ────────────────────────────────────

server.tool(
  "check_management_certificate",
  "Look up year-by-year Proper Management Certificate (Ishur Nihul Takin) records from the data.gov.il registry extract, with pagination. These records do not establish current validity or donation tax treatment. Extracts may lag; confirm current status with the Registrar.",
  checkManagementCertificateSchema.shape,
  TOOL_HINTS,
  toolHandler(checkManagementCertificateSchema, checkManagementCertificate)
);

server.tool(
  "search_certificates",
  "Search Proper Management Certificate extract records by year, optional approval-status text and amuta name. Reported approval is for the source record year; it does not establish current certificate validity or donation tax treatment.",
  searchCertificatesSchema.shape,
  TOOL_HINTS,
  toolHandler(searchCertificatesSchema, searchCertificates)
);

// ─── Public Benefit Company (חל"צ) Tools ────────────────────────────────────

server.tool(
  "search_public_benefit_company",
  "Search Israeli Public Benefit Companies (Chevra LeTovat HaTzibur / חל\"צ) by name, registration number, or activity type. These are companies registered under the Companies Law for public benefit purposes, distinct from amutot (registered under the Amutot Law).",
  searchPublicBenefitCompanySchema.shape,
  TOOL_HINTS,
  toolHandler(searchPublicBenefitCompanySchema, searchPublicBenefitCompany)
);

server.tool(
  "get_public_benefit_company_details",
  "Get full details of an Israeli Public Benefit Company (חל\"צ) by registration number. Returns goals, activity classification, financial data, employee and volunteer counts, activity regions, address, and audit dates.",
  getPublicBenefitCompanyDetailsSchema.shape,
  TOOL_HINTS,
  toolHandler(getPublicBenefitCompanyDetailsSchema, getPublicBenefitCompanyDetails)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("israel-amutot-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
