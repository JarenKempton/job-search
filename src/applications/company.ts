import { z } from "zod";

const text = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();
const link = z.url().max(2000).nullable().optional();

export const companyProfileSchema = z.strictObject({
  tagline: text(160).describe(
    "One plain sentence on what the company does, such as 'Point-of-sale and hotel software for restaurants'.",
  ),
  about: text(2000).describe(
    "One or two short paragraphs: what the company makes or sells, who its customers are, and anything notable such as funding, ownership or mission.",
  ),
  website: link,
  linkedin: link.describe("The company's LinkedIn page URL"),
  size: text(40).describe("Employee count range, such as '11-50 employees'"),
  founded: z.number().int().min(1600).max(2100).nullable().optional(),
  industries: z
    .array(z.string().trim().min(1).max(40))
    .max(5)
    .optional()
    .describe("Up to five short industry labels, such as 'Hospitality'"),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

export const hasCompanyProfile = (profile: CompanyProfile | null) =>
  profile != null &&
  Object.values(profile).some((value) =>
    Array.isArray(value) ? value.length > 0 : value != null,
  );
