import { describe, expect, it } from "vite-plus/test";
import { layoutFindings, type TextItem } from "../src/web/resume-pdf";

const WIDTH = 612;
const BODY =
  "Built billing and invoicing features end to end in TypeScript and React for a growing product team.";

const item = (y: number, x: number, text: string): TextItem => ({
  text,
  x,
  y,
  width: text.length * 4.4,
});

function page(
  lines: Array<[number, string] | [number, string, number, string]>,
) {
  return {
    width: WIDTH,
    items: lines.flatMap(([x, text, rightX, right], index) => {
      const y = 750 - index * 13;
      return right && rightX
        ? [item(y, x, text), item(y, rightX, right)]
        : [item(y, x, text)];
    }),
  };
}

const header: Array<[number, string]> = [
  [36, "Alex Rivera"],
  [36, "Product Engineer"],
  [36, "Austin, TX | alex@example.com | (512) 555-0142"],
  [36, "EXPERIENCE"],
];

const titles = (lines: Parameters<typeof page>[0]) =>
  layoutFindings([page(lines)]).map((finding) => finding.title);

describe("PDF layout checks", () => {
  it("passes a single-column resume with typed bullets", () => {
    expect(
      titles([
        ...header,
        [36, "Acme Corp"],
        [36, "Product Engineer", 480, "Jan 2021 – Present"],
        ...Array.from({ length: 6 }, (): [number, string] => [36, `• ${BODY}`]),
      ]),
    ).toEqual([]);
  });

  it("passes right-aligned dates and cities and Word symbol bullets", () => {
    expect(
      titles([
        ...header,
        ...Array.from({ length: 3 }, (): Parameters<typeof page>[0] => [
          [36, "Acme Corporation", 480, "San Francisco, CA"],
          [36, "Senior Software Engineer", 480, "Jan 2021 – Present"],
          [36, ` ${BODY}`],
          [36, ` ${BODY}`],
        ]).flat(),
      ]),
    ).toEqual([]);
  });

  it("flags drawn bullets, crowded job lines, a wrapped city and section words", () => {
    const findings = layoutFindings([
      page([
        [36, "Alex Rivera"],
        [
          36,
          "(512) 555-0142 | alex@example.com | portfolio.alexrivera.dev | github.com/alexrivera | linkedin.com/in/alex-rivera | San",
        ],
        [36, "Antonio, TX (Remote)"],
        [36, "EXPERIENCE"],
        [36, "Acme Corp | Product Engineer | Jan 2021 – Present"],
        ...Array.from({ length: 3 }, (): [number, string] => [64, BODY]),
        [36, "Technology Specialist | Sep 2019 – Dec 2020"],
        ...Array.from({ length: 3 }, (): [number, string] => [64, BODY]),
      ]),
    ]);
    expect(findings).toEqual([
      expect.objectContaining({ title: "Bullet points aren't in the text" }),
      expect.objectContaining({
        title: "Company, title and dates share one line (1×)",
        example: "Acme Corp | Product Engineer | Jan 2021 – Present",
      }),
      expect.objectContaining({
        title: "Your city name wraps onto the next line",
        example: "San / Antonio, TX (Remote)",
      }),
      expect.objectContaining({
        severity: "consider",
        title: "A line starts with a section name",
      }),
    ]);
  });

  it("flags two columns by a shared start, not right-aligned details", () => {
    const right = (text: string) => 576 - text.length * 4.4;
    const rows = (pairs: Array<[string, string]>): Parameters<typeof page>[0] =>
      pairs.flatMap(([left, detail]) => [
        [36, left, right(detail), detail] as [number, string, number, string],
        [36, `• ${BODY}`] as [number, string],
      ]);
    expect(
      titles([
        ...header,
        ...rows([
          ["Technical University of Munich", "Munich, Germany"],
          ["Indian Institute of Science", "Bengaluru, India"],
          ["Amazon Web Services", "Remote"],
          ["Bank of America", "Charlotte, North Carolina"],
          ["University of Texas at Austin", "GPA: 3.9/4.0"],
          ["Tata Consultancy Services", "Hybrid"],
        ]),
      ]),
    ).toEqual([]);
    expect(
      titles([
        ...header,
        ...[
          "Kubernetes, Terraform and AWS",
          "Postgres and Redis caching",
          "React, Vite and Tailwind CSS",
          "Go services on GCP",
          "CI with GitHub Actions",
          "Grafana and Prometheus dashboards",
        ].map((skill): [number, string, number, string] => [
          36,
          "• Shipped features weekly",
          330,
          skill,
        ]),
      ]),
    ).toEqual(["Two-column layout"]);
    expect(
      titles([
        ...header,
        ...["TypeScript", "AWS", "Docker", "React", "Postgres", "Go"].map(
          (skill, index): [number, string, number, string] => [
            36,
            skill,
            200,
            `• ${BODY.slice(0, 40 + index * 7)}`,
          ],
        ),
      ]),
    ).toEqual(["Two-column layout"]);
  });

  it("flags a PDF with almost no text and stops there", () => {
    expect(titles([[36, "Alex Rivera"]])).toEqual([
      "Almost no selectable text",
    ]);
  });

  it("flags characters that don't extract and long resumes", () => {
    const body = page([
      ...header,
      [36, "    icons"],
      ...Array.from({ length: 6 }, (): [number, string] => [36, `• ${BODY}`]),
    ]);
    expect(
      layoutFindings([body, body, body]).map((finding) => finding.title),
    ).toEqual(["12 characters don't extract as text", "3 pages"]);
  });
});
