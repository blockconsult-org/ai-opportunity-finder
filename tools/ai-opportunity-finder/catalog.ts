import { type Field, type Text, type TemplateId, type Candidate, type Model, newCandidate, emptyModel } from "./model";
const pair = (en: string, de: string): Text => ({ en, de });
export const functionLabels = {
  service: pair("Customer service", "Kundenservice"), finance: pair("Finance", "Finanzen"), sales: pair("Sales", "Vertrieb"), operations: pair("Operations", "Betrieb"), people: pair("People", "Personal"),
};
export const painLabels = {
  repetition: pair("Repetitive work", "Wiederholte Arbeit"), delays: pair("Slow handovers", "Langsame Übergaben"), finding: pair("Hard-to-find knowledge", "Schwer auffindbares Wissen"), errors: pair("Avoidable errors", "Vermeidbare Fehler"),
};
export const taskLabels = {
  unknown: pair("Unknown", "Unbekannt"), rules: pair("Stable rules and structured data", "Feste Regeln und strukturierte Daten"), language: pair("Reading or drafting language", "Sprache verstehen oder entwerfen"), mixed: pair("A mix of rules and language", "Regeln und Sprache kombiniert"),
};
export const fieldCopy: Record<Field, { label: Text; anchors: [Text, Text, Text] }> = {
  frequency: { label: pair("How often does it happen?", "Wie oft fällt die Aufgabe an?"), anchors: [pair("Monthly or less", "Monatlich oder seltener"), pair("Weekly", "Wöchentlich"), pair("Daily", "Täglich")] },
  burden: { label: pair("Hands-on time per occurrence", "Arbeitszeit pro Vorgang"), anchors: [pair("Under 10 minutes", "Unter 10 Minuten"), pair("10–60 minutes", "10–60 Minuten"), pair("Over 60 minutes", "Über 60 Minuten")] },
  reach: { label: pair("People affected by the workflow", "Vom Workflow betroffene Personen"), anchors: [pair("1–2 people", "1–2 Personen"), pair("3–10 people", "3–10 Personen"), pair("More than 10 people", "Mehr als 10 Personen")] },
  dependencies: { label: pair("Systems involved", "Beteiligte Systeme"), anchors: [pair("One system", "Ein System"), pair("Two systems", "Zwei Systeme"), pair("Three or more systems", "Drei oder mehr Systeme")] },
  exceptions: { label: pair("Cases requiring an exception", "Fälle mit Ausnahmen"), anchors: [pair("Fewer than 10%", "Weniger als 10 %"), pair("10–30%", "10–30 %"), pair("More than 30%", "Mehr als 30 %")] },
  integration: { label: pair("Integration complexity", "Integrationsaufwand"), anchors: [pair("Built-in connector", "Vorhandener Konnektor"), pair("Supported API or file transfer", "Unterstützte API oder Dateiübertragung"), pair("Custom or legacy integration", "Individuelle oder alte Integration")] },
  quality: { label: pair("Source quality", "Qualität der Quellen"), anchors: [pair("Missing or unreliable", "Fehlend oder unzuverlässig"), pair("Usable with cleanup", "Nach Bereinigung nutzbar"), pair("Current and checked", "Aktuell und geprüft")] },
  access: { label: pair("Permission to use the sources", "Berechtigung zur Quellennutzung"), anchors: [pair("Denied or unresolved restriction", "Verweigert oder Einschränkung ungeklärt"), pair("Approval pending", "Freigabe ausstehend"), pair("Explicitly approved for this use", "Für diese Nutzung ausdrücklich freigegeben")] },
  consistency: { label: pair("Process consistency", "Prozesskonsistenz"), anchors: [pair("Varies; no agreed process", "Uneinheitlich; kein vereinbarter Prozess"), pair("Mostly repeatable", "Überwiegend wiederholbar"), pair("Documented and repeatable", "Dokumentiert und wiederholbar")] },
  owner: { label: pair("Accountable process owner", "Verantwortliche Prozessleitung"), anchors: [pair("No owner", "Keine verantwortliche Person"), pair("Proposed, not yet agreed", "Vorgeschlagen, noch nicht bestätigt"), pair("Named person has accepted", "Benannte Person hat zugesagt")] },
  sensitivity: { label: pair("Information sensitivity", "Sensibilität der Informationen"), anchors: [pair("Public or non-sensitive", "Öffentlich oder unbedenklich"), pair("Internal / ordinary personal data", "Intern / gewöhnliche Personendaten"), pair("Highly sensitive or restricted", "Hochsensibel oder eingeschränkt")] },
  actions: { label: pair("Actions beyond the team", "Aktionen ausserhalb des Teams"), anchors: [pair("Drafts only; no external action", "Nur Entwürfe; keine externe Aktion"), pair("Human approval before action", "Menschliche Freigabe vor der Aktion"), pair("Automatic external action", "Automatische externe Aktion")] },
  consequence: { label: pair("Consequence of an error", "Folgen eines Fehlers"), anchors: [pair("Minor and easy to reverse", "Gering und leicht rückgängig"), pair("Material but recoverable", "Erheblich, aber behebbar"), pair("Severe or hard to reverse", "Schwerwiegend oder schwer rückgängig")] },
  existing: { label: pair("Fit of software you already use", "Eignung bereits genutzter Software"), anchors: [pair("No suitable feature found", "Keine passende Funktion gefunden"), pair("Partially covers the need", "Deckt den Bedarf teilweise"), pair("Suitable feature is available", "Passende Funktion vorhanden")] },
};
export const groups: { title: Text; keys: Field[] }[] = [
  { title: pair("Value", "Nutzen"), keys: ["frequency", "burden", "reach"] },
  { title: pair("Effort", "Aufwand"), keys: ["dependencies", "exceptions", "integration"] },
  { title: pair("Readiness", "Bereitschaft"), keys: ["quality", "access", "consistency", "owner"] },
  { title: pair("Operating risk", "Betriebsrisiko"), keys: ["sensitivity", "actions", "consequence"] },
  { title: pair("Solution fit", "Lösungsansatz"), keys: ["existing"] },
];
export const templates: Record<TemplateId, { title: Text; description: Text; fn: Model["functions"][number]; pain: Model["pains"][number]; metric: Text }> = {
  enquiries: { title: pair("Enquiry triage", "Anfragen zuordnen"), description: pair("Route incoming questions and prepare a reviewed response.", "Eingehende Fragen zuordnen und geprüfte Antworten vorbereiten."), fn: "service", pain: "delays", metric: pair("Median time to a correct first response; track incorrect routing.", "Median bis zur korrekten Erstantwort; Fehlzuordnungen erfassen.") },
  invoices: { title: pair("Invoice handling", "Rechnungen bearbeiten"), description: pair("Extract invoice details and flag exceptions before approval.", "Rechnungsdaten erfassen und Ausnahmen vor der Freigabe markieren."), fn: "finance", pain: "errors", metric: pair("Minutes per correctly processed invoice; track correction rate.", "Minuten pro korrekt verarbeiteter Rechnung; Korrekturquote erfassen.") },
  knowledge: { title: pair("Internal knowledge search", "Internes Wissen finden"), description: pair("Find answers with references in approved internal sources.", "Antworten mit Belegen in freigegebenen internen Quellen finden."), fn: "operations", pain: "finding", metric: pair("Time to a verified answer; track unsupported answers.", "Zeit bis zur verifizierten Antwort; unbelegte Antworten erfassen.") },
  proposals: { title: pair("Proposal drafting", "Angebote entwerfen"), description: pair("Build a first draft from approved examples and requirements.", "Erstentwürfe aus freigegebenen Beispielen und Anforderungen erstellen."), fn: "sales", pain: "repetition", metric: pair("Time to an approved draft; track factual corrections.", "Zeit bis zum freigegebenen Entwurf; sachliche Korrekturen erfassen.") },
  reporting: { title: pair("Recurring reporting", "Regelmässige Berichte"), description: pair("Assemble recurring reports from agreed sources.", "Wiederkehrende Berichte aus vereinbarten Quellen zusammenstellen."), fn: "finance", pain: "repetition", metric: pair("Time to a reconciled report; track reconciliation errors.", "Zeit bis zum abgestimmten Bericht; Abstimmungsfehler erfassen.") },
  onboarding: { title: pair("Employee onboarding", "Mitarbeitende einarbeiten"), description: pair("Coordinate checklists, access requests and useful guidance.", "Checklisten, Zugriffsanfragen und hilfreiche Anleitungen koordinieren."), fn: "people", pain: "delays", metric: pair("Days to complete required onboarding; track missed steps.", "Tage bis zum vollständigen Onboarding; ausgelassene Schritte erfassen.") },
  meetings: { title: pair("Meeting follow-up", "Besprechungen nachbereiten"), description: pair("Turn approved notes into reviewed actions and owners.", "Freigegebene Notizen in geprüfte Aufgaben mit Verantwortlichen überführen."), fn: "operations", pain: "repetition", metric: pair("Minutes to a verified action list; track omitted or wrong actions.", "Minuten bis zur geprüften Aufgabenliste; fehlende oder falsche Aufgaben erfassen.") },
  classification: { title: pair("Document classification", "Dokumente klassifizieren"), description: pair("Sort incoming documents into agreed categories for review.", "Eingehende Dokumente zur Prüfung in vereinbarte Kategorien einordnen."), fn: "operations", pain: "errors", metric: pair("Correctly classified documents per hour; track misclassification rate.", "Korrekt klassifizierte Dokumente pro Stunde; Fehlklassifikationen erfassen.") },
  custom: { title: pair("Custom workflow", "Eigener Workflow"), description: pair("Assess a workflow from your own team.", "Einen Workflow aus Ihrem Team bewerten."), fn: "operations", pain: "repetition", metric: pair("Time per correctly completed case; track rework and error rate.", "Zeit pro korrekt abgeschlossenem Fall; Nacharbeit und Fehlerquote erfassen.") },
};
export function candidateName(c: Candidate, locale: "en" | "de") { return c.name.trim() || templates[c.template].title[locale]; }
export const presetNames = [pair("Studio North · 18-person agency", "Studio Nord · Agentur mit 18 Personen"), pair("Cedar Services · 45-person office", "Cedar Services · Büro mit 45 Personen"), pair("Harbour Supply · 80-person distributor", "Hafen Supply · Handel mit 80 Personen")];
export function preset(index: number): Model {
  const model = emptyModel();
  model.functions = index === 0 ? ["sales", "operations"] : index === 1 ? ["finance", "people"] : ["service", "operations"];
  model.pains = ["repetition", "delays"];
  const ids: TemplateId[] = index === 0 ? ["proposals", "meetings", "knowledge"] : index === 1 ? ["invoices", "reporting", "onboarding"] : ["enquiries", "classification", "knowledge"];
  model.candidates = ids.map((template, i) => {
    const c = newCandidate(template, `preset-${index}-${i}`);
    c.task = ["invoices", "reporting", "onboarding"].includes(template) ? "rules" : "language";
    c.answers = { frequency: 2, burden: i === 1 ? 1 : 2, reach: 1, dependencies: 0, exceptions: 0, integration: 0, quality: 2, access: 2, consistency: 2, owner: 2, sensitivity: 1, actions: 0, consequence: 1, existing: i === 1 ? 2 : 0 };
    if (i === 2) c.answers = { ...c.answers, access: index === 2 ? 0 : "unknown", quality: 1, owner: 1, dependencies: 2, integration: 2 };
    return c;
  });
  return model;
}
