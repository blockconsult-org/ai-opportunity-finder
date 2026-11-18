import { DataError, MAX_FILE_BYTES, STORAGE_KEY, modelJson, parseModel, validateModel, type Model } from "./model";
export const HASH_PREFIX = "#aof=v1.";
export const MAX_ENCODED = 24_000;
export const MAX_DECODED = 18_000;
/** IDs are structural; replace them too so authored identifiers never leak by default. */
export function shareModel(model: Model, includeText = false): Model {
  const checked = validateModel(model);
  if (includeText) return checked;
  // Sorted IDs preserve tie-breaking when replacing arbitrary imported identifiers.
  const ids = [...checked.candidates.map(c => c.id)].sort();
  return { ...checked, name: "", candidates: checked.candidates.map(c => ({ ...c, id: `workflow-${String(ids.indexOf(c.id)).padStart(2, "0")}`, name: "", ownerName: "", notes: "", evidence: "" })) };
}
export function encodeShare(model: Model, includeText = false): string {
  const bytes = new TextEncoder().encode(JSON.stringify(shareModel(model, includeText)));
  if (bytes.length > MAX_DECODED) throw new DataError("tooLarge");
  const payload = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (payload.length > MAX_ENCODED) throw new DataError("tooLarge");
  return HASH_PREFIX + payload;
}
export function decodeShare(hash: string): Model {
  if (!hash.startsWith(HASH_PREFIX)) throw new DataError("version");
  const encoded = hash.slice(HASH_PREFIX.length);
  if (encoded.length > MAX_ENCODED) throw new DataError("tooLarge");
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new DataError("invalid");
  try {
    const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
    if (binary.length > MAX_DECODED) throw new DataError("tooLarge");
    return parseModel(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, ch => ch.charCodeAt(0))));
  } catch (e) { if (e instanceof DataError) throw e; throw new DataError("invalid"); }
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
export function saveLocal(storage: StorageLike, model: Model) { storage.setItem(STORAGE_KEY, modelJson(model)); }
export function loadLocal(storage: StorageLike) { const value = storage.getItem(STORAGE_KEY); return value === null ? null : parseModel(value); }
export function deleteLocal(storage: StorageLike) { storage.removeItem(STORAGE_KEY); }
export async function importFile(file: Pick<File, "size" | "text">): Promise<Model> {
  if (file.size > MAX_FILE_BYTES) throw new DataError("tooLarge");
  return parseModel(await file.text());
}
