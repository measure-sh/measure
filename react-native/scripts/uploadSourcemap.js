#!/usr/bin/env node

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- Arg parsing ---

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const REQUIRED_ARGS = [
  'bundle',
  'sourcemap',
  'api-url',
  'api-key',
  'version-name',
  'version-code',
  'app-unique-id',
  'build-size',
  'build-type',
];

function validateArgs(args) {
  const missing = REQUIRED_ARGS.filter((k) => !args[k]);
  if (missing.length > 0) {
    console.error(
      `Error: Missing required arguments: ${missing.map((k) => `--${k}`).join(', ')}`
    );
    printUsage();
    process.exit(1);
  }

  if (!['ipa', 'apk', 'aab'].includes(args['build-type'])) {
    console.error(
      `Error: --build-type must be "ipa", "apk", or "aab", got "${args['build-type']}"`
    );
    process.exit(1);
  }

  if (isNaN(parseInt(args['build-size'], 10))) {
    console.error(
      `Error: --build-size must be a number, got "${args['build-size']}"`
    );
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage: measure-upload-sourcemap [options]

Options:
  --bundle <path>          Path to the Metro JS bundle file (.js)
  --sourcemap <path>       Path to the JS source map file (.js.map)
  --api-url <url>          Measure backend URL
  --api-key <key>          Measure API key
  --version-name <name>    App version name (e.g. "1.0.0")
  --version-code <code>    App version code (e.g. "42")
  --app-unique-id <id>     App bundle ID or package name
  --build-size <bytes>     App binary size in bytes
  --build-type <type>      "ipa" for iOS, "apk" or "aab" for Android

Example:
  measure-upload-sourcemap \\
    --bundle ./build/index.bundle.js \\
    --sourcemap ./build/index.bundle.js.map \\
    --api-url https://api.measure.sh \\
    --api-key <your-api-key> \\
    --version-name 1.0.0 \\
    --version-code 42 \\
    --app-unique-id com.example.app \\
    --build-size 10241024 \\
    --build-type ipa|apk|aab
`);
}

// --- HTTP helpers ---

function jsonRequest(method, url, apiKey, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const encoded = Buffer.from(JSON.stringify(body));

    const req = transport.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': encoded.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );

    req.on('error', reject);
    req.write(encoded);
    req.end();
  });
}

function uploadFile(uploadUrl, headers, filePath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(uploadUrl);
    const transport = parsed.protocol === 'https:' ? https : http;
    const stat = fs.statSync(filePath);

    const req = transport.request(
      {
        method: 'PUT',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          ...headers,
          'Content-Length': stat.size,
        },
      },
      (res) => {
        // drain the response body
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      }
    );

    req.on('error', reject);
    fs.createReadStream(filePath).on('error', reject).pipe(req);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Main ---

async function main() {
  const args = parseArgs(process.argv);

  if (args['help'] || args['h']) {
    printUsage();
    process.exit(0);
  }

  validateArgs(args);

  const bundlePath = path.resolve(args['bundle']);
  const sourcemapPath = path.resolve(args['sourcemap']);
  const apiUrl = args['api-url'].replace(/\/$/, '');
  const apiKey = args['api-key'];
  const versionName = args['version-name'];
  const versionCode = args['version-code'];
  const appUniqueId = args['app-unique-id'];
  const buildSize = parseInt(args['build-size'], 10);
  const buildType = args['build-type'];

  if (!fs.existsSync(bundlePath)) {
    console.error(`Error: Bundle file not found: ${bundlePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(sourcemapPath)) {
    console.error(`Error: Source map file not found: ${sourcemapPath}`);
    process.exit(1);
  }

  // Create a staging dir so the tgz contains only the two files at its root
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-'));
  const bundleBasename = path.basename(bundlePath);
  const sourcemapBasename = path.basename(sourcemapPath);
  const tgzBasename = bundleBasename.replace(/\.[^.]+$/, '.tgz');
  const tgzPath = path.join(tmpDir, tgzBasename);
  const stagingDir = path.join(tmpDir, 'staging');

  let cleanupDone = false;
  function cleanup() {
    if (cleanupDone) return;
    cleanupDone = true;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  try {
    // Step 1 — package bundle + sourcemap into a tgz
    console.log('\nPackaging source map...');
    fs.mkdirSync(stagingDir);
    fs.copyFileSync(bundlePath, path.join(stagingDir, bundleBasename));
    fs.copyFileSync(sourcemapPath, path.join(stagingDir, sourcemapBasename));
    execSync(
      `tar -czf "${tgzPath}" -C "${stagingDir}" "${bundleBasename}" "${sourcemapBasename}"`,
      { stdio: 'pipe' }
    );
    console.log(`Packaged: ${tgzBasename}`);

    // Step 2 — PUT /builds to get pre-signed upload URL
    console.log('\nUploading build metadata...');
    const metaResponse = await jsonRequest('PUT', `${apiUrl}/builds`, apiKey, {
      version_name: versionName,
      version_code: versionCode,
      build_size: buildSize,
      build_type: buildType,
      app_unique_id: appUniqueId,
      mappings: [{ type: 'jsbundle', filename: tgzBasename }],
    });

    if (metaResponse.status === 401) {
      console.error('Error: Unauthorized. Please check your API key.');
      process.exit(1);
    }
    if (metaResponse.status === 413) {
      console.error(
        'Error: Build size exceeded the maximum allowed limit. Stack traces will not be symbolicated.'
      );
      process.exit(1);
    }
    if (metaResponse.status < 200 || metaResponse.status > 299) {
      console.error(
        `Error: Build metadata upload failed with status ${metaResponse.status}.`
      );
      console.error(metaResponse.body);
      process.exit(1);
    }

    // Step 3 — upload tgz to pre-signed URL
    let parsed;
    try {
      parsed = JSON.parse(metaResponse.body);
    } catch (_) {
      console.error('Error: Failed to parse server response.');
      process.exit(1);
    }

    if (!Array.isArray(parsed.mappings) || parsed.mappings.length === 0) {
      console.error('Error: Server did not return upload URLs.');
      process.exit(1);
    }

    const mapping = parsed.mappings.find((m) => m.filename === tgzBasename);
    if (!mapping) {
      console.error(
        `Error: Server response did not include an upload URL for ${tgzBasename}.`
      );
      process.exit(1);
    }

    console.log('\nUploading source map...');
    const MAX_ATTEMPTS = 3;
    let uploaded = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(
        `  Attempt ${attempt}/${MAX_ATTEMPTS}: Uploading ${tgzBasename}...`
      );
      try {
        const uploadResponse = await uploadFile(
          mapping.upload_url,
          mapping.headers ?? {},
          tgzPath
        );
        if (uploadResponse.status >= 200 && uploadResponse.status <= 299) {
          console.log(
            `  [SUCCESS]: ${tgzBasename} uploaded on attempt ${attempt}. Status: ${uploadResponse.status}`
          );
          uploaded = true;
          break;
        }
        console.error(
          `  Attempt ${attempt} failed with status ${uploadResponse.status}.`
        );
      } catch (err) {
        console.error(`  Attempt ${attempt} failed: ${err.message}`);
      }

      if (attempt < MAX_ATTEMPTS) {
        await sleep(1000);
      }
    }

    if (!uploaded) {
      console.error(
        `\nError: Failed to upload source map after ${MAX_ATTEMPTS} attempts. Stack traces will not be symbolicated.`
      );
      process.exit(1);
    }

    console.log('\nSuccessfully uploaded source map to Measure.');
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
