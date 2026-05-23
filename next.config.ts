import type { NextConfig } from "next";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  webpack: (config, { isServer }) => {
    // Workaround: el proyecto declara "type": "module" en package.json (necesario
    // para usar import.meta.dirname acá), pero Next 15 emite .next/server/pages/
    // _document.js con sintaxis CommonJS. Marcamos ese subárbol como CJS para
    // evitar "ReferenceError: require is not defined" durante "Collecting page
    // data".
    if (isServer) {
      config.plugins.push({
        apply(compiler: {
          hooks: { afterEmit: { tap: (n: string, fn: () => void) => void } };
        }) {
          compiler.hooks.afterEmit.tap("PagesCjsCompat", () => {
            const dir = join(import.meta.dirname, ".next/server/pages");
            try {
              mkdirSync(dir, { recursive: true });
              writeFileSync(
                join(dir, "package.json"),
                '{"type":"commonjs"}',
              );
            } catch {
              // ignore
            }
          });
        },
      });
    }
    return config;
  },
};

export default nextConfig;
