import fs from "node:fs/promises";
import path from "node:path";

export async function syncSkillLinks(
  targetDir: string,
  desiredSkills: Array<{ slug: string; localPath: string }>,
) {
  await fs.mkdir(targetDir, { recursive: true });
  const desired = new Map(desiredSkills.map((skill) => [skill.slug, skill.localPath]));
  const existing = await fs.readdir(targetDir, { withFileTypes: true }).catch(() => []);

  for (const entry of existing) {
    const targetPath = path.join(targetDir, entry.name);
    const desiredSource = desired.get(entry.name);
    if (!desiredSource) {
      const stats = await fs.lstat(targetPath).catch(() => null);
      if (stats?.isSymbolicLink()) {
        await fs.unlink(targetPath).catch(() => {});
      }
      continue;
    }

    const linkedPath = await fs.readlink(targetPath).catch(() => null);
    const resolvedLinkedPath = linkedPath
      ? path.resolve(path.dirname(targetPath), linkedPath)
      : null;
    if (resolvedLinkedPath === desiredSource) {
      desired.delete(entry.name);
      continue;
    }

    const stats = await fs.lstat(targetPath).catch(() => null);
    if (stats?.isSymbolicLink()) {
      await fs.unlink(targetPath);
      await fs.symlink(desiredSource, targetPath);
    }
    desired.delete(entry.name);
  }

  for (const [slug, sourcePath] of desired.entries()) {
    await fs.symlink(sourcePath, path.join(targetDir, slug)).catch(async () => {
      const targetPath = path.join(targetDir, slug);
      const existing = await fs.lstat(targetPath).catch(() => null);
      if (existing?.isSymbolicLink()) {
        await fs.unlink(targetPath);
        await fs.symlink(sourcePath, targetPath);
      }
    });
  }
}
