const {
  withPodfile,
  withMainApplication,
  withAppBuildGradle,
  withProjectBuildGradle,
  withXcodeProject,
  withAndroidManifest,
  withAppDelegate,
} = require('@expo/config-plugins');
const { mergeContents, removeContents } = require('@expo/config-plugins/build/utils/generateCode');

// When installed, this file lives at:
//   node_modules/@measuresh/react-native/plugin/index.js
// So the package root is one directory up from __dirname.
// From the iOS project (ios/) the package is at ../node_modules/@measuresh/react-native.
const PACKAGE_NAME = '@measuresh/react-native';
const IOS_POD_PATH = `../node_modules/${PACKAGE_NAME}`;

const MEASURE_POD_TAG = `# ${PACKAGE_NAME}`;
const MEASURE_POD_LINES = `
  ${MEASURE_POD_TAG}
  pod 'MeasureReactNative', :path => '${IOS_POD_PATH}'
`;

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const UPLOAD_PHASE_NAME = 'Upload Measure Symbol Files';
const SOURCEMAP_EXPORT = 'export SOURCEMAP_FILE="$(pwd)/main.jsbundle.map"';

const ANDROID_META_KEY_API_KEY = 'sh.measure.android.API_KEY';
const ANDROID_META_KEY_API_URL = 'sh.measure.android.API_URL';

// ─── iOS: Podfile ────────────────────────────────────────────────────────────

function injectMeasurePods(contents) {
  if (!contents.includes(MEASURE_POD_TAG)) {
    return contents.replace(
      /use_react_native!\([\s\S]*?\)/,
      (match) => `${match}\n\n${MEASURE_POD_LINES}`
    );
  }
  return contents;
}

function withMeasureIos(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = injectMeasurePods(config.modResults.contents);
    return config;
  });
}

// ─── iOS: AppDelegate ────────────────────────────────────────────────────────

function withMeasureAppDelegate(config, { iosApiKey, iosApiUrl }) {
  return withAppDelegate(config, (config) => {
    const { contents, language } = config.modResults;

    if (language === 'objcpp' || language === 'objc') {
      config.modResults.contents = injectMeasureObjC(contents, iosApiKey, iosApiUrl);
    } else if (language === 'swift') {
      config.modResults.contents = injectMeasureSwift(contents, iosApiKey, iosApiUrl);
    }

    return config;
  });
}

function injectMeasureObjC(contents, apiKey, apiUrl) {
  // Inject imports after the last #import block
  contents = mergeContents({
    src: contents,
    newSrc: `#import <measure-sh/MSRConfig.h>\n#import <measure-sh/MeasureSDK.h>`,
    tag: 'measure-imports',
    anchor: /#import\s+["<][^\n]+/,
    offset: 1,
    comment: '//',
  }).contents;

  // Inject SDK init before the final return statement
  const initCode = [
    `  MSRConfig *config = [[MSRConfig alloc] initWithEnableLogging:YES`,
    `                                                     autoStart:YES`,
    `                                      enableFullCollectionMode:NO`,
    `                                        requestHeadersProvider:NULL`,
    `                                              maxDiskUsageInMb:@300`,
    `                                          enableDiagnosticMode:YES`,
    `                               enableDiagnosticModeGesture:YES];`,
    `  [MeasureSDK initializeWithApiKey:@"${apiKey}" apiUrl:@"${apiUrl}" config:config];`,
  ].join('\n');

  contents = mergeContents({
    src: contents,
    newSrc: initCode,
    tag: 'measure-init',
    anchor: /return \[super application:application didFinishLaunchingWithOptions:launchOptions\]/,
    offset: 0,
    comment: '//',
  }).contents;

  return contents;
}

function injectMeasureSwift(contents, apiKey, apiUrl) {
  // Inject `import Measure` after the last import line
  contents = mergeContents({
    src: contents,
    newSrc: 'import Measure',
    tag: 'measure-import',
    anchor: /^import\s+\w+/m,
    offset: 1,
    comment: '//',
  }).contents;

  const initCode = [
    `    let clientInfo = ClientInfo(apiKey: "${apiKey}", apiUrl: "${apiUrl}")`,
    `    let measureConfig = BaseMeasureConfig(autoStart: true, enableFullCollectionMode: false)`,
    `    Measure.initialize(with: clientInfo, config: measureConfig)`,
  ].join('\n');

  // Expo: anchor on bindReactNativeFactory; vanilla RN: anchor on window = UIWindow
  const anchor = contents.includes('bindReactNativeFactory')
    ? /bindReactNativeFactory\(/
    : /window\s*=\s*UIWindow\(/;

  contents = mergeContents({
    src: contents,
    newSrc: initCode,
    tag: 'measure-init',
    anchor,
    offset: 0,
    comment: '//',
  }).contents;

  return contents;
}

// ─── iOS: Xcode build phases ─────────────────────────────────────────────────

function withMeasureXcodeBuildPhases(config, { iosApiKey, iosApiUrl }) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const shellScriptPhases =
      xcodeProject.hash.project.objects['PBXShellScriptBuildPhase'] || {};

    // 1. Inject SOURCEMAP_FILE into the bundle build phase
    for (const phase of Object.values(shellScriptPhases)) {
      if (typeof phase !== 'object' || !phase.name) continue;
      const name = phase.name.replace(/^"|"$/g, '');
      if (name !== BUNDLE_PHASE_NAME) continue;

      try {
        const script = JSON.parse(phase.shellScript);
        if (!script.includes('SOURCEMAP_FILE')) {
          phase.shellScript = JSON.stringify(`${SOURCEMAP_EXPORT}\n${script}`);
        }
      } catch {
        // If parsing fails leave the phase untouched
      }
      break;
    }

    // 2. Add upload build phase (idempotent)
    const alreadyAdded = Object.values(shellScriptPhases).some((phase) => {
      if (typeof phase !== 'object' || !phase.shellScript) return false;
      try {
        return JSON.parse(phase.shellScript).includes('upload_build_phase.sh');
      } catch {
        return false;
      }
    });

    if (!alreadyAdded) {
      const uploadScript = `"$SRCROOT/../node_modules/${PACKAGE_NAME}/scripts/upload_build_phase.sh" "${iosApiUrl}" "${iosApiKey}"`;

      const nativeTargets = xcodeProject.pbxNativeTargetSection();
      const appTargetEntry = Object.entries(nativeTargets).find(
        ([, t]) => t.productType === '"com.apple.product-type.application"'
      );

      if (appTargetEntry) {
        const [targetKey] = appTargetEntry;
        xcodeProject.addBuildPhase(
          [],
          'PBXShellScriptBuildPhase',
          UPLOAD_PHASE_NAME,
          targetKey,
          {
            shellPath: '/bin/bash',
            shellScript: uploadScript,
            showEnvVarsInLog: 0,
            runOnlyForDeploymentPostprocessing: 0,
          }
        );
      }
    }

    return config;
  });
}

// ─── Android: AndroidManifest.xml ─────────────────────────────────────────────

function withMeasureAndroidManifest(config, { androidApiKey, androidApiUrl }) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const metaData = application['meta-data'];

    const setMetaData = (name, value) => {
      const existing = metaData.find((m) => m.$?.['android:name'] === name);
      if (existing) {
        existing.$['android:value'] = value;
      } else {
        metaData.push({ $: { 'android:name': name, 'android:value': value } });
      }
    };

    setMetaData(ANDROID_META_KEY_API_KEY, androidApiKey);
    setMetaData(ANDROID_META_KEY_API_URL, androidApiUrl);

    return config;
  });
}

// ─── Android: project-level build.gradle ─────────────────────────────────────

function withMeasureProjectBuildGradle(config) {
  return withProjectBuildGradle(config, (mod) => {
    // Ensure gradlePluginPortal() is present so the Measure Gradle plugin resolves
    mod.modResults.contents = mergeContents({
      src: mod.modResults.contents,
      newSrc: '    gradlePluginPortal()',
      tag: 'measure-gradle-portal',
      anchor: /repositories\s*\{/,
      offset: 1,
      comment: '//',
    }).contents;

    // Add Measure Gradle plugin classpath
    mod.modResults.contents = mergeContents({
      src: mod.modResults.contents,
      newSrc: '    classpath("sh.measure.android.gradle:sh.measure.android.gradle.gradle.plugin:0.13.0")',
      tag: 'measure-classpath',
      anchor: /dependencies\s*\{/,
      offset: 1,
      comment: '//',
    }).contents;

    return mod;
  });
}

// ─── Android: app/build.gradle ───────────────────────────────────────────────

function withMeasureAppBuildGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    // Add measure-android dependency
    mod.modResults.contents = mergeContents({
      src: mod.modResults.contents,
      newSrc: '    implementation("sh.measure:measure-android:0.18.0")',
      tag: 'measure-dependency',
      anchor: /dependencies\s*\{/,
      offset: 1,
      comment: '//',
    }).contents;

    // Apply the Measure Gradle plugin AFTER all other plugins so that
    // com.android.application is already applied when Measure checks for it.
    if (!mod.modResults.contents.includes('apply plugin: "sh.measure.android.gradle"')) {
      mod.modResults.contents =
        mod.modResults.contents.trimEnd() + '\napply plugin: "sh.measure.android.gradle"\n';
    }

    return mod;
  });
}

// ─── Android: MainApplication ────────────────────────────────────────────────

const ANDROID_IMPORTS = [
  'import sh.measure.rn.MeasurePackage',
  'import sh.measure.android.Measure',
  'import sh.measure.android.config.MeasureConfig',
  'import okhttp3.OkHttpClient',
  'import com.facebook.react.modules.network.OkHttpClientFactory',
  'import com.facebook.react.modules.network.OkHttpClientProvider',
  'import com.facebook.react.modules.network.ReactCookieJarContainer',
  'import sh.measure.android.okhttp.MeasureOkHttpApplicationInterceptor',
  'import sh.measure.android.okhttp.MeasureEventListenerFactory',
].join('\n');

const ANDROID_PACKAGE_REGISTRATION = 'packages.add(MeasurePackage())';

const ANDROID_MEASURE_INIT = [
  '    Measure.init(',
  '      this,',
  '      measureConfig = MeasureConfig(',
  '        autoStart = true,',
  '        enableFullCollectionMode = false,',
  '      )',
  '    )',
  '    OkHttpClientProvider.setOkHttpClientFactory(object : OkHttpClientFactory {',
  '      override fun createNewNetworkModuleClient(): OkHttpClient {',
  '        return OkHttpClient.Builder()',
  '          .cookieJar(ReactCookieJarContainer())',
  '          .addInterceptor(MeasureOkHttpApplicationInterceptor())',
  '          .eventListenerFactory(MeasureEventListenerFactory(null))',
  '          .build()',
  '      }',
  '    })',
].join('\n');

function withMeasureMainApplication(config) {
  return withMainApplication(config, (mod) => {
    // Inject all imports after the package declaration
    mod.modResults.contents = mergeContents({
      src: mod.modResults.contents,
      newSrc: ANDROID_IMPORTS,
      tag: 'measure-imports',
      anchor: /^package\s+\S+/m,
      offset: 1,
      comment: '//',
    }).contents;

    // Register MeasurePackage — supports both the legacy `return packages` pattern
    // (older RN / Expo) and the newer `PackageList(this).packages.apply {}` pattern
    // (Expo 56+ / RN 0.85+).
    if (mod.modResults.contents.includes('PackageList(this).packages.apply')) {
      mod.modResults.contents = mergeContents({
        src: mod.modResults.contents,
        newSrc: '          add(MeasurePackage())',
        tag: 'measure-package',
        anchor: /PackageList\(this\)\.packages\.apply\s*\{/,
        offset: 1,
        comment: '//',
      }).contents;
    } else {
      mod.modResults.contents = mergeContents({
        src: mod.modResults.contents,
        newSrc: `            ${ANDROID_PACKAGE_REGISTRATION}`,
        tag: 'measure-package',
        anchor: /return\s+packages/,
        offset: 0,
        comment: '//',
      }).contents;
    }

    // Inject Measure.init + OkHttp setup after super.onCreate()
    mod.modResults.contents = mergeContents({
      src: mod.modResults.contents,
      newSrc: ANDROID_MEASURE_INIT,
      tag: 'measure-init',
      anchor: /super\.onCreate\(\)/,
      offset: 1,
      comment: '//',
    }).contents;

    return mod;
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

module.exports = function withMeasurePlugin(config, options = {}) {
  const { androidApiKey, androidApiUrl, iosApiKey, iosApiUrl } = options;

  // iOS
  config = withMeasureIos(config);
  if (iosApiKey && iosApiUrl) {
    config = withMeasureAppDelegate(config, { iosApiKey, iosApiUrl });
    config = withMeasureXcodeBuildPhases(config, { iosApiKey, iosApiUrl });
  }

  // Android
  config = withMeasureProjectBuildGradle(config);
  config = withMeasureAppBuildGradle(config);
  config = withMeasureMainApplication(config);
  if (androidApiKey && androidApiUrl) {
    config = withMeasureAndroidManifest(config, { androidApiKey, androidApiUrl });
  }

  return config;
};
