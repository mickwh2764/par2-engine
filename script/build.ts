import * as esbuild from "esbuild";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const rootDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");

// Clean previous build
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

// 1. Regenerate the sitemap from the client routes
console.log("Generating sitemap...");
execSync("npx tsx script/generate-sitemap.ts", { cwd: rootDir, stdio: "inherit" });

// 2. Build the React client with Vite
console.log("Building client...");
execSync("npx vite build", {
  cwd: rootDir,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

// 3. Bundle the server with esbuild
console.log("Building server...");

// Read package.json to get all dependency names for externalizing
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
const allDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
];

// ESM-only packages cannot be require()'d from the CommonJS server bundle, so
// they must be bundled in (esbuild transpiles them to CJS) rather than left
// external. Externalizing them causes an ERR_REQUIRE_ESM crash at startup.
const esmOnly = new Set(["openid-client"]);
const externalDeps = allDeps.filter((d) => !esmOnly.has(d));

await esbuild.build({
  entryPoints: [path.join(rootDir, "server", "index.ts")],
  outfile: path.join(distDir, "index.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  // Externalize all node_modules — they'll be available at runtime via node_modules/
  // Also exclude the dev-only vite integration (only used when NODE_ENV !== production)
  external: [...externalDeps, "../vite.config"],
  define: {
    "import.meta.dirname": "__dirname",
    "import.meta.filename": "__filename",
  },
});

console.log("Build complete.");
console.log(`  Client: ${distDir}/public/`);
console.log(`  Server: ${distDir}/index.cjs`);
