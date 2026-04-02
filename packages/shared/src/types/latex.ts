export const LATEX_ENGINES = [
  "tectonic",
  "latexmk",
  "xelatex",
  "pdflatex",
  "lualatex",
] as const;

export type LatexEngine = (typeof LATEX_ENGINES)[number];

export type LatexEnvironmentStatus = "checking" | "ready" | "missing" | "error";

export type LatexCompileDiagnosticSeverity = "error" | "warning";

export interface LatexEnvironmentInfo {
  status: LatexEnvironmentStatus;
  available: boolean;
  recommendedEngine: LatexEngine | null;
  detectedEngines: LatexEngine[];
  installHint: string | null;
  platform: string;
  checkedAt: string;
}

export interface LatexCompileDiagnostic {
  severity: LatexCompileDiagnosticSeverity;
  file: string | null;
  line: number | null;
  message: string;
  raw: string;
}

export interface LatexCompileResult {
  ok: boolean;
  runId: string;
  engine: LatexEngine;
  mainFilePath: string;
  outputPdfPath: string | null;
  logPath: string | null;
  statusCode: number | null;
  log: string;
  diagnostics: LatexCompileDiagnostic[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  error?: string | null;
}

export interface LatexWorkspaceFileList {
  files: string[];
}
