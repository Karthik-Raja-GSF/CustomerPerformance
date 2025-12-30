// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// This API client handled file upload and import history for SIQ Forecast Analysis data
/*
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8887";
const TOKEN_KEY = "id_token";

export interface ImportProgress {
  type: "validation" | "progress" | "complete" | "error";
  phase: "validating" | "processing" | "complete";
  current: number;
  total: number;
  percentage: number;
  message?: string;
  result?: ImportResult;
}

export interface ImportStats { ... }
export interface ImportResult { ... }
export interface ImportLog { ... }

export async function uploadSiqFile(file: File, importDate?: Date): Promise<ImportResult> { ... }
export async function getImportHistory(limit?: number): Promise<ImportLog[]> { ... }
export async function getImportById(id: string): Promise<ImportLog | null> { ... }
export async function uploadSiqFileWithProgress(
  file: File,
  importDate: Date | undefined,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> { ... }
*/

export {};
