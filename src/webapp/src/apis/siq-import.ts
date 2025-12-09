/**
 * SIQ Import API Client
 *
 * Handles file upload and import history for SIQ Forecast Analysis data
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8887";
const TOKEN_KEY = "id_token";

/**
 * Progress update during import
 */
export interface ImportProgress {
  type: "validation" | "progress" | "complete" | "error";
  phase: "validating" | "processing" | "complete";
  current: number;
  total: number;
  percentage: number;
  message?: string;
  result?: ImportResult;
}

export interface ImportStats {
  rowsProcessed: number;
  sitesCreated: number;
  sitesUpdated: number;
  suppliersCreated: number;
  suppliersUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped: number;
  inventorySnapshotsCreated: number;
  inventorySnapshotsSkipped: number;
  salesActualsCreated: number;
  salesActualsUpdated: number;
  salesActualsSkipped: number;
  forecastsCreated: number;
  forecastsUpdated: number;
  forecastsSkipped: number;
  customerMetricsCreated: number;
  customerMetricsSkipped: number;
}

export interface ImportResult {
  importId: string;
  status: "COMPLETED" | "FAILED";
  stats: ImportStats;
  errors?: string[];
  completedAt: string;
}

export interface ImportLog {
  id: string;
  fileName: string;
  importDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  rowsProcessed: number | null;
  rowsCreated: number | null;
  rowsUpdated: number | null;
  rowsFailed: number | null;
  errorLog: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ApiResponse<T> {
  status: "success" | "error";
  data?: T;
  message?: string;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Upload an Excel file for SIQ import
 */
export async function uploadSiqFile(
  file: File,
  importDate?: Date
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  if (importDate) {
    formData.append("importDate", importDate.toISOString());
  }

  const response = await fetch(`${API_BASE_URL}/siq-import/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  const result: ApiResponse<ImportResult> = await response.json();

  if (!response.ok || result.status === "error") {
    throw new Error(result.message || "Failed to upload file");
  }

  return result.data!;
}

/**
 * Get import history
 */
export async function getImportHistory(
  limit: number = 50
): Promise<ImportLog[]> {
  const response = await fetch(
    `${API_BASE_URL}/siq-import/history?limit=${limit}`,
    {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    }
  );

  const result: ApiResponse<ImportLog[]> = await response.json();

  if (!response.ok || result.status === "error") {
    throw new Error(result.message || "Failed to fetch import history");
  }

  return result.data!;
}

/**
 * Get a specific import by ID
 */
export async function getImportById(id: string): Promise<ImportLog | null> {
  const response = await fetch(`${API_BASE_URL}/siq-import/${id}`, {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  const result: ApiResponse<ImportLog> = await response.json();

  if (!response.ok || result.status === "error") {
    throw new Error(result.message || "Failed to fetch import");
  }

  return result.data!;
}

/**
 * Upload an Excel file for SIQ import with progress updates via SSE
 */
export async function uploadSiqFileWithProgress(
  file: File,
  importDate: Date | undefined,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  if (importDate) {
    formData.append("importDate", importDate.toISOString());
  }

  const response = await fetch(`${API_BASE_URL}/siq-import/upload-stream`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to start upload");
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: ImportResult | null = null;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        try {
          const progress: ImportProgress = JSON.parse(data);
          onProgress(progress);

          // Store final result if this is the complete event
          if (progress.type === "complete" && progress.result) {
            finalResult = progress.result;
          }
        } catch {
          console.warn("Failed to parse SSE data:", data);
        }
      }
    }
  }

  if (!finalResult) {
    throw new Error("Import did not return a result");
  }

  return finalResult;
}
