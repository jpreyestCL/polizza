import type { NextConfig } from "next";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  experimental: {
    serverActions: {
      // Brokeris valida el archivo en 10 MB; deja margen al multipart.
      bodySizeLimit: "11mb",
    },
  },
  // jsdom (vía isomorphic-dompurify) lee browser/default-stylesheet.css usando
  // __dirname al inicializar. Webpack reescribe __dirname y el archivo no se
  // copia al output standalone → ENOENT en runtime. Marcarlo como externo
  // hace que se resuelva desde node_modules en runtime con __dirname correcto.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],
  // La liquidación de vendedores dejó de ser una pestaña de /comisiones y pasó
  // a ser un módulo propio: los enlaces antiguos siguen funcionando.
  async redirects() {
    return [
      {
        source: "/comisiones/liquidaciones",
        destination: "/liquidaciones-vendedores",
        permanent: true,
      },
      {
        source: "/comisiones/liquidaciones/:id",
        destination: "/liquidaciones-vendedores/:id",
        permanent: true,
      },
    ];
  },
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
