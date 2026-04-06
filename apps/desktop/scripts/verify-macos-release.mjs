import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(process.argv[2] || 'dist');
const requireValidSignature = process.argv.includes('--require-valid-signature');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    const message = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed.\n${message}`);
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function tryRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function relative(target) {
  return target.replace(`${outputDir}/`, '');
}

function verifyCodesign(target, deep = false) {
  const args = ['--verify', '--strict', '--verbose=2'];
  if (deep) {
    args.splice(1, 0, '--deep');
  }
  args.push(target);
  run('codesign', args);
}

function bundleMetadata(target) {
  const { stderr } = run('codesign', ['-dvv', target]);
  const lines = stderr.split(/\r?\n/);
  return {
    identifier: lines.find((line) => line.startsWith('Identifier='))?.replace(/^Identifier=/, '') || null,
    authority: lines.find((line) => line.startsWith('Authority='))?.replace(/^Authority=/, '') || null,
    teamIdentifier: lines.find((line) => line.startsWith('TeamIdentifier='))?.replace(/^TeamIdentifier=/, '') || null,
  };
}

const appBundles = collectTopLevelAppBundles(outputDir);

if (appBundles.length === 0) {
  throw new Error(`No macOS app bundle found under ${outputDir}.`);
}

const summary = {
  outputDir,
  requireValidSignature,
  appBundles: appBundles.map((appBundle) => {
    const verification = tryRun('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appBundle]);
    if (requireValidSignature && !verification.ok) {
      throw new Error(verification.stderr || verification.stdout || `codesign verification failed for ${appBundle}`);
    }

    const infoPlist = path.join(appBundle, 'Contents', 'Info.plist');
    const protocols = existsSync(infoPlist)
      ? JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', infoPlist]).stdout).CFBundleURLTypes ?? []
      : [];

    return {
      path: relative(appBundle),
      codesign: {
        ok: verification.ok,
        error: verification.ok ? null : [verification.stdout, verification.stderr].filter(Boolean).join('\n').trim(),
      },
      metadata: bundleMetadata(appBundle),
      protocols,
    };
  }),
};

mkdirSync(outputDir, { recursive: true });
const reportPath = path.join(outputDir, 'verification-summary.json');
writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(`Verified macOS desktop bundle(s) in ${outputDir}`);
console.log(`Verification summary: ${reportPath}`);

function collectTopLevelAppBundles(rootDir) {
  const bundles = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const platformDir = path.join(rootDir, entry.name);
    for (const child of readdirSync(platformDir, { withFileTypes: true })) {
      if (child.isDirectory() && child.name.endsWith('.app')) {
        bundles.push(path.join(platformDir, child.name));
      }
    }
  }

  return bundles;
}
