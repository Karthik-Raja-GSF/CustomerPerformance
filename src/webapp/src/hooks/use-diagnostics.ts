/**
 * Browser Diagnostics Collection
 *
 * Intercepts console and fetch calls to capture diagnostics
 * for issue reporting. Module-level singleton — survives
 * React re-renders and component unmounts.
 */

interface ConsoleLogEntry {
  level: "log" | "warn" | "error";
  message: string;
  timestamp: string;
}

interface NetworkLogEntry {
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  requestBody: string | null;
  responseBody: string | null;
  timestamp: string;
}

interface PageDetails {
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
  language: string;
  cookiesEnabled: boolean;
  timestamp: string;
}

export interface DiagnosticsData {
  consoleLogs: ConsoleLogEntry[];
  networkLogs: NetworkLogEntry[];
  pageDetails: PageDetails;
}

const MAX_CONSOLE_ENTRIES = 100;
const MAX_NETWORK_ENTRIES = 50;
const MAX_MESSAGE_LENGTH = 500;
const MAX_URL_LENGTH = 200;
const MAX_BODY_LENGTH = 2000;

const consoleLogs: ConsoleLogEntry[] = [];
const networkLogs: NetworkLogEntry[] = [];

let initialized = false;

function pushConsoleEntry(entry: ConsoleLogEntry) {
  consoleLogs.push(entry);
  if (consoleLogs.length > MAX_CONSOLE_ENTRIES) {
    consoleLogs.shift();
  }
}

function pushNetworkEntry(entry: NetworkLogEntry) {
  networkLogs.push(entry);
  if (networkLogs.length > MAX_NETWORK_ENTRIES) {
    networkLogs.shift();
  }
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ")
    .slice(0, MAX_MESSAGE_LENGTH);
}

function extractRequestBody(init?: RequestInit): string | null {
  if (!init?.body) return null;
  try {
    if (typeof init.body === "string") {
      return init.body.slice(0, MAX_BODY_LENGTH);
    }
    // FormData, Blob, ArrayBuffer etc. — can't easily stringify
    return "[non-text body]";
  } catch {
    return null;
  }
}

async function extractResponseBody(response: Response): Promise<string | null> {
  try {
    const clone = response.clone();
    const text = await clone.text();
    return text.slice(0, MAX_BODY_LENGTH);
  } catch {
    return null;
  }
}

function installConsoleInterceptor() {
  const levels = ["log", "warn", "error"] as const;

  for (const level of levels) {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      pushConsoleEntry({
        level,
        message: formatArgs(args),
        timestamp: new Date().toISOString(),
      });
      original.apply(console, args);
    };
  }
}

function installFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = init?.method ?? "GET";
    const startTime = Date.now();

    // Skip capturing bodies for the report submission itself
    const skipBodies = url.includes("/issue-reports");
    const requestBody = skipBodies ? null : extractRequestBody(init);

    try {
      const response = await originalFetch(input, init);
      const responseBody = skipBodies
        ? null
        : await extractResponseBody(response);

      pushNetworkEntry({
        method: method.toUpperCase(),
        url: url.slice(0, MAX_URL_LENGTH),
        status: response.status,
        durationMs: Date.now() - startTime,
        requestBody,
        responseBody,
        timestamp: new Date().toISOString(),
      });
      return response;
    } catch (error) {
      pushNetworkEntry({
        method: method.toUpperCase(),
        url: url.slice(0, MAX_URL_LENGTH),
        status: null,
        durationMs: Date.now() - startTime,
        requestBody,
        responseBody: null,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  };
}

function collectPageDetails(): PageDetails {
  return {
    url: window.location.href,
    title: document.title,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: screen.width,
    screenHeight: screen.height,
    userAgent: navigator.userAgent,
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Initialize diagnostics interceptors.
 * Call once at app startup (idempotent).
 */
export function initDiagnostics() {
  if (initialized) return;
  initialized = true;
  installConsoleInterceptor();
  installFetchInterceptor();
}

/**
 * Collect current diagnostics snapshot.
 */
export function collectDiagnostics(): DiagnosticsData {
  return {
    consoleLogs: [...consoleLogs],
    networkLogs: [...networkLogs],
    pageDetails: collectPageDetails(),
  };
}

/**
 * React hook for diagnostics collection.
 */
export function useDiagnostics() {
  return { collectDiagnostics };
}
