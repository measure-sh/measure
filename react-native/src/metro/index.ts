import { randomBytes } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

interface Graph {
  transformOptions?: { dev?: boolean };
}

type SerializerFn = (
  entryPoint: string,
  preModules: unknown[],
  graph: Graph,
  options: unknown
) => unknown;

interface SerializerConfig {
  customSerializer?: SerializerFn;
  polyfillModuleNames?: string[];
  [key: string]: unknown;
}

interface MetroConfig {
  projectRoot?: string;
  serializer?: SerializerConfig;
  [key: string]: unknown;
}

interface Artifact {
  filename: string;
  source: string;
  type: string;
  [key: string]: unknown;
}

interface SerialAssets {
  artifacts: Artifact[];
  [key: string]: unknown;
}

function generateUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function injectDebugId(mapSource: string, uuid: string): string {
  try {
    const sm = JSON.parse(mapSource) as Record<string, unknown>;
    sm.debugId = uuid;
    return JSON.stringify(sm);
  } catch (_) {
    return mapSource;
  }
}

/**
 * Wraps an Expo Metro config to automatically inject a deterministic patch ID
 * into every production bundle.
 *
 * At build time (expo export):
 *   - Generates a UUID once per build (random, stable within a single export run).
 *   - Adds a tiny polyfill that sets `global.__measurePatchId` before the app
 *     entry point. Using polyfillModuleNames (not getModulesRunBeforeMainModule)
 *     ensures Metro compiles the file as a js/script polyfill directly into the
 *     HBC prepend section, so the UUID is available at runtime.
 *   - Injects `"debugId": "<UUID>"` into the sourcemap artifact so that
 *     upload_patch.sh can read the patch ID in automated (3-arg) mode.
 *
 * Usage in metro.config.js:
 *   const { getDefaultConfig } = require('expo/metro-config');
 *   const { withMeasureConfig } = require('@measuresh/react-native/metro');
 *   module.exports = withMeasureConfig(getDefaultConfig(__dirname));
 */
export function withMeasureConfig(config: MetroConfig): MetroConfig {
  const patchId = generateUUID();

  // Fixed filename so Metro's content-hash transform cache invalidates when
  // the UUID changes between builds. node_modules/.cache/ is gitignored and
  // untouched by npm install.
  const projectRoot = resolve(config.projectRoot ?? '.');
  const cacheDir = join(projectRoot, 'node_modules', '.cache', 'measure');
  mkdirSync(cacheDir, { recursive: true });
  const preludePath = join(cacheDir, 'patch-id.js');
  writeFileSync(preludePath, `global.__measurePatchId=${JSON.stringify(patchId)};`);

  console.log('[Measure] patchId =', patchId);

  const upstream = config?.serializer?.customSerializer;
  const existingPolyfills = config?.serializer?.polyfillModuleNames ?? [];

  return {
    ...config,
    serializer: {
      ...config.serializer,
      // polyfillModuleNames → getPrependedScripts → transform as js/script →
      // prepend (preModules) → compiled directly into HBC by Hermes.
      polyfillModuleNames: [...existingPolyfills, preludePath],
      customSerializer: upstream
        ? async (entryPoint, preModules, graph, options) => {
            const dev = graph.transformOptions?.dev;

            let result: unknown;
            try {
              result = await upstream(entryPoint, preModules, graph, options);
            } catch (err) {
              console.error('[Measure] upstream serializer threw:', err);
              throw err;
            }

            if (dev) {
              return result;
            }

            if (
              result !== null &&
              result !== undefined &&
              typeof result === 'object' &&
              'artifacts' in (result as object)
            ) {
              const assets = result as SerialAssets;
              const mapArtifact = assets.artifacts.find((a) => a.type === 'map');
              if (mapArtifact?.source) {
                mapArtifact.source = injectDebugId(mapArtifact.source, patchId);
                console.log('[Measure] debugId injected into', mapArtifact.filename, '=', patchId);
              }
              return result;
            }

            if (typeof result === 'string' || result === null || result === undefined) {
              return result;
            }

            const r = result as { code: string; map: string };
            if (r.map) {
              return { code: r.code, map: injectDebugId(r.map, patchId) };
            }

            return result;
          }
        : undefined,
    },
  };
}
