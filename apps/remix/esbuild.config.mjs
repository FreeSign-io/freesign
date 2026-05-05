/**
 * esbuild config for the Remix server bundle.
 *
 * Replaces the previous rollup config. The previous rollup setup did:
 *   - input: server/router.ts
 *   - output: build/server/hono/ (preserveModules)
 *   - external: /node_modules/ (everything in real node_modules)
 *   - resolveOnly: @documenso/{api,auth,lib,trpc,email}/* (workspace
 *     packages get bundled - they live under packages/ via symlinks in
 *     node_modules/@documenso so they don't match the external regex)
 *   - typescript transpile via @rollup/plugin-typescript
 *   - lingui macro transform via @babel/preset-typescript + the lingui
 *     babel plugin
 *
 * This config mirrors that behavior with esbuild:
 *   - Single bundled output at build/server/hono/server/router.js (instead
 *     of the per-file preserveModules tree). server/main.js imports from
 *     ./hono/server/router.js and ./hono/server/load-context.js, so we
 *     also emit a tiny shim for load-context.js that re-exports
 *     getLoadContext from router.js (which already re-exports it).
 *   - All bare specifiers are externalized EXCEPT @documenso/* workspace
 *     packages, which get bundled.
 *   - A small esbuild plugin runs babel + the lingui macro transform on
 *     any .ts/.tsx file that imports from @lingui/{core,react}/macro.
 *
 * Dynamic translation imports in packages/lib/utils/i18n.ts and
 * packages/lib/client-only/providers/i18n-server.tsx use relative paths
 * that, with preserveModules, resolved into
 * build/server/hono/packages/lib/translations/. After bundling to
 * build/server/hono/server/router.js, they need a different relative
 * resolution. deploy.sh / .bin/build.sh copy the .mjs catalogs into
 * build/server/hono/packages/lib/translations/ either way; we rewrite
 * the dynamic-import expressions in those two files so the runtime
 * imports resolve relative to the bundle's location via
 * `import.meta.url`. See rewriteI18nDynamicImportsPlugin below.
 */
import { transformAsync } from '@babel/core';
import linguiMacro from '@lingui/babel-plugin-lingui-macro';
import esbuild from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const buildOutDir = path.join(__dirname, 'build', 'server', 'hono');
const routerOut = path.join(buildOutDir, 'server', 'router.js');
const loadContextOut = path.join(buildOutDir, 'server', 'load-context.js');

// Matches imports from any of the lingui macro entry points:
//   @lingui/core/macro
//   @lingui/react/macro
//   @lingui/macro            (legacy combined entry, still used in a
//                              couple of files)
const LINGUI_MACRO_RE = /@lingui\/(?:(?:core|react)\/macro|macro)\b/;
// packages/lib/utils/i18n.ts:
//   await import(`../translations/${locale}/web.${extension}`)
const I18N_UTIL_DYNAMIC_PATH_RE = /\.\.\/translations\/\$\{locale\}\/web\.\$\{extension\}/;
// packages/lib/client-only/providers/i18n-server.tsx:
//   await import(`../../translations/${lang}/web.${extension}`)
const I18N_PROVIDER_DYNAMIC_PATH_RE = /\.\.\/\.\.\/translations\/\$\{lang\}\/web\.\$\{extension\}/;

/**
 * esbuild plugin: externalize every bare-specifier import EXCEPT
 * `@documenso/*` workspace packages. Mirrors rollup's
 * `external: [/node_modules/]` + `resolveOnly: [@documenso/...]`.
 *
 * - Relative paths and absolute paths fall through to esbuild's default
 *   resolver and get bundled.
 * - `@documenso/foo` → resolved through node_modules symlinks into
 *   packages/foo/, then bundled.
 * - `node:fs`, `kysely`, `react`, etc → marked external so Node loads
 *   them at runtime.
 */
const externalizeNodeModulesPlugin = {
  name: 'externalize-node-modules',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      // Bare specifier. If it's a workspace package, let esbuild resolve
      // and bundle it; otherwise mark external.
      if (args.path.startsWith('@documenso/')) {
        return null;
      }
      return { path: args.path, external: true };
    });
  },
};

/**
 * esbuild plugin: run the lingui babel macro on any .ts/.tsx file that
 * imports from `@lingui/core/macro` or `@lingui/react/macro`. Other
 * .ts/.tsx files are left for esbuild's built-in transpiler (much
 * faster). Mirrors what rollup's babel plugin was doing, but only on
 * files that need it.
 */
const linguiMacroPlugin = {
  name: 'lingui-macro',
  setup(build) {
    build.onLoad({ filter: /\.(tsx?|jsx?)$/ }, async (args) => {
      // Skip files in real node_modules (workspace files have already
      // been resolved through symlinks by the time we get here, so this
      // only skips actual third-party deps - which won't happen because
      // they're externalized above, but being defensive).
      if (args.path.includes(`${path.sep}node_modules${path.sep}`)) {
        return null;
      }

      const source = await fs.readFile(args.path, 'utf8');

      if (!LINGUI_MACRO_RE.test(source)) {
        // Fast path: no lingui macro import, let esbuild handle it.
        return null;
      }

      const result = await transformAsync(source, {
        filename: args.path,
        babelrc: false,
        configFile: false,
        sourceMaps: 'inline',
        presets: [
          ['@babel/preset-typescript', { allowDeclareFields: true }],
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
        plugins: [linguiMacro.default ?? linguiMacro],
      });

      const ext = path.extname(args.path).toLowerCase();
      // After babel runs preset-typescript / preset-react, we hand the
      // resulting JS back to esbuild. Tell esbuild to treat it as JS so
      // it doesn't re-run TS/JSX transforms (those are now no-ops, but
      // skipping them is slightly cheaper).
      const loader = ext === '.tsx' || ext === '.jsx' ? 'jsx' : ext === '.ts' ? 'js' : 'js';

      return {
        contents: result?.code ?? source,
        loader,
      };
    });
  },
};

/**
 * esbuild plugin: rewrite the two i18n dynamic translation imports so
 * they resolve correctly at runtime against the single bundled output
 * file, AND so esbuild leaves them alone at build time (no glob
 * enumeration of the translations directory).
 *
 * The catalogs live as separate `.mjs` files copied into
 * build/server/hono/packages/lib/translations/ by deploy.sh /
 * .bin/build.sh - they are NOT bundled into the server bundle.
 *
 * Sources:
 *   packages/lib/utils/i18n.ts:
 *     await import(`../translations/${locale}/web.${extension}`)
 *   packages/lib/client-only/providers/i18n-server.tsx:
 *     await import(`../../translations/${lang}/web.${extension}`)
 *
 * With rollup's preserveModules layout, each file kept its source
 * relative path so `../translations/...` and `../../translations/...`
 * resolved correctly. Our esbuild output is one file at
 * build/server/hono/server/router.js so the runtime needs
 * `../packages/lib/translations/...` (one level up from the bundle).
 *
 * We can't just rewrite the path string in the template literal because
 * esbuild treats template-literal dynamic imports as glob imports and
 * tries to enumerate files at BUILD time relative to the SOURCE file
 * (not the output) - which fails. So instead we rewrite the dynamic
 * import to construct an absolute file:// URL via `import.meta.url`,
 * which esbuild leaves alone (no template literal in the import call).
 * The URL is resolved relative to the bundle's own location at runtime.
 */
const rewriteI18nDynamicImportsPlugin = {
  name: 'rewrite-i18n-dynamic-imports',
  setup(build) {
    build.onLoad({ filter: /packages[\\/]lib[\\/]utils[\\/]i18n\.ts$/ }, async (args) => {
      const source = await fs.readFile(args.path, 'utf8');
      if (!I18N_UTIL_DYNAMIC_PATH_RE.test(source)) {
        throw new Error(
          `[esbuild] i18n.ts dynamic translation import path changed; ` +
            `update rewriteI18nDynamicImportsPlugin in apps/remix/esbuild.config.mjs.`,
        );
      }
      const rewritten = source.replace(
        new RegExp('import\\(`\\.\\./translations/\\$\\{locale\\}/web\\.\\$\\{extension\\}`\\)'),
        'import(new URL(`../packages/lib/translations/${locale}/web.${extension}`, import.meta.url).href)',
      );
      return { contents: rewritten, loader: 'ts' };
    });

    build.onLoad(
      { filter: /packages[\\/]lib[\\/]client-only[\\/]providers[\\/]i18n-server\.tsx$/ },
      async (args) => {
        const source = await fs.readFile(args.path, 'utf8');
        if (!I18N_PROVIDER_DYNAMIC_PATH_RE.test(source)) {
          throw new Error(
            `[esbuild] i18n-server.tsx dynamic translation import path changed; ` +
              `update rewriteI18nDynamicImportsPlugin in apps/remix/esbuild.config.mjs.`,
          );
        }
        const rewritten = source.replace(
          new RegExp(
            'import\\(`\\.\\./\\.\\./translations/\\$\\{lang\\}/web\\.\\$\\{extension\\}`\\)',
          ),
          'import(new URL(`../packages/lib/translations/${lang}/web.${extension}`, import.meta.url).href)',
        );
        return { contents: rewritten, loader: 'tsx' };
      },
    );
  },
};

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  // tsconfigRaw not needed: esbuild auto-discovers tsconfig.json from
  // the entry point's directory and walks up. The remix tsconfig has
  // path aliases for @documenso/* but those are also resolvable via
  // node_modules symlinks, so esbuild's default resolver handles them
  // either way.
  plugins: [rewriteI18nDynamicImportsPlugin, linguiMacroPlugin, externalizeNodeModulesPlugin],
};

async function buildRouter() {
  await esbuild.build({
    ...sharedOptions,
    entryPoints: [path.join(__dirname, 'server', 'router.ts')],
    outfile: routerOut,
    // server/router.ts re-exports getLoadContext from ./load-context, so
    // the bundle already contains it.
  });
}

async function writeLoadContextShim() {
  // server/main.js imports getLoadContext from ./hono/server/load-context.js
  // separately from the default server export from ./hono/server/router.js.
  // Emit a 1-line shim so that path resolves.
  await fs.mkdir(path.dirname(loadContextOut), { recursive: true });
  await fs.writeFile(
    loadContextOut,
    "// Generated by apps/remix/esbuild.config.mjs.\nexport { getLoadContext } from './router.js';\n",
    'utf8',
  );
}

async function main() {
  // Clean previous output to avoid stale files when toggling configs.
  await fs.rm(buildOutDir, { recursive: true, force: true });

  const start = Date.now();
  await buildRouter();
  await writeLoadContextShim();
  const elapsedMs = Date.now() - start;
  console.log(`[esbuild] server bundle done in ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`[esbuild]   router:       ${path.relative(repoRoot, routerOut)}`);
  console.log(`[esbuild]   load-context: ${path.relative(repoRoot, loadContextOut)}`);
}

main().catch((err) => {
  console.error('[esbuild] build failed:', err);
  process.exit(1);
});
