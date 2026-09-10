import { build } from "esbuild";
await build({
  entryPoints: {
    main: "apps/api/src/main.ts",
    migrate: "apps/api/src/deployment/migrate.ts",
    bootstrap: "apps/api/src/deployment/bootstrap.ts",
  },
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node24",
  format: "esm",
  outdir: "apps/api/dist",
});
