import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  LatexCompileDiagnostic,
  LatexCompileResult,
  LatexEngine,
  LatexEnvironmentInfo,
  LatexSavedOutput,
  LatexWorkspaceFileList,
} from "@ownlab/shared";

const execFileAsync = promisify(execFile);

const LATEX_ENGINE_ORDER: LatexEngine[] = [
  "tectonic",
  "latexmk",
  "xelatex",
  "pdflatex",
  "lualatex",
];

const COMMAND_PROBES: Record<LatexEngine, { command: string; args: string[] }> = {
  tectonic: { command: "tectonic", args: ["--version"] },
  latexmk: { command: "latexmk", args: ["-v"] },
  xelatex: { command: "xelatex", args: ["--version"] },
  pdflatex: { command: "pdflatex", args: ["--version"] },
  lualatex: { command: "lualatex", args: ["--version"] },
};

const MAX_LOG_CHARS = 200_000;

function resolveSafeWorkspacePath(rootPath: string, relativePath: string): string {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedRelativePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolvedPath = path.resolve(normalizedRoot, normalizedRelativePath);

  if (
    resolvedPath !== normalizedRoot &&
    !resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    throw new Error("Path is outside workspace root");
  }

  return resolvedPath;
}

function getInstallHint(platform: NodeJS.Platform): string {
  if (platform === "darwin") {
    return "Install Tectonic with `brew install tectonic`, or install MacTeX / TeX Live for broader compatibility.";
  }

  if (platform === "win32") {
    return "Install Tectonic with `winget install Tectonic.Tectonic`, or install MiKTeX / TeX Live for broader compatibility.";
  }

  return "Install Tectonic with your package manager, or install TeX Live for broader compatibility.";
}

async function probeEngine(engine: LatexEngine): Promise<boolean> {
  const probe = COMMAND_PROBES[engine];

  try {
    await execFileAsync(probe.command, probe.args, { timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

export async function detectLatexEnvironment(): Promise<LatexEnvironmentInfo> {
  const detectedEngines: LatexEngine[] = [];

  for (const engine of LATEX_ENGINE_ORDER) {
    if (await probeEngine(engine)) {
      detectedEngines.push(engine);
    }
  }

  const available = detectedEngines.length > 0;

  return {
    status: available ? "ready" : "missing",
    available,
    recommendedEngine: detectedEngines[0] ?? null,
    detectedEngines,
    installHint: available ? null : getInstallHint(process.platform),
    platform: process.platform,
    checkedAt: new Date().toISOString(),
  };
}

async function walkTexFiles(rootPath: string, currentRelativePath = ""): Promise<string[]> {
  const directoryPath = currentRelativePath
    ? path.join(rootPath, currentRelativePath)
    : rootPath;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const nextRelativePath = currentRelativePath
      ? `${currentRelativePath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      if (entry.name === ".ownlab") {
        continue;
      }
      files.push(...(await walkTexFiles(rootPath, nextRelativePath)));
      continue;
    }

    if (path.extname(entry.name).toLowerCase() === ".tex") {
      files.push(nextRelativePath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function listWorkspaceLatexFiles(rootPath: string): Promise<string[]> {
  return walkTexFiles(rootPath);
}

const LIKELY_MAIN_TEX_BASENAMES = new Set([
  "main",
  "index",
  "paper",
  "manuscript",
  "thesis",
  "report",
  "article",
  "orchtron",
  "root",
]);

function normalizeWorkspaceRelativePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/").replace(/^\.?\//, "");
}

function isLikelyMainTexFile(filePath: string): boolean {
  const parsed = path.parse(filePath.toLowerCase());
  return LIKELY_MAIN_TEX_BASENAMES.has(parsed.name);
}

function extractTexReferences(source: string): string[] {
  const references = new Set<string>();
  const commandPatterns = [
    /\\(?:input|include|subfile)\{([^}]+)\}/g,
    /\\import\{([^}]+)\}\{([^}]+)\}/g,
    /\\subimport\{([^}]+)\}\{([^}]+)\}/g,
  ];

  for (const pattern of commandPatterns) {
    for (const match of source.matchAll(pattern)) {
      if (match.length >= 3 && typeof match[2] === "string") {
        const directory = typeof match[1] === "string" ? match[1].trim() : "";
        const file = match[2].trim();
        if (file && !file.includes("\\")) {
          references.add(path.posix.join(directory, file));
        }
        continue;
      }

      const reference = typeof match[1] === "string" ? match[1].trim() : "";
      if (reference && !reference.includes("\\")) {
        references.add(reference);
      }
    }
  }

  return [...references];
}

function resolveTexReference(fromFilePath: string, reference: string): string | null {
  const trimmed = reference.trim();
  if (!trimmed || trimmed.startsWith("/")) {
    return null;
  }

  const candidate = trimmed.endsWith(".tex") ? trimmed : `${trimmed}.tex`;
  return normalizeWorkspaceRelativePath(
    path.posix.normalize(path.posix.join(path.posix.dirname(fromFilePath), candidate)),
  );
}

async function inspectTexWorkspace(rootPath: string): Promise<{
  files: string[];
  analysis: Array<{
    filePath: string;
    hasDocumentClass: boolean;
    hasBeginDocument: boolean;
    references: string[];
  }>;
}> {
  const files = await listWorkspaceLatexFiles(rootPath);
  const analysis = await Promise.all(
    files.map(async (filePath) => {
      let source = "";
      try {
        source = await readFile(resolveSafeWorkspacePath(rootPath, filePath), "utf8");
      } catch {
        source = "";
      }

      return {
        filePath,
        hasDocumentClass: /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(source),
        hasBeginDocument: /\\begin\{document\}/.test(source),
        references: extractTexReferences(source)
          .map((reference) => resolveTexReference(filePath, reference))
          .filter((reference): reference is string => Boolean(reference)),
      };
    }),
  );

  return { files, analysis };
}

function computeReachabilityToTarget(
  analysis: Array<{ filePath: string; references: string[] }>,
  targetFilePath: string,
): Set<string> {
  const incoming = new Map<string, string[]>();

  for (const entry of analysis) {
    for (const reference of entry.references) {
      const parents = incoming.get(reference) ?? [];
      parents.push(entry.filePath);
      incoming.set(reference, parents);
    }
  }

  const reachable = new Set<string>();
  const queue = [targetFilePath];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const parents = incoming.get(current) ?? [];
    for (const parent of parents) {
      if (reachable.has(parent)) {
        continue;
      }
      reachable.add(parent);
      queue.push(parent);
    }
  }

  return reachable;
}

export async function detectWorkspaceMainTexFile(options: {
  rootPath: string;
  filePath?: string | null;
}): Promise<LatexWorkspaceFileList> {
  const { files, analysis } = await inspectTexWorkspace(options.rootPath);
  const normalizedHint = options.filePath ? normalizeWorkspaceRelativePath(options.filePath) : null;
  const ancestorsOfHint =
    normalizedHint && files.includes(normalizedHint)
      ? computeReachabilityToTarget(analysis, normalizedHint)
      : new Set<string>();

  const ranked = analysis
    .map((entry) => {
      let score = 0;

      if (entry.hasDocumentClass) {
        score += 200;
      }
      if (entry.hasBeginDocument) {
        score += 60;
      }
      if (isLikelyMainTexFile(entry.filePath)) {
        score += 80;
      }
      if (normalizedHint && ancestorsOfHint.has(entry.filePath)) {
        score += 120;
      }
      if (normalizedHint === entry.filePath && entry.hasDocumentClass) {
        score += 40;
      }

      return {
        ...entry,
        score,
        depth: entry.filePath.split("/").length,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.hasDocumentClass !== right.hasDocumentClass) {
        return left.hasDocumentClass ? -1 : 1;
      }
      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }
      return left.filePath.localeCompare(right.filePath, undefined, { sensitivity: "base" });
    });

  const detectedMainFilePath =
    ranked[0]?.score && ranked[0].score > 0
      ? ranked[0].filePath
      : normalizedHint && files.includes(normalizedHint)
        ? normalizedHint
        : files[0] ?? null;

  return {
    files,
    detectedMainFilePath,
  };
}

function getMainFileHash(mainFilePath: string): string {
  return createHash("sha1").update(mainFilePath).digest("hex").slice(0, 12);
}

function getProjectOutputDirectory(mainFileAbsolutePath: string): string {
  return path.dirname(mainFileAbsolutePath);
}

function buildLatexCommand(engine: LatexEngine, outputDirectory: string, mainFileName: string) {
  switch (engine) {
    case "tectonic":
      return {
        command: "tectonic",
        args: ["--keep-logs", "--outdir", outputDirectory, mainFileName],
      };
    case "latexmk":
      return {
        command: "latexmk",
        args: [
          "-pdf",
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-file-line-error",
          `-outdir=${outputDirectory}`,
          mainFileName,
        ],
      };
    case "xelatex":
    case "pdflatex":
    case "lualatex":
      return {
        command: engine,
        args: [
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-file-line-error",
          `-output-directory=${outputDirectory}`,
          mainFileName,
        ],
      };
  }
}

function trimLog(log: string): string {
  return log.length > MAX_LOG_CHARS ? `${log.slice(0, MAX_LOG_CHARS)}\n[log truncated]` : log;
}

function parseDiagnostics(log: string, mainFilePath: string): LatexCompileDiagnostic[] {
  const diagnostics: LatexCompileDiagnostic[] = [];
  const lines = log.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) {
      continue;
    }

    const fileLineMatch = line.match(/^(.+?):(\d+):\s(.+)$/);
    if (fileLineMatch) {
      diagnostics.push({
        severity: "error",
        file: fileLineMatch[1] || mainFilePath,
        line: Number(fileLineMatch[2]),
        message: fileLineMatch[3],
        raw: line,
      });
      continue;
    }

    if (line.startsWith("!")) {
      const nextLine = lines[index + 1]?.trim() ?? "";
      const lineMatch = nextLine.match(/^l\.(\d+)\s?(.*)$/);
      diagnostics.push({
        severity: "error",
        file: mainFilePath,
        line: lineMatch ? Number(lineMatch[1]) : null,
        message: line.replace(/^!\s*/, ""),
        raw: [line, nextLine].filter(Boolean).join("\n"),
      });
      continue;
    }

    if (
      /^LaTeX Warning:/.test(line) ||
      /^Package .* Warning:/.test(line) ||
      /^Class .* Warning:/.test(line)
    ) {
      diagnostics.push({
        severity: "warning",
        file: mainFilePath,
        line: null,
        message: line,
        raw: line,
      });
    }
  }

  return diagnostics;
}

async function runCommand(options: {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ code: number | null; log: string }> {
  const chunks: string[] = [];

  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
    });

    const pushChunk = (chunk: unknown) => {
      if (!chunk) {
        return;
      }

      const nextChunk = chunk.toString();
      if (chunks.join("").length >= MAX_LOG_CHARS) {
        return;
      }

      chunks.push(nextChunk);
    };

    child.stdout.on("data", pushChunk);
    child.stderr.on("data", pushChunk);
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, log: trimLog(chunks.join("")) });
    });
  });
}

async function detectBibliographyTool(mainFileAbsolutePath: string, auxPath: string): Promise<"bibtex" | "biber"> {
  try {
    const auxContent = await readFile(auxPath, "utf8");
    if (auxContent.includes("\\abx@aux@")) {
      return "biber";
    }
  } catch {
    // Ignore aux detection failures and fall back to source inspection.
  }

  try {
    const source = await readFile(mainFileAbsolutePath, "utf8");
    if (/\\usepackage(\[.*?\])?\{biblatex\}/.test(source)) {
      return "biber";
    }
  } catch {
    // Ignore source inspection failures and use bibtex fallback.
  }

  return "bibtex";
}

async function maybeRunBibliographyPass(options: {
  engine: LatexEngine;
  cwd: string;
  workspaceRoot: string;
  mainFileAbsolutePath: string;
  mainFileBaseName: string;
  outputDirectory: string;
}): Promise<string> {
  if (!["xelatex", "pdflatex", "lualatex"].includes(options.engine)) {
    return "";
  }

  const auxPath = path.join(options.outputDirectory, `${options.mainFileBaseName}.aux`);
  const bibliographyTool = await detectBibliographyTool(options.mainFileAbsolutePath, auxPath);
  const args =
    bibliographyTool === "biber"
      ? [`--input-directory=${options.cwd}`, options.mainFileBaseName]
      : [options.mainFileBaseName];

  try {
    const result = await runCommand({
      command: bibliographyTool,
      args,
      cwd: options.outputDirectory,
      env: {
        ...process.env,
        BIBINPUTS: `${options.cwd}${path.delimiter}${options.workspaceRoot}${path.delimiter}`,
        BSTINPUTS: `${options.cwd}${path.delimiter}${options.workspaceRoot}${path.delimiter}`,
      },
    });
    return result.log;
  } catch {
    return `[warn] ${bibliographyTool} is not available, skipping bibliography pass.\n`;
  }
}

export async function compileLatexInWorkspace(options: {
  rootPath: string;
  mainFilePath: string;
  engine?: LatexEngine | null;
}): Promise<{ environment: LatexEnvironmentInfo; result: LatexCompileResult }> {
  const environment = await detectLatexEnvironment();

  if (!environment.available || !environment.recommendedEngine) {
    throw new Error("LATEX_ENVIRONMENT_MISSING");
  }

  const selectedEngine =
    options.engine && environment.detectedEngines.includes(options.engine)
      ? options.engine
      : environment.recommendedEngine;

  const detection = await detectWorkspaceMainTexFile({
    rootPath: options.rootPath,
    filePath: options.mainFilePath,
  });
  const resolvedMainFilePath = detection.detectedMainFilePath ?? options.mainFilePath;
  const mainFileAbsolutePath = resolveSafeWorkspacePath(options.rootPath, resolvedMainFilePath);
  const info = await stat(mainFileAbsolutePath);
  const extension = path.extname(resolvedMainFilePath).toLowerCase();

  if (!info.isFile() || extension !== ".tex") {
    throw new Error("LATEX_MAIN_FILE_INVALID");
  }

  const runId = randomUUID();
  const startedAt = new Date();
  const cwd = path.dirname(mainFileAbsolutePath);
  const outputDirectory = getProjectOutputDirectory(mainFileAbsolutePath);
  await mkdir(outputDirectory, { recursive: true });
  const mainFileName = path.basename(mainFileAbsolutePath);
  const mainFileBaseName = path.basename(mainFileName, path.extname(mainFileName));
  const compileCommand = buildLatexCommand(selectedEngine, outputDirectory, mainFileName);

  let statusCode: number | null = null;
  let combinedLog = "";
  let executionError: string | null = null;

  try {
    const firstPass = await runCommand({
      command: compileCommand.command,
      args: compileCommand.args,
      cwd,
    });
    statusCode = firstPass.code;
    combinedLog += firstPass.log;

    if (selectedEngine !== "tectonic" && selectedEngine !== "latexmk") {
      combinedLog += await maybeRunBibliographyPass({
        engine: selectedEngine,
        cwd,
        workspaceRoot: options.rootPath,
        mainFileAbsolutePath,
        mainFileBaseName,
        outputDirectory,
      });

      const secondPass = await runCommand({
        command: compileCommand.command,
        args: compileCommand.args,
        cwd,
      });
      statusCode = secondPass.code;
      combinedLog += secondPass.log;

      const thirdPass = await runCommand({
        command: compileCommand.command,
        args: compileCommand.args,
        cwd,
      });
      statusCode = thirdPass.code;
      combinedLog += thirdPass.log;
    }
  } catch (error) {
    executionError = error instanceof Error ? error.message : String(error);
  }

  const pdfPathAbsolute = path.join(outputDirectory, `${mainFileBaseName}.pdf`);
  const logPathAbsolute = path.join(outputDirectory, `${mainFileBaseName}.log`);
  const logExists = await stat(logPathAbsolute)
    .then((fileInfo) => fileInfo.isFile())
    .catch(() => false);

  if (!logExists) {
    await writeFile(logPathAbsolute, trimLog(combinedLog), "utf8");
  }

  const finishedAt = new Date();
  const diagnostics = parseDiagnostics(combinedLog, resolvedMainFilePath);

  const outputPdfPath =
    (await stat(pdfPathAbsolute).then((fileInfo) => fileInfo.isFile()).catch(() => false))
      ? path.relative(options.rootPath, pdfPathAbsolute)
      : null;
  const logPath =
    (await stat(logPathAbsolute).then((fileInfo) => fileInfo.isFile()).catch(() => false))
      ? path.relative(options.rootPath, logPathAbsolute)
      : null;

  return {
    environment,
    result: {
      ok: Boolean(outputPdfPath) && !executionError && statusCode === 0,
      runId,
      engine: selectedEngine,
      mainFilePath: resolvedMainFilePath,
      outputPdfPath,
      logPath,
      statusCode,
      log: trimLog(combinedLog),
      diagnostics,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      error:
        executionError ??
        (outputPdfPath ? null : "Compilation finished without producing a PDF."),
    },
  };
}

export async function findLatestLatexOutput(options: {
  rootPath: string;
  mainFilePath: string;
}): Promise<LatexSavedOutput | null> {
  const detection = await detectWorkspaceMainTexFile({
    rootPath: options.rootPath,
    filePath: options.mainFilePath,
  });
  const resolvedMainFilePath = detection.detectedMainFilePath ?? options.mainFilePath;
  const mainFileAbsolutePath = resolveSafeWorkspacePath(options.rootPath, resolvedMainFilePath);
  const info = await stat(mainFileAbsolutePath);
  const extension = path.extname(resolvedMainFilePath).toLowerCase();

  if (!info.isFile() || extension !== ".tex") {
    throw new Error("LATEX_MAIN_FILE_INVALID");
  }

  const mainFileBaseName = path.basename(
    resolvedMainFilePath,
    path.extname(resolvedMainFilePath),
  );
  const projectOutputDirectory = getProjectOutputDirectory(mainFileAbsolutePath);
  const projectPdfPathAbsolute = path.join(projectOutputDirectory, `${mainFileBaseName}.pdf`);
  const projectPdfInfo = await stat(projectPdfPathAbsolute).catch(() => null);

  if (projectPdfInfo?.isFile()) {
    const projectLogPathAbsolute = path.join(projectOutputDirectory, `${mainFileBaseName}.log`);
    const projectLogInfo = await stat(projectLogPathAbsolute).catch(() => null);

    return {
      runId: String(projectPdfInfo.mtimeMs),
      mainFilePath: resolvedMainFilePath,
      outputPdfPath: path.relative(options.rootPath, projectPdfPathAbsolute),
      logPath: projectLogInfo?.isFile()
        ? path.relative(options.rootPath, projectLogPathAbsolute)
        : null,
      finishedAt: projectPdfInfo.mtime.toISOString(),
    };
  }

  const mainFileHash = getMainFileHash(resolvedMainFilePath);
  const baseDirectory = path.join(options.rootPath, ".ownlab", "latex", mainFileHash);

  const runDirectories = await readdir(baseDirectory, { withFileTypes: true }).catch(() => []);
  const candidates = await Promise.all(
    runDirectories
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const outputDirectory = path.join(baseDirectory, entry.name);
        const pdfPathAbsolute = path.join(outputDirectory, `${mainFileBaseName}.pdf`);
        const pdfInfo = await stat(pdfPathAbsolute).catch(() => null);
        if (!pdfInfo?.isFile()) {
          return null;
        }

        const logPathAbsolute = path.join(outputDirectory, `${mainFileBaseName}.log`);
        const logInfo = await stat(logPathAbsolute).catch(() => null);

        return {
          runId: entry.name,
          mainFilePath: resolvedMainFilePath,
          outputPdfPath: path.relative(options.rootPath, pdfPathAbsolute),
          logPath: logInfo?.isFile() ? path.relative(options.rootPath, logPathAbsolute) : null,
          finishedAt: pdfInfo.mtime.toISOString(),
          timeMs: pdfInfo.mtimeMs,
        };
      }),
  );

  const latest = candidates
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => right.timeMs - left.timeMs)[0];

  if (!latest) {
    return null;
  }

  const { timeMs: _timeMs, ...output } = latest;
  return output;
}
