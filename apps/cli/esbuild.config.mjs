/**
 * Bundles the OwnLab CLI into a single ESM file for local runtime and desktop support.
 * Workspace packages under @ownlab/* are resolved and inlined (see package dependencies).
 */

/** @type {import('esbuild').BuildOptions} */
export default {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  banner: { js: "#!/usr/bin/env node" },
  treeShaking: true,
  sourcemap: true,
  // Commander uses `require()` of Node builtins; keep it external like Paperclip’s heavy CLI split.
  external: ["commander", "@ownlab/server"],
};
