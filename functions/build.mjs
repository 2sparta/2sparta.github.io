import { build } from "esbuild";
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: "dist/index.cjs",
  external: ["firebase-admin", "firebase-admin/*", "firebase-functions", "firebase-functions/*"],
  sourcemap: true,
});
