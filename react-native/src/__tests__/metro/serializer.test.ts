import { writeFileSync } from 'fs';
import { withMeasureConfig } from '../../metro';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeGraph(dev: boolean) {
  return { transformOptions: { dev } };
}

function makeConfig(code: string, map = '{"version":3,"mappings":""}') {
  return {
    serializer: {
      customSerializer: jest.fn().mockResolvedValue({ code, map }),
      polyfillModuleNames: [] as string[],
    },
  };
}

function makeArtifactsConfig(mapSource: string) {
  return {
    serializer: {
      customSerializer: jest.fn().mockResolvedValue({
        artifacts: [
          { filename: 'bundle.hbc', source: Buffer.from('hbc'), type: 'js', metadata: {} },
          { filename: 'bundle.hbc.map', source: mapSource, type: 'map', metadata: {} },
        ],
      }),
    },
  };
}

function capturedPatchId(): string {
  const mock = writeFileSync as jest.Mock;
  const content: string = mock.mock.calls[mock.mock.calls.length - 1][1];
  // content is: global.__measurePatchId="uuid";
  const match = content.match(/"([0-9a-f-]+)"/);
  return match![1]!;
}

beforeEach(() => {
  (writeFileSync as jest.Mock).mockClear();
});

describe('withMeasureConfig', () => {
  describe('polyfillModuleNames', () => {
    it('adds a prelude path ending in patch-id.js inside node_modules/.cache/measure/', () => {
      const config = makeConfig('var x = 1;');
      const wrapped = withMeasureConfig(config);
      const polyfills = wrapped.serializer!.polyfillModuleNames!;
      expect(polyfills.length).toBeGreaterThan(0);
      expect(polyfills[polyfills.length - 1]).toMatch(
        /node_modules[/\\]\.cache[/\\]measure[/\\]patch-id\.js$/
      );
    });

    it('appends after existing polyfillModuleNames', () => {
      const config = {
        serializer: {
          polyfillModuleNames: ['existing-polyfill.js'],
          customSerializer: jest.fn().mockResolvedValue({ code: '', map: '{"version":3}' }),
        },
      };
      const wrapped = withMeasureConfig(config);
      expect(wrapped.serializer!.polyfillModuleNames![0]).toBe('existing-polyfill.js');
      expect(wrapped.serializer!.polyfillModuleNames![1]).toMatch(/patch-id\.js$/);
    });
  });

  describe('prelude file', () => {
    it('writes global.__measurePatchId assignment inside node_modules/.cache/measure/', () => {
      withMeasureConfig(makeConfig('var x = 1;'));
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/node_modules[/\\]\.cache[/\\]measure[/\\]patch-/),
        expect.stringContaining('global.__measurePatchId=')
      );
    });

    it('embeds a valid UUID v4 in the prelude file', () => {
      withMeasureConfig(makeConfig('var x = 1;'));
      expect(capturedPatchId()).toMatch(UUID_PATTERN);
    });
  });

  describe('customSerializer — dev mode', () => {
    it('passes result through unchanged', async () => {
      const config = makeConfig('var x = 1;');
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(true), {}
      ) as { code: string; map: string };
      expect(result).toEqual({ code: 'var x = 1;', map: '{"version":3,"mappings":""}' });
    });

    it('does not inject x-measure-patch-id into sourcemap', async () => {
      const config = makeConfig('var x = 1;');
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(true), {}
      ) as { code: string; map: string };
      expect(JSON.parse(result.map)['x-measure-patch-id']).toBeUndefined();
    });
  });

  describe('customSerializer — production { code, map } mode', () => {
    it('injects a valid UUID v4 as x-measure-patch-id in sourcemap', async () => {
      const config = makeConfig('var x = 1;');
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { code: string; map: string };
      expect(JSON.parse(result.map)['x-measure-patch-id']).toMatch(UUID_PATTERN);
    });

    it('x-measure-patch-id matches the UUID written to the prelude file', async () => {
      const config = makeConfig('var x = 1;');
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { code: string; map: string };
      expect(JSON.parse(result.map)['x-measure-patch-id']).toBe(capturedPatchId());
    });

    it('does not modify the bundle code', async () => {
      const config = makeConfig('var x = 1;');
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { code: string; map: string };
      expect(result.code).toBe('var x = 1;');
    });

    it('preserves existing sourcemap fields', async () => {
      const map = JSON.stringify({ version: 3, mappings: 'abc', sources: ['App.ts'] });
      const config = makeConfig('bundle', map);
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { code: string; map: string };
      const sm = JSON.parse(result.map);
      expect(sm.version).toBe(3);
      expect(sm.mappings).toBe('abc');
      expect(sm.sources).toEqual(['App.ts']);
    });
  });

  describe('customSerializer — production { artifacts } mode (expo export)', () => {
    it('injects x-measure-patch-id into the map artifact source', async () => {
      const config = makeArtifactsConfig('{"version":3,"mappings":""}');
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { artifacts: Array<{ type: string; source: string }> };
      const mapArtifact = result.artifacts.find((a) => a.type === 'map')!;
      expect(JSON.parse(mapArtifact.source)['x-measure-patch-id']).toMatch(UUID_PATTERN);
    });

    it('x-measure-patch-id in map artifact matches the UUID written to the prelude file', async () => {
      const config = makeArtifactsConfig('{"version":3,"mappings":""}');
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { artifacts: Array<{ type: string; source: string }> };
      const mapArtifact = result.artifacts.find((a) => a.type === 'map')!;
      expect(JSON.parse(mapArtifact.source)['x-measure-patch-id']).toBe(capturedPatchId());
    });

    it('does not modify the JS artifact source', async () => {
      const hbc = Buffer.from('hbc');
      const config = makeArtifactsConfig('{"version":3,"mappings":""}');
      // Override mock to use real buffer
      (config.serializer.customSerializer as jest.Mock).mockResolvedValue({
        artifacts: [
          { filename: 'bundle.hbc', source: hbc, type: 'js', metadata: {} },
          { filename: 'bundle.hbc.map', source: '{"version":3,"mappings":""}', type: 'map', metadata: {} },
        ],
      });
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { artifacts: Array<{ type: string; source: unknown }> };
      const jsArtifact = result.artifacts.find((a) => a.type === 'js')!;
      expect(jsArtifact.source).toBe(hbc);
    });

    it('preserves existing debugId and sets x-measure-patch-id in the map artifact', async () => {
      const mapWithExistingDebugId = '{"version":3,"mappings":"","debugId":"old-uuid"}';
      const config = makeArtifactsConfig(mapWithExistingDebugId);
      const wrapped = withMeasureConfig(config);
      const result = await wrapped.serializer!.customSerializer!(
        'index.js', [], makeGraph(false), {}
      ) as { artifacts: Array<{ type: string; source: string }> };
      const mapArtifact = result.artifacts.find((a) => a.type === 'map')!;
      const sm = JSON.parse(mapArtifact.source);
      expect(sm.debugId).toBe('old-uuid');
      expect(sm['x-measure-patch-id']).toMatch(UUID_PATTERN);
    });
  });

  describe('customSerializer — no upstream', () => {
    it('is undefined when no upstream serializer is provided', () => {
      const config = { serializer: {} };
      const wrapped = withMeasureConfig(config);
      expect(wrapped.serializer!.customSerializer).toBeUndefined();
    });
  });
});
