import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  access,
  cp,
  mkdir,
  readdir,
  readFile as readFileBuffer,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

export type WorkspaceFileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  hasChildren?: boolean;
};

function isSafePath(resolvedPath: string, rootPath: string): boolean {
  const normalizedPath = path.normalize(resolvedPath);
  const normalizedRoot = path.normalize(rootPath);
  return (
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(`${normalizedRoot}${path.sep}`)
  );
}

function sanitizeRelativePath(relativePath: string): string {
  return path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
}

function resolveWorkspacePath(rootPath: string, relativePath = ""): string {
  const resolvedRoot = path.resolve(rootPath);
  const safeRelativePath = sanitizeRelativePath(relativePath);
  const resolvedTarget = safeRelativePath
    ? path.resolve(resolvedRoot, safeRelativePath)
    : resolvedRoot;

  if (!isSafePath(resolvedTarget, resolvedRoot)) {
    throw new Error("Path is outside workspace root");
  }

  return resolvedTarget;
}

async function folderHasChildren(folderPath: string): Promise<boolean> {
  try {
    const entries = await readdir(folderPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

function sortNodes(a: WorkspaceFileNode, b: WorkspaceFileNode): number {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function deriveWorkspaceNameFromPath(worktreePath: string): string {
  const normalizedPath = path.resolve(normalizeWorkspaceRootInput(worktreePath));
  return path.basename(normalizedPath) || normalizedPath;
}

function normalizeWorkspaceRootInput(worktreePath: string): string {
  const trimmedPath = worktreePath.trim();

  if (!trimmedPath) {
    return "";
  }

  if (trimmedPath.startsWith("file://")) {
    return fileURLToPath(trimmedPath);
  }

  if (trimmedPath === "~") {
    return os.homedir();
  }

  if (trimmedPath.startsWith(`~${path.sep}`) || trimmedPath.startsWith("~/") || trimmedPath.startsWith("~\\")) {
    return path.join(os.homedir(), trimmedPath.slice(2));
  }

  return path.isAbsolute(trimmedPath) ? trimmedPath : path.resolve(trimmedPath);
}

export async function validateWorkspaceRoot(worktreePath: string): Promise<string> {
  const trimmedPath = worktreePath.trim();

  if (!trimmedPath) {
    throw new Error("Workspace path is required");
  }

  const resolvedRoot = path.resolve(normalizeWorkspaceRootInput(trimmedPath));
  const info = await stat(resolvedRoot);

  if (!info.isDirectory()) {
    throw new Error("Workspace path must point to a folder");
  }

  return resolvedRoot;
}

export async function listWorkspaceFolder(
  rootPath: string,
  relativePath = ""
): Promise<WorkspaceFileNode[]> {
  const resolvedRoot = await validateWorkspaceRoot(rootPath);
  const targetPath = resolveWorkspacePath(resolvedRoot, relativePath);
  const entries = await readdir(targetPath, { withFileTypes: true });

  const nodes = await Promise.all(
    entries
      .filter((entry) => entry.name !== "." && entry.name !== "..")
      .map(async (entry) => {
        const fullPath = path.join(targetPath, entry.name);
        const entryRelativePath = path.relative(resolvedRoot, fullPath);

        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: entryRelativePath,
            type: "folder" as const,
            hasChildren: await folderHasChildren(fullPath),
          };
        }

        return {
          name: entry.name,
          path: entryRelativePath,
          type: "file" as const,
        };
      })
  );

  return nodes.sort(sortNodes);
}

export async function createWorkspaceEntry(
  rootPath: string,
  relativePath: string,
  type: "file" | "folder"
): Promise<void> {
  const targetPath = resolveWorkspacePath(rootPath, relativePath);

  if (type === "folder") {
    await mkdir(targetPath, { recursive: false });
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, "", { encoding: "utf8", flag: "wx" });
}

export async function renameWorkspaceEntry(
  rootPath: string,
  relativePath: string,
  newName: string
): Promise<{ path: string; name: string }> {
  if (!newName.trim() || newName.includes("/") || newName.includes("\\")) {
    throw new Error("Invalid name");
  }

  const sourcePath = resolveWorkspacePath(rootPath, relativePath);
  const nextPath = path.join(path.dirname(sourcePath), newName.trim());

  if (!isSafePath(nextPath, path.resolve(rootPath))) {
    throw new Error("New path is outside workspace root");
  }

  await rename(sourcePath, nextPath);

  return {
    name: newName.trim(),
    path: path.relative(path.resolve(rootPath), nextPath),
  };
}

export async function moveWorkspaceEntry(
  rootPath: string,
  relativePath: string,
  destinationRelativePath = ""
): Promise<{ path: string; name: string }> {
  const resolvedRoot = path.resolve(rootPath);
  const sourcePath = resolveWorkspacePath(resolvedRoot, relativePath);
  const destinationDirectory = resolveWorkspacePath(
    resolvedRoot,
    destinationRelativePath
  );
  const sourceStats = await stat(sourcePath);
  const destinationStats = await stat(destinationDirectory);

  if (!destinationStats.isDirectory()) {
    throw new Error("Destination must be a folder");
  }

  if (
    sourceStats.isDirectory() &&
    (destinationDirectory === sourcePath ||
      destinationDirectory.startsWith(`${sourcePath}${path.sep}`))
  ) {
    throw new Error("Cannot move a folder into itself");
  }

  const nextPath = path.join(destinationDirectory, path.basename(sourcePath));

  if (!isSafePath(nextPath, resolvedRoot)) {
    throw new Error("New path is outside workspace root");
  }

  if (nextPath === sourcePath) {
    return {
      name: path.basename(sourcePath),
      path: path.relative(resolvedRoot, sourcePath),
    };
  }

  await rename(sourcePath, nextPath);

  return {
    name: path.basename(nextPath),
    path: path.relative(resolvedRoot, nextPath),
  };
}

async function ensurePathDoesNotExist(targetPath: string): Promise<void> {
  try {
    await access(targetPath);
    throw new Error("Destination already exists");
  } catch (error) {
    const code = "code" in (error as NodeJS.ErrnoException)
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

export async function copyWorkspaceEntry(
  rootPath: string,
  relativePath: string,
  destinationRelativePath = ""
): Promise<{ path: string; name: string }> {
  const resolvedRoot = path.resolve(rootPath);
  const sourcePath = resolveWorkspacePath(resolvedRoot, relativePath);
  const destinationDirectory = resolveWorkspacePath(
    resolvedRoot,
    destinationRelativePath
  );
  const sourceStats = await stat(sourcePath);
  const destinationStats = await stat(destinationDirectory);

  if (!destinationStats.isDirectory()) {
    throw new Error("Destination must be a folder");
  }

  if (
    sourceStats.isDirectory() &&
    (destinationDirectory === sourcePath ||
      destinationDirectory.startsWith(`${sourcePath}${path.sep}`))
  ) {
    throw new Error("Cannot copy a folder into itself");
  }

  const nextPath = path.join(destinationDirectory, path.basename(sourcePath));

  if (!isSafePath(nextPath, resolvedRoot)) {
    throw new Error("New path is outside workspace root");
  }

  if (nextPath === sourcePath) {
    throw new Error("Cannot copy an entry onto itself");
  }

  await ensurePathDoesNotExist(nextPath);
  await cp(sourcePath, nextPath, {
    errorOnExist: true,
    force: false,
    recursive: sourceStats.isDirectory(),
  });

  return {
    name: path.basename(nextPath),
    path: path.relative(resolvedRoot, nextPath),
  };
}

export async function deleteWorkspaceEntry(
  rootPath: string,
  relativePath: string
): Promise<void> {
  const targetPath = resolveWorkspacePath(rootPath, relativePath);
  await rm(targetPath, { recursive: true, force: true });
}

export async function readWorkspaceFile(
  rootPath: string,
  relativePath: string
): Promise<string> {
  const targetPath = resolveWorkspacePath(rootPath, relativePath);
  const info = await stat(targetPath);

  if (!info.isFile()) {
    throw new Error("Path is not a file");
  }

  return readFile(targetPath, "utf8");
}

export async function readWorkspaceFileRaw(
  rootPath: string,
  relativePath: string
): Promise<Buffer> {
  const targetPath = resolveWorkspacePath(rootPath, relativePath);
  const info = await stat(targetPath);

  if (!info.isFile()) {
    throw new Error("Path is not a file");
  }

  return readFileBuffer(targetPath);
}

export async function writeWorkspaceFile(
  rootPath: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = resolveWorkspacePath(rootPath, relativePath);
  const info = await stat(targetPath);

  if (!info.isFile()) {
    throw new Error("Path is not a file");
  }

  await writeFile(targetPath, content, "utf8");
}

async function pickFolderOnMac(): Promise<string | null> {
  const script = [
    'try',
    'set selectedFolder to choose folder with prompt "Select workspace folder"',
    'POSIX path of selectedFolder',
    'on error number -128',
    'return ""',
    'end try',
  ].join("\n");
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  const selectedPath = stdout.trim();
  return selectedPath || null;
}

async function pickFolderOnWindows(): Promise<string | null> {
  const command = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    '$dialog.Description = "Select workspace folder"',
    '$dialog.UseDescriptionForTitle = $true',
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  Write-Output $dialog.SelectedPath",
    "}",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    command,
  ]);
  const selectedPath = stdout.trim();
  return selectedPath || null;
}

async function pickFolderOnLinux(): Promise<string | null> {
  const homeDirectory = os.homedir();

  try {
    const { stdout } = await execFileAsync("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select workspace folder",
      `--filename=${homeDirectory}/`,
    ]);
    const selectedPath = stdout.trim();
    return selectedPath || null;
  } catch {
    const { stdout } = await execFileAsync("kdialog", [
      "--getexistingdirectory",
      homeDirectory,
      "--title",
      "Select workspace folder",
    ]);
    const selectedPath = stdout.trim();
    return selectedPath || null;
  }
}

export async function pickWorkspaceFolder(): Promise<{
  path: string;
  name: string;
} | null> {
  let selectedPath: string | null = null;

  if (process.platform === "darwin") {
    selectedPath = await pickFolderOnMac();
  } else if (process.platform === "win32") {
    selectedPath = await pickFolderOnWindows();
  } else if (process.platform === "linux") {
    selectedPath = await pickFolderOnLinux();
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  if (!selectedPath) {
    return null;
  }

  const resolvedPath = await validateWorkspaceRoot(selectedPath);
  await access(resolvedPath);

  return {
    path: resolvedPath,
    name: deriveWorkspaceNameFromPath(resolvedPath),
  };
}
