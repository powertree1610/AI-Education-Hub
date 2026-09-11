// Production bundle for the MCP server: ONE self-contained dist/index.js.
//
// Why a bundle and not plain `tsc`: the workspace packages (@platform/db,
// @platform/shared) are consumed as TypeScript source with NodeNext-style
// "./x.js" specifiers. That works under `tsx` (dev) but not under plain
// `node dist/index.js`. esbuild inlines them and every third-party package,
// so the deploy folder needs no node_modules at all — copy dist/index.js,
// drop a .env next to it, run it with node.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

/** Resolve @platform/<name> to its source entry so it gets bundled. */
const workspacePlugin = {
  name: "workspace-packages",
  setup(b) {
    b.onResolve({ filter: /^@platform\/([^/]+)$/ }, (args) => {
      const name = args.path.slice("@platform/".length);
      return { path: path.join(repoRoot, "packages", name, "src", "index.ts") };
    });
  },
};

await build({
  entryPoints: [path.join(here, "src/index.ts")],
  outfile: path.join(here, "dist/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  // pg's optional native binding is require()'d lazily and never installed here.
  external: ["pg-native"],
  // CJS packages inlined into ESM output (express, pg) need a real `require`.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  plugins: [workspacePlugin],
  logLevel: "info",
});
