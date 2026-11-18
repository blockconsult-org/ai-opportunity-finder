export const TOOL_ID = "ai-opportunity-finder";
export const SCHEMA_VERSION = 1;
export const RUBRIC_VERSION = "1.0";
export const STORAGE_KEY = "blockconsult:ai-opportunity-finder:v1";
export type Locale = "en" | "de";
export type Text = { en: string; de: string };
export const t = (text: Text, locale: Locale) => text[locale];
export const functions = ["service", "finance", "sales", "operations", "people"] as const;
export const pains = ["repetition", "delays", "finding", "errors"] as const;
export const templateIds = ["enquiries", "invoices", "knowledge", "proposals", "reporting", "onboarding", "meetings", "classification", "custom"] as const;
export type TemplateId = typeof templateIds[number];
export type Answer = 0 | 1 | 2 | "unknown" | "na";
export const fields = ["frequency", "burden", "reach", "dependencies", "exceptions", "integration", "quality", "access", "consistency", "owner", "sensitivity", "actions", "consequence", "existing"] as const;
export type Field = typeof fields[number];
export const naFields: readonly Field[] = ["dependencies", "integration", "actions"];
export type Answers = Record<Field, Answer>;
export interface Candidate {
  id: string;
  template: TemplateId;
  name: string;
  ownerName: string;
  notes: string;
  evidence: string;
  task: "rules" | "language" | "mixed" | "unknown";
  answers: Answers;
}
export interface Model {
  tool: typeof TOOL_ID;
  schemaVersion: typeof SCHEMA_VERSION;
  methodologyVersion: typeof RUBRIC_VERSION;
  name: string;
  functions: (typeof functions[number])[];
  pains: (typeof pains[number])[];
  candidates: Candidate[];
}
export const unknownAnswers = (): Answers => Object.fromEntries(fields.map(key => [key, "unknown"])) as Answers;
export function emptyModel(): Model {
  return { tool: TOOL_ID, schemaVersion: SCHEMA_VERSION, methodologyVersion: RUBRIC_VERSION, name: "", functions: [], pains: [], candidates: [] };
}
export function newCandidate(template: TemplateId, id: string): Candidate {
  return { id, template, name: "", ownerName: "", notes: "", evidence: "", task: "unknown", answers: unknownAnswers() };
}
export type DataErrorCode = "invalid" | "version" | "tooLarge";
export class DataError extends Error {
  code: DataErrorCode;
  constructor(code: DataErrorCode) { super(code); this.code = code; }
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
function exact(v: Record<string, unknown>, keys: string[]) {
  if (Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) throw new DataError("invalid");
}
function enumList<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(v) || v.length > allowed.length || new Set(v).size !== v.length || v.some(x => !allowed.includes(x))) throw new DataError("invalid");
  return [...v] as T[];
}
export function validEvidence(value: string): boolean {
  if (!value) return true;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
/** Strict validation; never repair an untrusted scenario into a plausible one. */
export function validateModel(input: unknown): Model {
  if (!record(input) || input.tool !== TOOL_ID) throw new DataError("invalid");
  if (input.schemaVersion !== SCHEMA_VERSION || input.methodologyVersion !== RUBRIC_VERSION) throw new DataError("version");
  exact(input, ["tool", "schemaVersion", "methodologyVersion", "name", "functions", "pains", "candidates"]);
  if (!text(input.name, 100) || !Array.isArray(input.candidates) || input.candidates.length > 10) throw new DataError("invalid");
  const ids = new Set<string>();
  const candidates = input.candidates.map((c): Candidate => {
    if (!record(c)) throw new DataError("invalid");
    exact(c, ["id", "template", "name", "ownerName", "notes", "evidence", "task", "answers"]);
    if (typeof c.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(c.id) || ids.has(c.id)) throw new DataError("invalid");
    ids.add(c.id);
    if (!templateIds.includes(c.template as TemplateId) || !text(c.name, 100) || !text(c.ownerName, 100) || !text(c.notes, 1200) || !text(c.evidence, 500) || !validEvidence(c.evidence) || !["rules", "language", "mixed", "unknown"].includes(c.task as string) || !record(c.answers)) throw new DataError("invalid");
    exact(c.answers, [...fields]);
    const answers = {} as Answers;
    for (const key of fields) {
      const answer = c.answers[key];
      if (!(answer === 0 || answer === 1 || answer === 2 || answer === "unknown" || (answer === "na" && naFields.includes(key)))) throw new DataError("invalid");
      answers[key] = answer;
    }
    return { id: c.id, template: c.template as TemplateId, name: c.name, ownerName: c.ownerName, notes: c.notes, evidence: c.evidence, task: c.task as Candidate["task"], answers };
  });
  return { ...emptyModel(), name: input.name, functions: enumList(input.functions, functions), pains: enumList(input.pains, pains), candidates };
}
export const MAX_FILE_BYTES = 64_000;
export function parseModel(json: string): Model {
  if (new TextEncoder().encode(json).length > MAX_FILE_BYTES) throw new DataError("tooLarge");
  try { return validateModel(JSON.parse(json)); } catch (e) { if (e instanceof DataError) throw e; throw new DataError("invalid"); }
}
export function modelJson(model: Model) { return JSON.stringify(validateModel(model), null, 2); }
