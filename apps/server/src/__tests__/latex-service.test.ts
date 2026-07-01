import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectWorkspaceMainTexFile,
  findLatestLatexOutput,
} from "../workspace/latex-service.js";

const tempRoots: string[] = [];

async function createTempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ownlab-latex-service-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("detectWorkspaceMainTexFile", () => {
  it("finds the single real main tex when the current file is a section", async () => {
    const rootPath = await createTempWorkspace();
    const projectDir = path.join(rootPath, "paper", "ACM");
    const sectionsDir = path.join(projectDir, "sections");

    await fs.mkdir(sectionsDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "main.tex"),
      "\\documentclass{article}\n\\begin{document}\n\\input{sections/8-Related_Work}\n\\end{document}\n",
    );
    await fs.writeFile(path.join(sectionsDir, "8-Related_Work.tex"), "Related work.\n");

    const result = await detectWorkspaceMainTexFile({
      rootPath,
      filePath: "paper/ACM/sections/8-Related_Work.tex",
    });

    expect(result).toEqual({
      files: ["paper/ACM/main.tex", "paper/ACM/sections/8-Related_Work.tex"],
      detectedMainFilePath: "paper/ACM/main.tex",
    });
  });
});

describe("findLatestLatexOutput", () => {
  it("prefers the stable project output beside the main tex file", async () => {
    const rootPath = await createTempWorkspace();
    const projectDir = path.join(rootPath, "paper", "ACM");
    const mainFilePath = "paper/ACM/orchtron.tex";

    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, "orchtron.tex"), "\\documentclass{article}\n\\begin{document}Hi\\end{document}\n");
    await fs.writeFile(path.join(projectDir, "orchtron.pdf"), "project-pdf");
    await fs.writeFile(path.join(projectDir, "orchtron.log"), "project-log");

    const output = await findLatestLatexOutput({
      rootPath,
      mainFilePath,
    });

    expect(output).toEqual({
      runId: expect.any(String),
      mainFilePath,
      outputPdfPath: "paper/ACM/orchtron.pdf",
      logPath: "paper/ACM/orchtron.log",
      finishedAt: expect.any(String),
    });
  });

  it("falls back to legacy .ownlab latex outputs when no project pdf exists", async () => {
    const rootPath = await createTempWorkspace();
    const projectDir = path.join(rootPath, "paper", "ACM");
    const mainFilePath = "paper/ACM/orchtron.tex";
    const legacyRunDir = path.join(rootPath, ".ownlab", "latex", "45d1ba3609a2", "run-123");

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(legacyRunDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, "orchtron.tex"), "\\documentclass{article}\n\\begin{document}Hi\\end{document}\n");
    await fs.writeFile(path.join(legacyRunDir, "orchtron.pdf"), "legacy-pdf");
    await fs.writeFile(path.join(legacyRunDir, "orchtron.log"), "legacy-log");

    const output = await findLatestLatexOutput({
      rootPath,
      mainFilePath,
    });

    expect(output).toEqual({
      runId: "run-123",
      mainFilePath,
      outputPdfPath: ".ownlab/latex/45d1ba3609a2/run-123/orchtron.pdf",
      logPath: ".ownlab/latex/45d1ba3609a2/run-123/orchtron.log",
      finishedAt: expect.any(String),
    });
  });

  it("resolves latest output from the detected main tex when given a section file", async () => {
    const rootPath = await createTempWorkspace();
    const projectDir = path.join(rootPath, "paper", "ACM");
    const sectionsDir = path.join(projectDir, "sections");

    await fs.mkdir(sectionsDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "main.tex"),
      "\\documentclass{article}\n\\begin{document}\n\\input{sections/8-Related_Work}\n\\end{document}\n",
    );
    await fs.writeFile(path.join(projectDir, "main.pdf"), "project-pdf");
    await fs.writeFile(path.join(projectDir, "main.log"), "project-log");
    await fs.writeFile(path.join(sectionsDir, "8-Related_Work.tex"), "Related work.\n");

    const output = await findLatestLatexOutput({
      rootPath,
      mainFilePath: "paper/ACM/sections/8-Related_Work.tex",
    });

    expect(output).toEqual({
      runId: expect.any(String),
      mainFilePath: "paper/ACM/main.tex",
      outputPdfPath: "paper/ACM/main.pdf",
      logPath: "paper/ACM/main.log",
      finishedAt: expect.any(String),
    });
  });
});
