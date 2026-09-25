import { Person } from "./types";
import { createExportData, importFamilyTree, ImportResult } from "./json-schema";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const slug = (s: string) =>
  s.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "family-tree";

export function exportJson(people: Person[], treeName: string) {
  const data = { ...createExportData(people), name: treeName };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${slug(treeName)}-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function readImportFile(file: File): Promise<ImportResult & { name?: string }> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const result = importFamilyTree(json);
  const name = typeof (json as { name?: unknown })?.name === "string" ? (json as { name: string }).name : undefined;
  return { ...result, name };
}

export function pickFile(accept = ".json,application/json"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
