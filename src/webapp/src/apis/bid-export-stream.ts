import type { CustomerBidDto, CustomerBidFilters } from "@/types/customer-bids";

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8887";
const TOKEN_KEY = "id_token";

export interface ExportStreamProgress {
  batch: number;
  rowsSoFar: number;
  total: number;
  truncated: boolean;
}

export interface ExportStreamResult {
  totalRows: number;
  totalMatching: number;
  truncated: boolean;
}

function buildExportParams(filters: CustomerBidFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.schoolYear) params.set("schoolYear", filters.schoolYear);
  if (filters.siteCode) params.set("siteCode", filters.siteCode);
  if (filters.customerBillTo)
    params.set("customerBillTo", filters.customerBillTo);
  if (filters.customerName) params.set("customerName", filters.customerName);
  if (filters.salesRep) params.set("salesRep", filters.salesRep);
  if (filters.itemCode) params.set("itemCode", filters.itemCode);
  if (filters.erpStatus) params.set("erpStatus", filters.erpStatus);
  if (filters.coOpCode) params.set("coOpCode", filters.coOpCode);
  if (filters.salesType !== undefined)
    params.set("salesType", filters.salesType.toString());
  if (filters.isNew !== undefined)
    params.set("isNew", filters.isNew.toString());
  if (filters.confirmed !== undefined)
    params.set("confirmed", filters.confirmed.toString());
  if (filters.exported !== undefined)
    params.set("exported", filters.exported.toString());
  if (filters.queued !== undefined)
    params.set("queued", filters.queued.toString());
  if (filters.excludeItemPrefixes)
    params.set("excludeItemPrefixes", filters.excludeItemPrefixes);
  return params;
}

export async function streamExportBids(
  filters: CustomerBidFilters,
  callbacks: {
    onBatch: (dtos: CustomerBidDto[]) => void;
    onProgress: (meta: ExportStreamProgress) => void;
  },
  signal?: AbortSignal
): Promise<ExportStreamResult> {
  const params = buildExportParams(filters);
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(
    `${API_BASE_URL}/customer-bids/export/stream?${params}`,
    {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        Accept: "text/event-stream",
      },
      signal,
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Export failed with status ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ExportStreamResult = {
    totalRows: 0,
    totalMatching: 0,
    truncated: false,
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop()!;

    for (const raw of events) {
      const lines = raw.trim().split("\n");
      const eventType = lines
        .find((l) => l.startsWith("event:"))
        ?.slice(6)
        .trim();
      const dataLine = lines
        .find((l) => l.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!dataLine) continue;

      if (eventType === "data") {
        callbacks.onBatch(JSON.parse(dataLine) as CustomerBidDto[]);
      } else if (eventType === "progress") {
        callbacks.onProgress(JSON.parse(dataLine) as ExportStreamProgress);
      } else if (eventType === "done") {
        result = JSON.parse(dataLine) as ExportStreamResult;
      } else if (eventType === "error") {
        throw new Error((JSON.parse(dataLine) as { message: string }).message);
      }
    }
  }

  return result;
}
