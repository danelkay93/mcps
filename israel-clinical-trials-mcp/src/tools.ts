/**
 * Tool definitions and handlers for the Israel Clinical Trials MCP server.
 */

import { z } from "zod";
import { searchStudies, getStudyById, type Study, type Location, type StudyResponse, type DateStruct } from "./client.js";

// ── Formatting helpers ──

function trialLink(nctId: string): string {
  return `https://clinicaltrials.gov/study/${nctId}`;
}

// Keep the registry's ACTUAL/ESTIMATED marker; an actual date is not an estimate.
function datedField(struct?: DateStruct): string {
  if (!struct?.date) return "N/A";
  return struct.type ? `${struct.date} (${struct.type})` : struct.date;
}

function israeliSites(study: Study, facility?: string): Location[] {
  return (study.protocolSection.contactsLocationsModule?.locations ?? []).filter(
    (loc) => loc.country?.trim().toLowerCase() === "israel" &&
      (!facility || loc.facility?.toLowerCase().includes(facility.trim().toLowerCase()))
  );
}

function siteStatus(loc: Location): string {
  return loc.status?.trim().toUpperCase() || "UNKNOWN";
}

function formatStudySummary(study: Study, sites = israeliSites(study)): string {
  const id = study.protocolSection.identificationModule;
  const status = study.protocolSection.statusModule;
  const conditions = study.protocolSection.conditionsModule?.conditions ?? [];
  const sponsor = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor;
  const phases = study.protocolSection.designModule?.phases ?? [];

  const lines = [
    `## ${id.briefTitle}`,
    "",
    `- **NCT ID**: [${id.nctId}](${trialLink(id.nctId)})`,
    `- **Worldwide study status**: ${status.overallStatus}`,
    `- **Last update posted**: ${status.lastUpdatePostDateStruct?.date ?? "Unknown"}`,
    `- **Matching Israeli sites**: ${sites.map((loc) => `${loc.facility ?? "Unknown facility"} (${loc.city ?? "Unknown city"}): ${siteStatus(loc)}`).join("; ")}`,
    `- **Conditions**: ${conditions.length > 0 ? conditions.join(", ") : "N/A"}`,
    `- **Phases**: ${phases.length > 0 ? phases.join(", ") : "N/A"}`,
    `- **Sponsor**: ${sponsor ? `${sponsor.name} (${sponsor.class})` : "N/A"}`,
    `- **Start date**: ${datedField(status.startDateStruct)}`,
    `- **Primary completion**: ${datedField(status.primaryCompletionDateStruct)}`,
    `- **Study completion**: ${datedField(status.completionDateStruct)}`,
  ];

  return lines.join("\n");
}

function formatSearchPage(data: StudyResponse, title: string, recruitingOnly = false, facility?: string): string {
  if (!Array.isArray(data.studies)) throw new Error("ClinicalTrials.gov response is missing studies");
  const eligible: Study[] = [];
  const unknown: Study[] = [];
  for (const study of data.studies) {
    const sites = israeliSites(study, facility);
    if (!sites.length) continue;
    if (!recruitingOnly || sites.some((loc) => siteStatus(loc) === "RECRUITING")) eligible.push(study);
    else if (sites.some((loc) => siteStatus(loc) === "UNKNOWN")) unknown.push(study);
  }
  const upstreamCount = typeof data.totalCount === "number" && Number.isSafeInteger(data.totalCount) && data.totalCount >= 0
    ? data.totalCount : "unavailable";
  const lines = [
    `# ${title}`,
    `Upstream location-term matches (before local site filtering): ${upstreamCount}.`,
    `Upstream studies on this page: ${data.studies.length}; eligible on page: ${eligible.length}; additional studies with unknown local recruitment status: ${unknown.length}; returned: ${eligible.length + unknown.length}.`,
    `More upstream pages: ${Boolean(data.nextPageToken)}.`,
    ...(data.nextPageToken ? [`Next page_token: ${data.nextPageToken} (repeat the same filters).`] : []),
    "Counts describe this page and upstream candidates, not a total of eligible Israeli trials.",
  ];
  if (!eligible.length) lines.push("No eligible studies on this page; this does not establish that no matching trials exist.");
  for (const study of eligible) lines.push(formatStudySummary(study, israeliSites(study, facility)));
  if (unknown.length) {
    lines.push("## Israeli site recruitment status unknown — confirm with the site before relying on availability");
    for (const study of unknown) lines.push(formatStudySummary(study, israeliSites(study, facility)));
  }
  return lines.join("\n\n");
}

function formatStudyDetails(study: Study): string {
  const ps = study.protocolSection;
  const id = ps.identificationModule;
  const status = ps.statusModule;
  const desc = ps.descriptionModule;
  const conditions = ps.conditionsModule;
  const eligibility = ps.eligibilityModule;
  const design = ps.designModule;
  const interventions = ps.armsInterventionsModule?.interventions ?? [];
  const sponsor = ps.sponsorCollaboratorsModule;
  const israelLocations = israeliSites(study);

  const sections: string[] = [];

  // Header
  sections.push(`# ${id.briefTitle}`);
  sections.push("");
  if (id.officialTitle && id.officialTitle !== id.briefTitle) {
    sections.push(`**Official title**: ${id.officialTitle}`);
    sections.push("");
  }
  sections.push(`**NCT ID**: [${id.nctId}](${trialLink(id.nctId)})`);
  sections.push(`**Worldwide study status**: ${status.overallStatus}`);
  sections.push(`**Last update posted**: ${status.lastUpdatePostDateStruct?.date ?? "Unknown"}`);
  sections.push(`**Start date**: ${datedField(status.startDateStruct)}`);
  sections.push(`**Primary completion**: ${datedField(status.primaryCompletionDateStruct)}`);
  sections.push(`**Study completion**: ${datedField(status.completionDateStruct)}`);
  sections.push("");

  // Sponsor
  if (sponsor?.leadSponsor) {
    sections.push(`## Sponsor`);
    sections.push(
      `${sponsor.leadSponsor.name} (${sponsor.leadSponsor.class})`
    );
    if (sponsor.collaborators && sponsor.collaborators.length > 0) {
      sections.push(
        `**Collaborators**: ${sponsor.collaborators.map((c) => c.name).join(", ")}`
      );
    }
    sections.push("");
  }

  // Design
  if (design) {
    sections.push(`## Study Design`);
    sections.push(`- **Type**: ${design.studyType ?? "N/A"}`);
    sections.push(
      `- **Phases**: ${design.phases?.join(", ") ?? "N/A"}`
    );
    if (design.enrollmentInfo?.count) {
      sections.push(
        `- **Enrollment**: ${design.enrollmentInfo.count} (${design.enrollmentInfo.type ?? ""})`
      );
    }
    if (design.designInfo) {
      const di = design.designInfo;
      if (di.allocation) sections.push(`- **Allocation**: ${di.allocation}`);
      if (di.interventionModel)
        sections.push(`- **Model**: ${di.interventionModel}`);
      if (di.primaryPurpose)
        sections.push(`- **Purpose**: ${di.primaryPurpose}`);
      if (di.maskingInfo?.masking)
        sections.push(`- **Masking**: ${di.maskingInfo.masking}`);
    }
    sections.push("");
  }

  // Conditions
  if (conditions?.conditions && conditions.conditions.length > 0) {
    sections.push(`## Conditions`);
    sections.push(conditions.conditions.join(", "));
    sections.push("");
  }

  // Description
  if (desc?.briefSummary) {
    sections.push(`## Summary`);
    sections.push(desc.briefSummary);
    sections.push("");
  }
  if (desc?.detailedDescription) {
    sections.push(`## Detailed Description`);
    sections.push(desc.detailedDescription);
    sections.push("");
  }

  // Interventions
  if (interventions.length > 0) {
    sections.push(`## Interventions`);
    for (const intv of interventions) {
      sections.push(
        `- **${intv.name ?? "Unnamed"}** (${intv.type ?? "N/A"}): ${intv.description ?? "No description"}`
      );
    }
    sections.push("");
  }

  // Eligibility
  if (eligibility) {
    sections.push(`## Eligibility`);
    sections.push(`- **Sex**: ${eligibility.sex ?? "ALL"}`);
    if (eligibility.minimumAge)
      sections.push(`- **Min age**: ${eligibility.minimumAge}`);
    if (eligibility.maximumAge)
      sections.push(`- **Max age**: ${eligibility.maximumAge}`);
    if (eligibility.healthyVolunteers)
      sections.push(
        `- **Healthy volunteers**: ${eligibility.healthyVolunteers}`
      );
    if (eligibility.eligibilityCriteria) {
      sections.push("");
      sections.push("### Criteria");
      sections.push(eligibility.eligibilityCriteria);
    }
    sections.push("");
  }

  // Israeli locations
  if (israelLocations.length > 0) {
    sections.push(`## Israeli Sites (${israelLocations.length})`);
    for (const loc of israelLocations) {
      const contact = loc.contacts?.[0];
      const contactStr = contact
        ? ` | Contact: ${contact.name ?? ""}${contact.email ? ` (${contact.email})` : ""}${contact.phone ? ` ${contact.phone}` : ""}`
        : "";
      sections.push(
        `- **${loc.facility ?? "Unknown facility"}**, ${loc.city ?? "Unknown city"} [${siteStatus(loc)}]${contactStr}`
      );
    }
    sections.push("");
  }

  return sections.join("\n");
}

function formatLocations(nctId: string, locations: Location[]): string {
  if (locations.length === 0) {
    return `No Israeli sites found for trial ${nctId}.`;
  }

  const lines = [
    `# Israeli Sites for [${nctId}](${trialLink(nctId)})`,
    "",
    `**${locations.length} site(s) in Israel**`,
    "",
  ];

  for (const loc of locations) {
    lines.push(`## ${loc.facility ?? "Unknown facility"}`);
    lines.push(`- **City**: ${loc.city ?? "Unknown"}`);
    lines.push(`- **Site status**: ${siteStatus(loc)}`);
    if (loc.contacts && loc.contacts.length > 0) {
      for (const contact of loc.contacts) {
        const parts: string[] = [];
        if (contact.name) parts.push(contact.name);
        if (contact.role) parts.push(`(${contact.role})`);
        if (contact.email) parts.push(contact.email);
        if (contact.phone) parts.push(contact.phone);
        lines.push(`- **Contact**: ${parts.join(" ")}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Tool schemas ──

export const searchTrialsSchema = z.object({
  page_token: z.string().optional().describe("Upstream continuation token; keep all search filters unchanged"),
  query: z.string().optional().describe("General search term"),
  condition: z.string().optional().describe("Medical condition (e.g. cancer, diabetes)"),
  intervention: z
    .string()
    .optional()
    .describe("Drug or treatment name (e.g. pembrolizumab)"),
  status: z
    .enum([
      "RECRUITING",
      "ACTIVE_NOT_RECRUITING",
      "COMPLETED",
      "NOT_YET_RECRUITING",
    ])
    .optional()
    .describe("Worldwide status filter, except RECRUITING checks matching Israeli sites and separately reports unknown site status"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Upstream page size before local site filtering (default 10, max 50)"),
});

export const getTrialDetailsSchema = z.object({
  nct_id: z
    .string()
    .describe('NCT identifier (e.g. "NCT05659901")'),
});

export const findTrialsByHospitalSchema = z.object({
  page_token: z.string().optional().describe("Upstream continuation token; keep all search filters unchanged"),
  facility: z
    .string()
    .trim()
    .min(1)
    .describe(
      'Hospital or institution name (e.g. "Sheba", "Hadassah", "Ichilov", "Rambam")'
    ),
  status: z
    .enum([
      "RECRUITING",
      "ACTIVE_NOT_RECRUITING",
      "COMPLETED",
      "NOT_YET_RECRUITING",
    ])
    .optional()
    .describe("Worldwide status filter, except RECRUITING checks the matching Israeli facility and reports unknown site status separately"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Upstream page size before local site filtering (default 10, max 50)"),
});

export const listRecruitingTrialsSchema = z.object({
  page_token: z.string().optional().describe("Upstream continuation token; keep all search filters unchanged"),
  condition: z
    .string()
    .optional()
    .describe("Filter by medical condition"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Upstream page size before local site filtering (default 20, max 50)"),
});

export const getTrialLocationsSchema = z.object({
  nct_id: z
    .string()
    .describe('NCT identifier (e.g. "NCT05659901")'),
});

// ── Tool handlers ──

export async function handleSearchTrials(
  args: z.infer<typeof searchTrialsSchema>
): Promise<string> {
  const data = await searchStudies({
    query: args.query,
    condition: args.condition,
    intervention: args.intervention,
    status: args.status,
    limit: args.limit,
    pageToken: args.page_token,
  });
  return formatSearchPage(data, "Clinical Trials with Listed Israeli Sites", args.status === "RECRUITING");
}

export async function handleGetTrialDetails(
  args: z.infer<typeof getTrialDetailsSchema>
): Promise<string> {
  const study = await getStudyById(args.nct_id);
  return formatStudyDetails(study);
}

export async function handleFindTrialsByHospital(
  args: z.infer<typeof findTrialsByHospitalSchema>
): Promise<string> {
  const data = await searchStudies({
    facility: args.facility,
    status: args.status,
    limit: args.limit,
    pageToken: args.page_token,
  });
  return formatSearchPage(data, `Clinical Trials at ${args.facility}, Israel`, args.status === "RECRUITING", args.facility);
}

export async function handleListRecruitingTrials(
  args: z.infer<typeof listRecruitingTrialsSchema>
): Promise<string> {
  const data = await searchStudies({
    condition: args.condition,
    status: "RECRUITING",
    limit: args.limit,
    sort: "LastUpdatePostDate:desc",
    pageToken: args.page_token,
  });
  const condStr = args.condition ? ` for "${args.condition}"` : "";
  return formatSearchPage(data, `Israeli Site Recruitment${condStr} (most recently updated first)`, true);
}

export async function handleGetTrialLocations(
  args: z.infer<typeof getTrialLocationsSchema>
): Promise<string> {
  const study = await getStudyById(args.nct_id);
  return formatLocations(args.nct_id, israeliSites(study)) +
    `\nLast update posted: ${study.protocolSection.statusModule.lastUpdatePostDateStruct?.date ?? "Unknown"}.`;
}
