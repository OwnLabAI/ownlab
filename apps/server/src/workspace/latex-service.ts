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

  const mainFileAbsolutePath = resolveSafeWorkspacePath(options.rootPath, options.mainFilePath);
  const info = await stat(mainFileAbsolutePath);
  const extension = path.extname(options.mainFilePath).toLowerCase();

  if (!info.isFile() || extension !== ".tex") {
    throw new Error("LATEX_MAIN_FILE_INVALID");
  }

  const runId = randomUUID();
  const startedAt = new Date();
  const mainFileHash = createHash("sha1").update(options.mainFilePath).digest("hex").slice(0, 12);
  const outputDirectory = path.join(options.rootPath, ".ownlab", "latex", mainFileHash, runId);
  await mkdir(outputDirectory, { recursive: true });

  const cwd = path.dirname(mainFileAbsolutePath);
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
  await writeFile(logPathAbsolute, trimLog(combinedLog), "utf8");

  const finishedAt = new Date();
  const diagnostics = parseDiagnostics(combinedLog, options.mainFilePath);

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
      mainFilePath: options.mainFilePath,
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
