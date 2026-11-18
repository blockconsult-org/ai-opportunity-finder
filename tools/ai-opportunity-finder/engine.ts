import { fields, type Candidate, type Model, type Field, type Text, type Locale, RUBRIC_VERSION } from "./model";
import { candidateName, templates, fieldCopy, taskLabels, functionLabels, painLabels } from "./catalog";
export type Approach = "process" | "existing" | "automation" | "ai" | "investigate";
export const approaches: Record<Approach, Text> = {
  process: { en: "Improve the process", de: "Prozess verbessern" }, existing: { en: "Configure existing software", de: "Vorhandene Software konfigurieren" }, automation: { en: "Use conventional automation", de: "Klassische Automatisierung nutzen" }, ai: { en: "Add AI assistance", de: "KI-Unterstützung ergänzen" }, investigate: { en: "Investigate further", de: "Weiter untersuchen" },
};
export const gateCopy = {
  access: { en: "Obtain explicit source-use approval before any live pilot.", de: "Vor jedem Live-Pilot die ausdrückliche Freigabe zur Quellennutzung einholen." },
  owner: { en: "Name an accountable owner and confirm their acceptance.", de: "Eine verantwortliche Person benennen und ihre Zusage bestätigen." },
  quality: { en: "Repair or verify the source material before use.", de: "Quellen vor der Nutzung verbessern oder prüfen." },
  consistency: { en: "Agree a repeatable process and exception handling.", de: "Einen wiederholbaren Prozess und den Umgang mit Ausnahmen vereinbaren." },
  risk: { en: "Resolve high or unknown operating risk; require human review and a control review.", de: "Hohes oder unbekanntes Betriebsrisiko klären; menschliche Prüfung und Kontrollprüfung vorsehen." },
  evidence: { en: "Answer the open assessment questions before choosing a live pilot.", de: "Offene Bewertungsfragen vor der Wahl eines Live-Piloten beantworten." },
} satisfies Record<string, Text>;
export type Gate = keyof typeof gateCopy;
export interface Assessment {
  candidate: Candidate;
  value: number;
  effort: number;
  readiness: number;
  risk: number;
  completeness: number;
  priority: number;
  unknown: (Field | "task")[];
  blockers: Gate[];
  pilotEligible: boolean;
  approach: Approach;
  contributions: { field: Field; answer: Candidate["answers"][Field]; points: number }[];
}
const valueFields: Field[] = ["frequency", "burden", "reach"];
const effortFields: Field[] = ["dependencies", "exceptions", "integration"];
const readinessFields: Field[] = ["quality", "access", "consistency", "owner"];
const riskFields: Field[] = ["sensitivity", "actions", "consequence"];
export function assess(candidate: Candidate): Assessment {
  const a = candidate.answers;
  const points = (key: Field) => typeof a[key] === "number" ? a[key] : a[key] === "na" ? 0 : effortFields.includes(key) || riskFields.includes(key) ? 2 : 0;
  const score = (keys: Field[]) => Math.round(keys.reduce((sum, key) => sum + points(key), 0) / (keys.length * 2) * 100);
  const unknown: Assessment["unknown"] = fields.filter(key => a[key] === "unknown");
  if (candidate.task === "unknown") unknown.push("task");
  const blockers: Gate[] = [];
  if (a.access !== 2) blockers.push("access");
  if (a.owner !== 2) blockers.push("owner");
  if (a.quality === 0 || a.quality === "unknown") blockers.push("quality");
  if (a.consistency === 0 || a.consistency === "unknown" || a.exceptions === 2 || a.exceptions === "unknown") blockers.push("consistency");
  if (riskFields.some(key => a[key] === 2 || a[key] === "unknown")) blockers.push("risk");
  if (unknown.length) blockers.push("evidence");
  const pilotEligible = blockers.length === 0;
  const value = score(valueFields), effort = score(effortFields), readiness = score(readinessFields), risk = score(riskFields);
  const approach: Approach = a.consistency === 0 || a.exceptions === 2 || a.quality === 0 ? "process" : !pilotEligible ? "investigate" : a.existing === 2 ? "existing" : candidate.task === "rules" ? "automation" : "ai";
  return { candidate, value, effort, readiness, risk, completeness: Math.round((15 - unknown.length) / 15 * 100), priority: Math.round(.45 * value + .25 * (100 - effort) + .30 * readiness), unknown, blockers, pilotEligible, approach, contributions: fields.map(field => ({ field, answer: a[field], points: points(field) })) };
}
/** Pilot eligibility first; then planning score; then immutable ASCII id. */
export function rank(model: Model): Assessment[] {
  return model.candidates.map(assess).sort((a, b) => Number(b.pilotEligible) - Number(a.pilotEligible) || b.priority - a.priority || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0));
}
export function answerLabel(field: Field, value: Candidate["answers"][Field], locale: Locale) {
  return value === "unknown" ? (locale === "de" ? "Unbekannt" : "Unknown") : value === "na" ? (locale === "de" ? "Nicht zutreffend (kein Aufwand / keine Aktion)" : "Not applicable (no effort / no action)") : fieldCopy[field].anchors[value][locale];
}
export function explain(result: Assessment, locale: Locale) {
  const de = locale === "de";
  const a = result.candidate.answers;
  const reasons = [
    `${de ? "Nutzenbasis" : "Value basis"}: ${["frequency", "burden", "reach"].map(key => answerLabel(key as Field, a[key as Field], locale)).join(" · ")}.`,
    `${de ? "Aufwandsbasis" : "Effort basis"}: ${["dependencies", "exceptions", "integration"].map(key => answerLabel(key as Field, a[key as Field], locale)).join(" · ")}.`,
    result.pilotEligible ? (de ? "Freigegebene Quellen, bestätigte Verantwortung und keine kritische Risikostufe angegeben. Vor dem Pilot verifizieren." : "Approved sources, accepted ownership and no critical risk level reported. Verify these before the pilot.") : (de ? "Voraussetzungen sind offen; die Position ist vorläufig und kein Auftrag zum Live-Pilot." : "Prerequisites remain open; this position is provisional and does not recommend a live pilot."),
  ];
  const fit: Record<Approach, Text> = {
    process: { en: "Unreliable inputs or inconsistent steps need process work first.", de: "Unzuverlässige Eingaben oder uneinheitliche Schritte erfordern zuerst Prozessarbeit." },
    existing: { en: "A suitable feature is already available in your software.", de: "Eine passende Funktion ist in Ihrer Software bereits vorhanden." },
    automation: { en: "Stable rules and structured data favour conventional automation.", de: "Feste Regeln und strukturierte Daten sprechen für klassische Automatisierung." },
    ai: { en: "Language work can benefit from assistance with human review.", de: "Spracharbeit kann von Unterstützung mit menschlicher Prüfung profitieren." },
    investigate: { en: "Clarify evidence and controls before selecting a technology.", de: "Belege und Kontrollen vor der Technologiewahl klären." },
  };
  reasons.push(fit[result.approach][locale]);
  const questions = result.unknown.map(key => key === "task" ? (de ? "Welche Art von Aufgabe liegt vor?" : "What kind of task is this?") : `${fieldCopy[key].label[locale]}?`.replace(/\?\?$/, "?"));
  const prerequisites = result.blockers.map(key => gateCopy[key][locale]);
  if (!prerequisites.length) prerequisites.push(de ? "Freigaben und Zuständigkeit dokumentieren; Ausgangswert, menschliche Prüfung und Abbruchkriterium festlegen." : "Record approvals and ownership; establish a baseline, human review and a stop criterion.");
  const roadmap = result.pilotEligible ? [
    de ? "Tage 1–30: Freigaben und Verantwortung verifizieren. 20 repräsentative Fälle prüfen, Ausgangswert messen und Erfolgskriterium mit der verantwortlichen Person vereinbaren." : "Days 1–30: Verify approvals and ownership. Review 20 representative cases, measure the baseline and agree a success threshold with the owner.",
    de ? "Tage 31–60: Erst nach dokumentierter Freigabe einen begrenzten, menschlich geprüften Pilot durchführen. Fehler und Nacharbeit gegen den Ausgangswert messen." : "Days 31–60: Only after recorded approval, run a bounded pilot with human review. Measure errors and rework against the baseline.",
    de ? "Tage 61–90: Ergebnisse prüfen. Nur bei erreichtem Erfolgskriterium, tragbarer Fehlerquote und Freigabe ausweiten; sonst anpassen oder stoppen." : "Days 61–90: Review results. Expand only with the agreed success threshold met, acceptable errors and approval; otherwise revise or stop.",
  ] : [
    `${de ? "Tage 1–30" : "Days 1–30"}: ${prerequisites.join(" ")}`,
    de ? "Tage 31–60: Offene Fragen anhand von Belegen klären. Prozess und Kontrollen mit synthetischen Beispielen prüfen; kein Live-Pilot." : "Days 31–60: Resolve open questions with evidence. Check the process and controls using synthetic examples; no live pilot.",
    de ? "Tage 61–90: Bewertung mit verifizierten Antworten wiederholen. Erst nach geklärtem Zugriff, Verantwortung und Risiken eine Pilotentscheidung treffen." : "Days 61–90: Repeat the assessment with verified answers. Decide on a pilot only after access, ownership and risks are resolved.",
  ];
  return { reasons, questions, prerequisites, roadmap, metric: templates[result.candidate.template].metric[locale] };
}
export const assumptions: Text = {
  en: "Illustrative rubric, not a validated benchmark or professional audit. Answers are self-reported, not verified. All answers have equal weight within each dimension. No monetary savings are estimated. The 20-case baseline and 30/60/90-day plan are starting assumptions, not delivery commitments.",
  de: "Illustrative Bewertungslogik, kein validierter Benchmark und kein professionelles Audit. Angaben sind selbst berichtet und ungeprüft. Antworten innerhalb einer Dimension sind gleich gewichtet. Keine geschätzten Geldeinsparungen. Die 20 Fälle und der 30/60/90-Tage-Plan sind Startannahmen, keine Lieferzusagen.",
};
export function buildReport(model: Model, locale: Locale) {
  return {
    tool: locale === "de" ? "KI-Chancenfinder" : "AI Opportunity Finder",
    rubric: RUBRIC_VERSION,
    scenario: model.name || (locale === "de" ? "Unbenanntes Szenario" : "Untitled scenario"),
    assumptions: assumptions[locale],
    basis: [...model.functions.map(key => functionLabels[key][locale]), ...model.pains.map(key => painLabels[key][locale])].join(" · "),
    ranked: rank(model).map((result, index) => ({ ...result, rank: index + 1, name: candidateName(result.candidate, locale), approachLabel: approaches[result.approach][locale], ...explain(result, locale), inputBasis: [...fields.map(key => `${fieldCopy[key].label[locale]}: ${answerLabel(key, result.candidate.answers[key], locale)}`), `${locale === "de" ? "Aufgabentyp" : "Task type"}: ${taskLabels[result.candidate.task][locale]}`] })),
  };
}
