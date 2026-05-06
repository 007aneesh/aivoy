import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';

const STYLES_PATH = 'src/ui/styles.css';

export default defineConfig([
  // ───────────────────────────────────────────────────────────────────
  // Main package: index + adapters, dual ESM/CJS, React peer-deps externalised.
  // This is what npm consumers `import { Concierge } from 'aivoy'` use.
  // ───────────────────────────────────────────────────────────────────
  {
    entry: {
      index: 'src/index.ts',
      'adapters/index': 'src/adapters/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: ['react', 'react-dom', '@anthropic-ai/sdk', 'openai', '@google/generative-ai'],
    injectStyle: false,
    loader: { '.css': 'copy' },
    publicDir: false,
    async onSuccess() {
      mkdirSync('dist', { recursive: true });
      copyFileSync(STYLES_PATH, 'dist/styles.css');

      // Prepend "use client" — esbuild strips it during bundling, but Next.js
      // App Router needs it on the entry that re-exports React components.
      const directive = '"use client";\n';
      for (const file of ['dist/index.js', 'dist/index.cjs']) {
        if (!existsSync(file)) continue;
        const src = readFileSync(file, 'utf8');
        if (!src.startsWith(directive)) writeFileSync(file, directive + src);
      }
    },
  },
  // ───────────────────────────────────────────────────────────────────
  // Standalone IIFE: bundles React + ReactDOM + widget + CSS into one file
  // so a host site can install via <script src="…/embed/standalone.js">.
  // ───────────────────────────────────────────────────────────────────
  {
    entry: { standalone: 'src/standalone.tsx' },
    format: ['iife'],
    globalName: 'AivoyStandalone',
    minify: true,
    sourcemap: false,
    clean: false,
    dts: false,
    splitting: false,
    treeshake: true,
    // Bundle EVERYTHING — no externals.
    external: [],
    noExternal: [/.*/],
    loader: { '.css': 'text' },
    publicDir: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    async onSuccess() {
      // Mirror the standalone bundle into the cloud's public/embed dir so
      // Next.js serves it statically. Best-effort — ignored if cloud isn't present.
      const target = '../../apps/cloud/public/embed/standalone.js';
      const source = 'dist/standalone.global.js';
      try {
        const { copyFileSync, mkdirSync, existsSync } = await import('node:fs');
        if (existsSync(source)) {
          mkdirSync('../../apps/cloud/public/embed', { recursive: true });
          copyFileSync(source, target);
          console.log(`[tsup] copied standalone → ${target}`);
        }
      } catch (e) {
        console.warn('[tsup] standalone copy failed:', e);
      }
    },
    esbuildOptions(opts) {
      // Strip the `?inline` suffix from any CSS import so the .css loader matches.
      opts.plugins = (opts.plugins ?? []).concat({
        name: 'strip-css-inline-suffix',
        setup(build) {
          build.onResolve({ filter: /\.css\?inline$/ }, async (args) => {
            const path = args.path.replace(/\?inline$/, '');
            const result = await build.resolve(path, {
              kind: args.kind,
              resolveDir: args.resolveDir,
              importer: args.importer,
            });
            if (result.errors.length) return { errors: result.errors };
            return { path: result.path };
          });
        },
      });
    },
  },
]);
