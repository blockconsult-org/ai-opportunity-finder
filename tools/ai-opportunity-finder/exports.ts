import { buildReport } from "./engine";
import { type Locale, type Model } from "./model";
export function summaryLines(model: Model, locale: Locale): string[] {
  const report = buildReport(model, locale), de = locale === "de";
  return [
    `BLOCK CONSULT · ${report.tool}`, report.scenario,
    `${de ? "Bewertungslogik" : "Rubric"} ${report.rubric} · ${de ? "Eingabebasis" : "Input basis"}: ${report.basis || "—"}`,
    report.assumptions,
    de ? "Vorläufige Positionen: Unbekannt = 0 bei Nutzen/Bereitschaft, 2 bei Aufwand/Risiko. Werte 0–100. Berechtigte Piloten zuerst; dann 45 % Nutzen + 25 % geringer Aufwand + 30 % Bereitschaft; Gleichstand nach ID." : "Provisional positions: unknown = 0 for value/readiness, 2 for effort/risk. Scores 0–100. Eligible pilots first; then 45% value + 25% low effort + 30% readiness; ties by ID.",
    ...report.ranked.slice(0, 3).flatMap(r => [
      `${r.rank}. ${r.name} — ${r.approachLabel}`,
      `${de ? "Nutzen / Aufwand / Bereitschaft / Risiko" : "Value / effort / readiness / risk"}: ${r.value} / ${r.effort} / ${r.readiness} / ${r.risk} · ${r.completeness}% ${de ? "beantwortet" : "answered"} · ${r.pilotEligible ? (de ? "Pilot nach Verifizierung" : "Pilot after verification") : (de ? "Kein Live-Pilot" : "No live pilot")}`,
      ...r.reasons,
      `${de ? "Voraussetzungen" : "Prerequisites"}: ${r.prerequisites.join(" ")}`,
      `${de ? "Offene Fragen" : "Open questions"}: ${r.questions.join(" ") || (de ? "Keine unbekannten Antworten; Angaben verifizieren." : "No unknown answers; verify the claims.")}`,
      `${de ? "Pilotkennzahl" : "Pilot metric"}: ${r.metric}`,
      ...r.roadmap,
      `${de ? "Eingabebasis" : "Input basis"}: ${r.inputBasis.join("; ")}`,
    ]),
    ...(!report.ranked.length ? [de ? "Noch keine Workflows bewertet." : "No workflows assessed yet."] : []),
    "blockconsult.org · /tools/ai-opportunity-finder",
  ];
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** A typeset, theme-independent rendering of the exact same report text. */
export async function summaryPng(model: Model, locale: Locale): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  const width = 1400, margin = 64;
  const paragraphs = summaryLines(model, locale);
  const rows: { text: string; y: number; font: string; color: string; divider: boolean }[] = [];
  let y = margin;
  paragraphs.forEach((paragraph, index) => {
    const heading = /^\d+\. /.test(paragraph);
    const basis = /^(Input basis|Eingabebasis):/.test(paragraph);
    const metric = /^(Value \/ effort|Nutzen \/ Aufwand)/.test(paragraph);
    const size = index === 0 ? 34 : index === 1 ? 28 : heading ? 28 : basis ? 18 : 21;
    const font = `${index < 2 || heading || metric ? "600" : "400"} ${size}px Arial, sans-serif`;
    const color = index === 0 || heading ? "#193457" : index < 2 || metric ? "#0b0d10" : "#4d535c";
    if (heading) y += 32;
    context.font = font;
    let line = "", first = true;
    const push = () => {
      rows.push({ text: line, y, font, color, divider: heading && first });
      first = false; y += size * 1.5; line = "";
    };
    // Character fallback also bounds long names/URLs without spaces.
    for (const word of paragraph.split(/\s+/)) {
      if (context.measureText(`${line} ${word}`).width > width - 2 * margin && line) push();
      for (const char of (line ? " " : "") + word) {
        if (context.measureText(line + char).width > width - 2 * margin) push();
        line += char;
      }
    }
    push(); y += index < 2 || heading ? 18 : 12;
  });
  canvas.width = width; canvas.height = Math.ceil(y + margin);
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#193457"; context.fillRect(0, 0, width, 10);
  context.textBaseline = "top";
  for (const row of rows) {
    if (row.divider) { context.fillStyle = "#cdd3db"; context.fillRect(margin, row.y - 20, width - 2 * margin, 1); }
    context.fillStyle = row.color; context.font = row.font;
    context.fillText(row.text, margin, row.y);
  }
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("png")), "image/png"));
}
