/**
 * The collector only requires `expo-updates` / `expo-constants` after finding
 * the package's native module, so these tests drive both the native module
 * registry (`globalThis.expo.modules`) and the JS modules themselves.
 *
 * Jest resolves modules eagerly, so each state is set up with `jest.doMock`
 * inside `jest.isolateModules`. An uninstalled package is simulated by making
 * the module factory throw, matching Metro's runtime behaviour for an
 * unresolved optional dependency.
 */

const UPDATES = 'expo-updates';
const CONSTANTS = 'expo-constants';
const UPDATES_NATIVE_MODULE = 'ExpoUpdates';
const CONSTANTS_NATIVE_MODULE = 'ExponentConstants';
const UPDATE_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function loadCollector() {
  return require('../../expoUpdates/expoAttributes').collectExpoAttributes();
}

/** Registers the given Expo native modules, as expo-modules-core would. */
function installNativeModules(...names: string[]) {
  (globalThis as any).expo = {
    modules: Object.fromEntries(names.map((name) => [name, {}])),
  };
}

/**
 * Mocks a module as uninstalled. Metro leaves an unresolved optional dependency
 * out of the bundle, so requiring it throws.
 */
function mockAbsent(name: string) {
  const factory = jest.fn(() => {
    throw new Error(`Requiring unknown module "884".`);
  });
  jest.doMock(name, factory, { virtual: true });
  return factory;
}

function mockModule(name: string, value: unknown) {
  jest.doMock(name, () => value, { virtual: true });
}

function mockEsModuleWithDefault(name: string, value: unknown) {
  jest.doMock(name, () => ({ __esModule: true, default: value }), {
    virtual: true,
  });
}

function collectWith(
  setup: () => void
): Record<string, string | boolean> | undefined {
  let result: Record<string, string | boolean> | undefined;
  jest.isolateModules(() => {
    setup();
    result = loadCollector();
  });
  return result;
}

describe('collectExpoAttributes', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (globalThis as any).expo;
  });

  afterEach(() => {
    delete (globalThis as any).expo;
  });

  it('returns no attributes when neither Expo package is installed', () => {
    const attrs = collectWith(() => {
      mockAbsent(UPDATES);
      mockAbsent(CONSTANTS);
    });

    expect(attrs).toEqual({});
  });

  it('never requires expo-updates when its native module is absent', () => {
    let factory: jest.Mock | undefined;
    const attrs = collectWith(() => {
      factory = mockAbsent(UPDATES);
      mockAbsent(CONSTANTS);
    });

    expect(factory).not.toHaveBeenCalled();
    expect(attrs).toEqual({});
  });

  it('never requires expo-constants when its native module is absent', () => {
    let factory: jest.Mock | undefined;
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE);
      mockModule(UPDATES, { updateId: UPDATE_ID });
      factory = mockAbsent(CONSTANTS);
    });

    expect(factory).not.toHaveBeenCalled();
    expect(attrs).toEqual({ expo_update_id: UPDATE_ID });
  });

  it('collects expo-constants attributes when expo-updates is absent', () => {
    const attrs = collectWith(() => {
      installNativeModules(CONSTANTS_NATIVE_MODULE);
      mockAbsent(UPDATES);
      mockEsModuleWithDefault(CONSTANTS, {
        executionEnvironment: 'standalone',
        expoVersion: '56.0.9',
        expoConfig: { sdkVersion: '56.0.0', runtimeVersion: '1.0.0' },
        easConfig: { projectId: 'eas-project-id' },
      });
    });

    expect(attrs).toEqual({
      expo_execution_environment: 'standalone',
      expo_version: '56.0.9',
      expo_sdk_version: '56.0.0',
      expo_eas_project_id: 'eas-project-id',
      expo_runtime_version: '1.0.0',
    });
  });

  it('collects the full set when both packages are present and updates are enabled', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE, CONSTANTS_NATIVE_MODULE);
      mockModule(UPDATES, {
        isEnabled: true,
        updateId: '0f8fad5b-d9cb-469f-a165-70867728950e',
        runtimeVersion: '2.0.0',
        isEmbeddedLaunch: false,
        isUsingEmbeddedAssets: false,
        checkAutomatically: 'ON_LOAD',
      });
      mockEsModuleWithDefault(CONSTANTS, {
        executionEnvironment: 'standalone',
        expoVersion: '56.0.9',
        expoConfig: { sdkVersion: '56.0.0', runtimeVersion: '1.0.0' },
        easConfig: { projectId: 'eas-project-id' },
      });
    });

    expect(attrs).toEqual({
      expo_update_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      expo_runtime_version: '2.0.0',
      is_expo_embedded_launch: false,
      is_expo_using_embedded_assets: false,
      expo_automatic_update_policy: 'on_load',
      expo_execution_environment: 'standalone',
      expo_version: '56.0.9',
      expo_sdk_version: '56.0.0',
      expo_eas_project_id: 'eas-project-id',
    });
  });

  it('falls back to the NativeModules proxy for older Expo versions', () => {
    const attrs = collectWith(() => {
      // No globalThis.expo — the module is only on the proxy.
      jest.doMock('react-native', () => ({
        NativeModules: { [UPDATES_NATIVE_MODULE]: {} },
      }));
      mockModule(UPDATES, { updateId: UPDATE_ID });
      mockAbsent(CONSTANTS);
    });

    expect(attrs).toEqual({ expo_update_id: UPDATE_ID });
  });

  it('reads expo-constants values from the default export', () => {
    const attrs = collectWith(() => {
      installNativeModules(CONSTANTS_NATIVE_MODULE);
      mockAbsent(UPDATES);
      mockEsModuleWithDefault(CONSTANTS, {
        executionEnvironment: 'standalone',
        expoVersion: '56.0.9',
        expoConfig: { sdkVersion: '56.0.0' },
        easConfig: { projectId: 'eas-project-id' },
      });
    });

    expect(attrs).toEqual({
      expo_execution_environment: 'standalone',
      expo_version: '56.0.9',
      expo_sdk_version: '56.0.0',
      expo_eas_project_id: 'eas-project-id',
    });
  });

  it('reads expo-constants values from the namespace when there is no default', () => {
    const attrs = collectWith(() => {
      installNativeModules(CONSTANTS_NATIVE_MODULE);
      mockAbsent(UPDATES);
      mockModule(CONSTANTS, {
        executionEnvironment: 'bare',
        expoConfig: { sdkVersion: '56.0.0' },
      });
    });

    expect(attrs).toEqual({
      expo_execution_environment: 'bare',
      expo_sdk_version: '56.0.0',
    });
  });

  it('prefers the runtime version from expo-updates over the app config', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE, CONSTANTS_NATIVE_MODULE);
      mockModule(UPDATES, { runtimeVersion: '2.0.0' });
      mockEsModuleWithDefault(CONSTANTS, {
        expoConfig: { runtimeVersion: '1.0.0' },
      });
    });

    expect(attrs?.expo_runtime_version).toBe('2.0.0');
  });

  it('omits update attributes when expo-updates is installed but disabled', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE, CONSTANTS_NATIVE_MODULE);
      mockModule(UPDATES, {
        isEnabled: false,
        updateId: null,
        runtimeVersion: null,
        isEmbeddedLaunch: null,
        isUsingEmbeddedAssets: null,
        checkAutomatically: null,
      });
      mockEsModuleWithDefault(CONSTANTS, {
        executionEnvironment: 'bare',
        expoConfig: { sdkVersion: '56.0.0' },
      });
    });

    expect(attrs).toEqual({
      expo_execution_environment: 'bare',
      expo_sdk_version: '56.0.0',
    });
  });

  it('lowercases the automatic update policy', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE);
      mockAbsent(CONSTANTS);
      mockModule(UPDATES, { checkAutomatically: 'ON_ERROR_RECOVERY' });
    });

    expect(attrs?.expo_automatic_update_policy).toBe('on_error_recovery');
  });

  it('keeps false booleans, which are meaningful values', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE);
      mockAbsent(CONSTANTS);
      mockModule(UPDATES, {
        isEmbeddedLaunch: false,
        isUsingEmbeddedAssets: false,
      });
    });

    expect(attrs).toEqual({
      is_expo_embedded_launch: false,
      is_expo_using_embedded_assets: false,
    });
  });

  it('drops empty strings rather than reporting them as values', () => {
    const attrs = collectWith(() => {
      installNativeModules(CONSTANTS_NATIVE_MODULE);
      mockAbsent(UPDATES);
      mockEsModuleWithDefault(CONSTANTS, {
        executionEnvironment: '',
        expoVersion: '',
        expoConfig: { sdkVersion: '' },
      });
    });

    expect(attrs).toEqual({});
  });

  it('falls back to expoConfig.extra.eas for the project id', () => {
    const attrs = collectWith(() => {
      installNativeModules(CONSTANTS_NATIVE_MODULE);
      mockAbsent(UPDATES);
      mockEsModuleWithDefault(CONSTANTS, {
        expoConfig: { extra: { eas: { projectId: 'extra-project-id' } } },
      });
    });

    expect(attrs?.expo_eas_project_id).toBe('extra-project-id');
  });

  it('still collects expo-updates attributes when expo-constants throws', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE, CONSTANTS_NATIVE_MODULE);
      mockModule(UPDATES, { updateId: UPDATE_ID });
      mockEsModuleWithDefault(CONSTANTS, {
        get expoConfig(): never {
          throw new Error('Constants.manifest is null, must be an object.');
        },
      });
    });

    expect(attrs).toEqual({ expo_update_id: UPDATE_ID });
  });

  it('does not throw when a require resolves to undefined', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE, CONSTANTS_NATIVE_MODULE);
      mockModule(UPDATES, undefined);
      mockModule(CONSTANTS, undefined);
    });

    expect(attrs).toEqual({});
  });

  it('does not throw when a module resolves to null', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE, CONSTANTS_NATIVE_MODULE);
      mockModule(UPDATES, null);
      mockModule(CONSTANTS, null);
    });

    expect(attrs).toEqual({});
  });

  it('drops an update id that is not a UUID', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE);
      mockModule(UPDATES, { updateId: 'not-a-uuid', runtimeVersion: '1.0.0' });
      mockAbsent(CONSTANTS);
    });

    expect(attrs).toEqual({ expo_runtime_version: '1.0.0' });
  });

  it('truncates string attributes to their backend limits', () => {
    const attrs = collectWith(() => {
      installNativeModules(UPDATES_NATIVE_MODULE, CONSTANTS_NATIVE_MODULE);
      mockModule(UPDATES, {
        runtimeVersion: 'r'.repeat(129),
        checkAutomatically: 'p'.repeat(33),
      });
      mockEsModuleWithDefault(CONSTANTS, {
        executionEnvironment: 'e'.repeat(33),
        expoVersion: 'v'.repeat(33),
        expoConfig: { sdkVersion: 's'.repeat(33) },
        easConfig: { projectId: 'i'.repeat(65) },
      });
    });

    expect(attrs).toEqual({
      expo_runtime_version: 'r'.repeat(128),
      expo_automatic_update_policy: 'p'.repeat(32),
      expo_execution_environment: 'e'.repeat(32),
      expo_version: 'v'.repeat(32),
      expo_sdk_version: 's'.repeat(32),
      expo_eas_project_id: 'i'.repeat(64),
    });
  });
});
