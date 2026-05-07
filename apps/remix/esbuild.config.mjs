/**
 * esbuild config for the Remix server bundle (v2).
 *
 * Replaces apps/remix/rollup.config.mjs.
 *
 * History:
 *   v1 (PR #9, reverted by PR #10): bundled @documenso/* workspace TS,
 *     externalized everything else. Crashed prod with
 *     `Error: Dynamic require of "resend" is not supported`. Root cause:
 *     `@documenso/nodemailer-resend` is NOT a workspace package - it is a
 *     published npm package that happens to share the @documenso/ scope.
 *     v1's "bundle @documenso/*" rule pulled it in. Its CJS source
 *     contains `require('resend')`, which esbuild emits as a `__require2`
 *     shim that throws in an ESM bundle.
 *
 *   v2 (this file): externalize EVERY production dep declared in any
 *     workspace package.json (dependencies + peerDependencies). The
 *     bundle now contains only workspace TS source from packages/*. Node
 *     resolves third-party imports against node_modules at runtime, the
 *     same way rollup's bundle did (`external: [/node_modules/]`).
 *
 *     We also emit an ESM `createRequire` banner so any stray `require()`
 *     calls work in the ESM bundle context (defensive; with everything
 *     external this should rarely trigger, but it costs ~1 line).
 */
import { transformAsync } from '@babel/core';
import linguiMacro from '@lingui/babel-plugin-lingui-macro';
import esbuild from 'esbuild';
import { promises as fs, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const buildOutDir = path.join(__dirname, 'build', 'server', 'hono');
const routerOut = path.join(buildOutDir, 'server', 'router.js');
const loadContextOut = path.join(buildOutDir, 'server', 'load-context.js');

// --------------------------------------------------------------------
// Externals: collect every production dep from every workspace package.
// --------------------------------------------------------------------

/** Workspace package.jsons whose deps must be externalized. */
const workspacePkgs = [
  'apps/remix/package.json',
  'packages/api/package.json',
  'packages/auth/package.json',
  'packages/ee/package.json',
  'packages/email/package.json',
  'packages/lib/package.json',
  'packages/prisma/package.json',
  'packages/signing/package.json',
  'packages/trpc/package.json',
  'packages/ui/package.json',
];

const collectDeps = (rel) => {
  const j = JSON.parse(readFileSync(path.join(repoRoot, rel), 'utf8'));
  return Object.keys({ ...j.dependencies, ...j.peerDependencies });
};

/**
 * Determine which @documenso/* packages are real workspace symlinks
 * vs. published npm packages that happen to share the @documenso/
 * scope. Workspace symlinks point into packages/*\/ or apps/*\/ and
 * MUST be bundled (they're TS source). Published packages (e.g.
 * `@documenso/nodemailer-resend`, a fork that lives on npm) MUST be
 * externalized - bundling them was the v1 outage cause.
 */
const isWorkspaceSymlink = (pkgName) => {
  try {
    const stat = lstatSync(path.join(repoRoot, 'node_modules', pkgName));
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
};

const externalsSet = new Set();
for (const p of workspacePkgs) {
  for (const d of collectDeps(p)) {
    // Bundle workspace-symlinked @documenso/* (TS source). Externalize
    // everything else - including published @documenso/* packages.
    if (d.startsWith('@documenso/') && isWorkspaceSymlink(d)) continue;
    externalsSet.add(d);
  }
}
// Always-external Node builtins (most are auto-handled by `platform: 'node'`,
// but list explicitly for safety).
for (const b of [
  'fs',
  'path',
  'os',
  'crypto',
  'stream',
  'util',
  'http',
  'https',
  'url',
  'zlib',
  'buffer',
  'events',
  'child_process',
  'worker_threads',
  'module',
  'perf_hooks',
  'tls',
  'net',
  'dns',
  'readline',
  'assert',
  'querystring',
  'string_decoder',
  'timers',
  'tty',
  'vm',
  'v8',
]) {
  externalsSet.add(b);
}

const externals = [...externalsSet];

// --------------------------------------------------------------------
// Plugins
// --------------------------------------------------------------------

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
 * Externalize any bare-specifier import that resolves into real
 * node_modules (i.e. not a packages/* workspace symlink).
 *
 * The `external: [...]` static list above covers everything declared in
 * workspace package.jsons. This plugin is a belt-and-braces guard for
 * transitive deps that aren't in the static list - they get externalized
 * automatically based on where they resolve.
 *
 * Workspace packages live as symlinks at node_modules/@documenso/<name>
 * pointing into packages/<name>/, so their resolved real path lives
 * under packages/ - we let those fall through to the bundler.
 */
const externalizeNonWorkspacePlugin = {
  name: 'externalize-non-workspace',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, async (args) => {
      // Already in the static externals list? Mark external immediately.
      if (externalsSet.has(args.path)) {
        return { path: args.path, external: true };
      }
      // Subpath imports (e.g. `@aws-sdk/client-s3/foo`) - check the
      // package root.
      const pkgRoot = args.path.startsWith('@')
        ? args.path.split('/').slice(0, 2).join('/')
        : args.path.split('/')[0];
      if (externalsSet.has(pkgRoot)) {
        return { path: args.path, external: true };
      }

      // Workspace-symlinked @documenso/* packages: let esbuild resolve
      // and bundle. Published @documenso/* packages (e.g.
      // @documenso/nodemailer-resend) are externalized via the
      // externalsSet check above.
      if (args.path.startsWith('@documenso/') && isWorkspaceSymlink(pkgRoot)) {
        return null;
      }

      // Anything else (transitive deps not in workspace package.jsons):
      // mark external so Node resolves it at runtime.
      return { path: args.path, external: true };
    });
  },
};

/**
 * Run the lingui babel macro on any .ts/.tsx file that imports from
 * `@lingui/core/macro`, `@lingui/react/macro`, or `@lingui/macro`. Other
 * .ts/.tsx files are left for esbuild's built-in transpiler. Mirrors
 * what rollup's babel plugin was doing, but only on files that need it.
 */
const linguiMacroPlugin = {
  name: 'lingui-macro',
  setup(build) {
    build.onLoad({ filter: /\.(tsx?|jsx?)$/ }, async (args) => {
      if (args.path.includes(`${path.sep}node_modules${path.sep}`)) {
        return null;
      }

      const source = await fs.readFile(args.path, 'utf8');

      if (!LINGUI_MACRO_RE.test(source)) {
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
      const loader = ext === '.tsx' || ext === '.jsx' ? 'jsx' : ext === '.ts' ? 'js' : 'js';

      return {
        contents: result?.code ?? source,
        loader,
      };
    });
  },
};

/**
 * Rewrite the two i18n dynamic translation imports so they resolve
 * correctly at runtime against the single bundled output file, AND so
 * esbuild leaves them alone at build time (no glob enumeration of the
 * translations directory).
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
 * Our esbuild output is one file at build/server/hono/server/router.js
 * so the runtime needs `../packages/lib/translations/...` (one level up
 * from the bundle). We rewrite the dynamic import to construct an
 * absolute file:// URL via `import.meta.url`, which esbuild leaves alone
 * (no template literal in the import call). The URL is resolved
 * relative to the bundle's own location at runtime.
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

// --------------------------------------------------------------------
// Build
// --------------------------------------------------------------------

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  external: externals,
  // Use the automatic JSX runtime so files that don't `import React`
  // still compile (esbuild defaults to the classic transform, which
  // emits `React.createElement` and crashes at runtime if React is not
  // in scope). Several email template-components (e.g.
  // template-image.tsx, template-document-image.tsx) ship JSX without
  // a React import; they previously broke `send.signing.requested.email`
  // and other email-rendering background jobs in CI with
  // `ReferenceError: React is not defined`. The lingui babel plugin
  // already runs `@babel/preset-react` with `runtime: 'automatic'` for
  // files it touches, so this matches that behaviour for everything else.
  jsx: 'automatic',
  // CRITICAL: emitting ESM but bundling code that may keep CJS-style
  // require() calls (esbuild's commonjs transform sometimes emits
  // `__require2(...)`). Without this banner, `require` is undefined in
  // ESM context and the call throws at runtime - that was the v1 outage.
  banner: {
    js: "import { createRequire as __esbuildCreateRequire } from 'node:module'; const require = __esbuildCreateRequire(import.meta.url);",
  },
  plugins: [rewriteI18nDynamicImportsPlugin, linguiMacroPlugin, externalizeNonWorkspacePlugin],
};

async function buildRouter() {
  await esbuild.build({
    ...sharedOptions,
    entryPoints: [path.join(__dirname, 'server', 'router.ts')],
    outfile: routerOut,
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
  await fs.rm(buildOutDir, { recursive: true, force: true });

  const start = Date.now();
  await buildRouter();
  await writeLoadContextShim();
  const elapsedMs = Date.now() - start;

  // Stat the bundle so we surface its size in build logs - a sudden
  // jump from ~hundreds of KB into multi-MB territory means something
  // started getting bundled that shouldn't be (the v1 failure mode).
  const stat = await fs.stat(routerOut);
  const sizeKb = (stat.size / 1024).toFixed(1);

  console.log(`[esbuild] server bundle done in ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`[esbuild]   router:       ${path.relative(repoRoot, routerOut)} (${sizeKb} KB)`);
  console.log(`[esbuild]   load-context: ${path.relative(repoRoot, loadContextOut)}`);
  console.log(`[esbuild]   externals:    ${externals.length} packages`);
}

main().catch((err) => {
  console.error('[esbuild] build failed:', err);
  process.exit(1);
});
