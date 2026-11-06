import type { Finding } from "@/applications/validation";

export type TextItem = { text: string; x: number; y: number; width: number };
export type PageText = { width: number; items: TextItem[] };
type Line = { text: string; x: number; end: number; segments: string[] };

const BULLETS = /^[•●○◦▪▫■□‣⁃∙⋅·◆◇►▶➢✓✔*-]/;
const DATE =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\b\d{1,2}\/\d{4}\b|\b(?:19|20)\d{2}\b/i;
const DATE_RANGE = new RegExp(
  `(?:${DATE.source})\\s*(?:–|—|-|to)\\s*(?:present|current|now|${DATE.source})`,
  "i",
);
const SEPARATOR = /\s(?:\||·|•|—|–)\s/g;
const CITY_START = /^[A-Z][a-zA-Z.'-]+(?: [A-Z][a-zA-Z.'-]+)*, ?[A-Z]{2}\b/;
const SECTION_WORDS = new Set([
  "experience",
  "education",
  "skills",
  "projects",
  "technology",
  "technologies",
  "summary",
  "objective",
  "certifications",
  "employment",
]);
const UNREADABLE = /[-�]/g;

export const loadPdfReader = () => import("unpdf");

export async function readPdf(file: File) {
  const { extractText, getDocumentProxy } = await loadPdfReader();
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const pages: PageText[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const { items } = await page.getTextContent();
    pages.push({
      width: page.getViewport({ scale: 1 }).width,
      items: items.flatMap((item) =>
        "str" in item && item.str
          ? [
              {
                text: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width,
              },
            ]
          : [],
      ),
    });
  }
  const { text } = await extractText(pdf, { mergePages: true });
  return { text, layout: layoutFindings(pages) };
}

function linesOf({ items, width }: PageText): Line[] {
  const rows: TextItem[][] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - item.y) < 2);
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows.map((row) => {
    const sorted = row.sort((a, b) => a.x - b.x);
    const segments: string[] = [];
    let text = "";
    let end = sorted[0].x;
    for (const item of sorted) {
      const gap = item.x - end;
      if (gap > width * 0.15) {
        segments.push(text.trim());
        text = "";
      } else if (gap > 1 && !/\s$/.test(text) && !/^\s/.test(item.text))
        text += " ";
      text += item.text;
      end = item.x + item.width;
    }
    segments.push(text.trim());
    return { text: segments.join(" ").trim(), x: sorted[0].x, end, segments };
  });
}

function leftMargin(lines: Line[]) {
  const counts = new Map<number, number>();
  for (const line of lines) {
    const x = Math.round(line.x);
    counts.set(x, (counts.get(x) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

const isAllCaps = (text: string) =>
  /[A-Z]/.test(text) && text === text.toUpperCase();
const words = (text: string) => text.split(/\s+/).filter(Boolean);
const clip = (text: string) =>
  text.length > 120 ? `${text.slice(0, 117)}…` : text;

export function layoutFindings(pages: PageText[]): Finding[] {
  const findings: Finding[] = [];
  const add = (
    severity: Finding["severity"],
    title: string,
    detail: string,
    example: string | null = null,
  ) => findings.push({ severity, title, detail, example });

  const pageLines = pages.map(linesOf);
  const lines = pageLines.flat().filter((line) => line.text);
  const allText = lines.map((line) => line.text).join("\n");

  if (allText.replace(/\s/g, "").length < 300) {
    add(
      "fix",
      "Almost no selectable text",
      "The PDF looks like an image, so an ATS reads little or nothing. Export it from your editor as a text PDF instead of scanning or printing to image.",
    );
    return findings;
  }

  const unreadable =
    lines
      .map((line) => line.text.replace(BULLETS, ""))
      .join("\n")
      .match(UNREADABLE)?.length ?? 0;
  if (unreadable > 3)
    add(
      "fix",
      `${unreadable} characters don't extract as text`,
      "Some symbols or fonts come out as blank boxes. Use a standard font like Arial, Calibri or Georgia and avoid icon fonts for phone and email.",
    );

  if (pages.length > 2)
    add(
      "consider",
      `${pages.length} pages`,
      "Most ATS read every page, but recruiters skim. Keep it to one or two pages.",
    );

  const twoColumn = pageLines.some(
    (page) =>
      page.filter(
        (line) =>
          line.segments.length > 1 &&
          line.segments.some((segment) => words(segment).length >= 3) &&
          !line.segments.some(
            (segment) => DATE.test(segment) || CITY_START.test(segment),
          ),
      ).length >= 5,
  );
  if (twoColumn)
    add(
      "fix",
      "Two-column layout",
      "Many parsers read straight across the page, mixing the two columns line by line. Use a single column.",
    );

  const margin = leftMargin(lines);
  const bulleted = lines.filter((line) => BULLETS.test(line.text)).length;
  const indented = lines.filter((line) => line.x > margin + 6).length;
  if (!bulleted && indented >= 4)
    add(
      "fix",
      "Bullet points aren't in the text",
      "Your bullets are drawn by the layout, so a parser can't tell where one point ends and the next begins, and may read a job's header line as a bullet. Type a real • character at the start of each point.",
    );

  const crowded = lines.filter(
    (line) =>
      DATE_RANGE.test(line.text) &&
      (line.text.replace(DATE_RANGE, "").match(SEPARATOR)?.length ?? 0) >= 2,
  );
  if (crowded.length)
    add(
      "fix",
      `Company, title and dates share one line (${crowded.length}×)`,
      "Rule-based parsers often can't split these apart and leave company, title and dates blank. Put the company on one line and the title with its dates on the next.",
      clip(crowded[0].text),
    );

  const header = lines.slice(0, 8);
  const fullWidth = (pages[0]?.width ?? 0) - margin - 30;
  header.forEach((line, index) => {
    const next = header[index + 1];
    const last = words(line.text).at(-1) ?? "";
    if (
      next &&
      line.end > fullWidth &&
      CITY_START.test(next.text) &&
      /^[A-Z][a-z]+$/.test(last) &&
      !line.text.endsWith(",")
    )
      add(
        "fix",
        "Your city name wraps onto the next line",
        "The parser reads the location from one line only, so it gets part of the city or none of it. Shorten the contact line or put your location first.",
        `${last} / ${next.text.split(/\s(?:\||·|•)\s/)[0]}`,
      );
  });

  const keywordStarts = lines.slice(3).filter((line) => {
    const [firstWord = "", ...rest] = words(line.text);
    return (
      SECTION_WORDS.has(firstWord.toLowerCase()) &&
      rest.length > 0 &&
      !firstWord.endsWith(":") &&
      !isAllCaps(line.text) &&
      words(line.text).length <= 8
    );
  });
  if (keywordStarts.length)
    add(
      "consider",
      "A line starts with a section name",
      "Some older parsers treat any line starting with Experience, Education, Skills or Technology as a new section and drop what follows. Reword the start of the line if you can.",
      clip(keywordStarts[0].text),
    );

  return findings;
}
