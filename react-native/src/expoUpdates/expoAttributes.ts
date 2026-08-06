import { NativeModules } from 'react-native';

export const EXPO_UPDATE_ID_KEY = 'expo_update_id';
export const EXPO_RUNTIME_VERSION_KEY = 'expo_runtime_version';
export const IS_EXPO_EMBEDDED_LAUNCH_KEY = 'is_expo_embedded_launch';
export const IS_EXPO_USING_EMBEDDED_ASSETS_KEY =
  'is_expo_using_embedded_assets';
export const EXPO_AUTOMATIC_UPDATE_POLICY_KEY = 'expo_automatic_update_policy';
export const EXPO_EXECUTION_ENVIRONMENT_KEY = 'expo_execution_environment';
export const EXPO_VERSION_KEY = 'expo_version';
export const EXPO_SDK_VERSION_KEY = 'expo_sdk_version';
export const EXPO_EAS_PROJECT_ID_KEY = 'expo_eas_project_id';

export type ExpoAttributes = Record<string, string | boolean>;

interface ExpoUpdatesModule {
  isEnabled?: boolean;
  updateId?: string | null;
  runtimeVersion?: string | null;
  isEmbeddedLaunch?: boolean | null;
  isUsingEmbeddedAssets?: boolean | null;
  checkAutomatically?: string | null;
}

interface ExpoConstantsModule {
  executionEnvironment?: string | null;
  expoVersion?: string | null;
  expoConfig?: {
    sdkVersion?: string | null;
    runtimeVersion?: string | null;
    extra?: { eas?: { projectId?: string | null } | null } | null;
  } | null;
  easConfig?: { projectId?: string | null } | null;
}

/** Expo module name registered by `expo-updates`. */
const EXPO_UPDATES_NATIVE_MODULE = 'ExpoUpdates';

/** Expo module name registered by `expo-constants`. */
const EXPO_CONSTANTS_NATIVE_MODULE = 'ExponentConstants';

/**
 * Reports whether an Expo native module is registered in this app.
 *
 * Mirrors `requireOptionalNativeModule` from `expo-modules-core`, but without
 * depending on it — that package is itself absent in bare React Native apps.
 * `expo-constants` detects `expo-updates` the same way.
 */
function hasNativeModule(name: string): boolean {
  try {
    const expoModules = (globalThis as any).expo?.modules;
    if (expoModules?.[name]) {
      return true;
    }
    // Fallback for Expo versions that expose modules through the proxy.
    return !!(NativeModules as Record<string, unknown> | undefined)?.[name];
  } catch {
    return false;
  }
}

/**
 * Unwraps a transpiled ES module's default export.
 *
 * `expo-constants` ends in `export default constants`, so `require()` returns
 * the module namespace and the values live on `.default`. `expo-updates` only
 * uses named exports, so its values are on the namespace itself. Handling both
 * keeps this working whichever shape a package ships.
 */
function interopDefault<T>(module: any): T | undefined {
  return (module?.default ?? module) as T | undefined;
}

/**
 * Adds `key` to `target` when `value` is a usable string or boolean.
 *
 * Null, undefined and empty strings are dropped so absent metadata stays absent
 * rather than being reported as an empty value.
 */
function put(
  target: ExpoAttributes,
  key: string,
  value: string | boolean | null | undefined
): void {
  if (typeof value === 'boolean') {
    target[key] = value;
    return;
  }
  if (typeof value === 'string' && value.length > 0) {
    target[key] = value;
  }
}

/**
 * Collects attributes exposed by `expo-updates`.
 */
function collectUpdatesAttributes(target: ExpoAttributes): void {
  if (!hasNativeModule(EXPO_UPDATES_NATIVE_MODULE)) {
    return;
  }

  try {
    // The require must remain the first statement inside this try block for
    // Metro to treat it as an optional dependency.
    const updates = interopDefault<ExpoUpdatesModule>(require('expo-updates'));
    if (!updates) {
      return;
    }

    put(target, EXPO_UPDATE_ID_KEY, updates.updateId);
    put(target, EXPO_RUNTIME_VERSION_KEY, updates.runtimeVersion);
    put(target, IS_EXPO_EMBEDDED_LAUNCH_KEY, updates.isEmbeddedLaunch);
    put(
      target,
      IS_EXPO_USING_EMBEDDED_ASSETS_KEY,
      updates.isUsingEmbeddedAssets
    );
    put(
      target,
      EXPO_AUTOMATIC_UPDATE_POLICY_KEY,
      updates.checkAutomatically?.toLowerCase()
    );
  } catch {
    // expo-updates is not installed, or reading it failed. Both are expected.
  }
}

/**
 * Collects attributes exposed by `expo-constants`.
 */
function collectConstantsAttributes(target: ExpoAttributes): void {
  if (!hasNativeModule(EXPO_CONSTANTS_NATIVE_MODULE)) {
    return;
  }

  try {
    const constants = interopDefault<ExpoConstantsModule>(
      require('expo-constants')
    );
    if (!constants) {
      return;
    }

    put(target, EXPO_EXECUTION_ENVIRONMENT_KEY, constants.executionEnvironment);
    put(target, EXPO_VERSION_KEY, constants.expoVersion);
    put(target, EXPO_SDK_VERSION_KEY, constants.expoConfig?.sdkVersion);
    put(
      target,
      EXPO_EAS_PROJECT_ID_KEY,
      constants.easConfig?.projectId ??
        constants.expoConfig?.extra?.eas?.projectId
    );

    // expo-updates reports the runtime version of the running update, which is
    // the more accurate value. Fall back to the app config when it is absent.
    if (!(EXPO_RUNTIME_VERSION_KEY in target)) {
      put(
        target,
        EXPO_RUNTIME_VERSION_KEY,
        constants.expoConfig?.runtimeVersion
      );
    }
  } catch {
    // expo-constants is not installed, or reading it failed. Both are expected.
  }
}

/**
 * Returns the Expo attributes available in this app.
 *
 * Returns an empty object for bare React Native apps. Never throws a failure
 * to read Expo metadata must not prevent the SDK from initializing.
 */
export function collectExpoAttributes(): ExpoAttributes {
  const attributes: ExpoAttributes = {};

  try {
    collectUpdatesAttributes(attributes);
    collectConstantsAttributes(attributes);
  } catch {
    return attributes;
  }

  return attributes;
}
