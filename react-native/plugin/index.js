const {
  withPodfile,
  withMainApplication,
  withAppBuildGradle,
  withProjectBuildGradle,
  withXcodeProject,
  withAndroidManifest,
  withAppDelegate,
} = require('@expo/config-plugins');

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
  // Add imports after the last existing #import line (idempotent)
  if (!contents.includes('#import <measure-sh/MeasureSDK.h>')) {
    contents = contents.replace(
      /(#import\s+["<][^\n]+\n)(?!#import)/,
      `$1#import <measure-sh/MSRConfig.h>\n#import <measure-sh/MeasureSDK.h>\n`
    );
  }

  // Inject SDK init before `return [super application:application...]` (idempotent)
  if (!contents.includes('[MeasureSDK initializeWithApiKey:')) {
    const initCode = [
      `  MSRConfig *config = [[MSRConfig alloc] initWithEnableLogging:YES`,
      `                                                     autoStart:YES`,
      `                                      enableFullCollectionMode:YES`,
      `                                        requestHeadersProvider:NULL`,
      `                                              maxDiskUsageInMb:@300`,
      `                                          enableDiagnosticMode:YES`,
      `                               enableDiagnosticModeGesture:YES];`,
      `  [MeasureSDK initializeWithApiKey:@"${apiKey}" apiUrl:@"${apiUrl}" config:config];`,
    ].join('\n');

    contents = contents.replace(
      /(\s*return \[super application:application didFinishLaunchingWithOptions:launchOptions\];)/,
      `\n${initCode}\n$1`
    );
  }

  return contents;
}

function injectMeasureSwift(contents, apiKey, apiUrl) {
  // Add `import Measure` after last import line (idempotent)
  if (!contents.includes('import Measure')) {
    contents = contents.replace(
      /(import\s+\w+\n)(?!import)/,
      `$1import Measure\n`
    );
  }

  // Inject SDK init before bindReactNativeFactory (Expo) or window = UIWindow (vanilla RN)
  if (!contents.includes('Measure.initialize(')) {
    const initCode = [
      `    let clientInfo = ClientInfo(apiKey: "${apiKey}", apiUrl: "${apiUrl}")`,
      `    let measureConfig = BaseMeasureConfig(autoStart: true, enableFullCollectionMode: true)`,
      `    Measure.initialize(with: clientInfo, config: measureConfig)`,
    ].join('\n');

    // Expo: insert before bindReactNativeFactory
    if (contents.includes('bindReactNativeFactory')) {
      contents = contents.replace(
        /(\s*bindReactNativeFactory\()/,
        `\n${initCode}\n$1`
      );
    } else {
      // Vanilla RN: insert before window = UIWindow
      contents = contents.replace(
        /(\s*window\s*=\s*UIWindow\()/,
        `\n${initCode}\n$1`
      );
    }
  }

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
    let contents = mod.modResults.contents;

    // Ensure gradlePluginPortal() is in the buildscript repositories block
    // so the Measure Gradle plugin can be resolved.
    if (!contents.includes('gradlePluginPortal()')) {
      contents = contents.replace(
        /buildscript\s*\{([\s\S]*?)repositories\s*\{/,
        (match) => `${match}\n        gradlePluginPortal()`
      );
    }

    if (!contents.includes('sh.measure.android.gradle')) {
      contents = contents.replace(
        /dependencies\s?{/,
        `dependencies {
        classpath("sh.measure.android.gradle:sh.measure.android.gradle.gradle.plugin:0.12.0")`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

// ─── Android: app/build.gradle ───────────────────────────────────────────────

function withMeasureAppBuildGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('sh.measure:measure-android')) {
      contents = contents.replace(
        /dependencies\s?{/,
        `dependencies {
        implementation("sh.measure:measure-android:0.18.0")`
      );
    }

    // Apply the Measure Gradle plugin AFTER all other plugins so that
    // com.android.application is already applied when Measure checks for it.
    if (!contents.includes(`apply plugin: "sh.measure.android.gradle"`)) {
      contents = contents.trimEnd() + `\napply plugin: "sh.measure.android.gradle"\n`;
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

// ─── Android: MainApplication ────────────────────────────────────────────────

const ANDROID_IMPORTS = [
  'import sh.measure.android.Measure',
  'import sh.measure.android.config.MeasureConfig',
  'import okhttp3.OkHttpClient',
  'import com.facebook.react.modules.network.OkHttpClientFactory',
  'import com.facebook.react.modules.network.OkHttpClientProvider',
  'import com.facebook.react.modules.network.ReactCookieJarContainer',
  'import sh.measure.android.okhttp.MeasureOkHttpApplicationInterceptor',
  'import sh.measure.android.okhttp.MeasureEventListenerFactory',
];

const ANDROID_MEASURE_INIT = `    Measure.init(
      this,
      measureConfig = MeasureConfig(
        autoStart = true,
        enableFullCollectionMode = true,
      )
    )
    OkHttpClientProvider.setOkHttpClientFactory(object : OkHttpClientFactory {
      override fun createNewNetworkModuleClient(): OkHttpClient {
        return OkHttpClient.Builder()
          .cookieJar(ReactCookieJarContainer())
          .addInterceptor(MeasureOkHttpApplicationInterceptor())
          .eventListenerFactory(MeasureEventListenerFactory(null))
          .build()
      }
    })`;

function withMeasureMainApplication(config) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;

    // Add MeasurePackage
    if (!contents.includes('import sh.measure.rn.MeasurePackage')) {
      contents = contents.replace(
        /(package .*?\n)/,
        `$1import sh.measure.rn.MeasurePackage\n`
      );
    }
    if (!contents.includes('packages.add(MeasurePackage())')) {
      contents = contents.replace(
        /(return\s+packages;?)/,
        `packages.add(MeasurePackage())\n            $1`
      );
    }

    // Add Measure + OkHttp imports after the package declaration (idempotent)
    const missingImports = ANDROID_IMPORTS.filter((imp) => !contents.includes(imp));
    if (missingImports.length > 0) {
      contents = contents.replace(
        /(package .*?\n)/,
        `$1${missingImports.join('\n')}\n`
      );
    }

    // Inject Measure.init + OkHttp setup after super.onCreate() (idempotent)
    if (!contents.includes('Measure.init(')) {
      contents = contents.replace(
        /(super\.onCreate\(\))/,
        `$1\n${ANDROID_MEASURE_INIT}`
      );
    }

    mod.modResults.contents = contents;
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
