const path = require('node:path')

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.ownlab.desktop',
  productName: 'OwnLab',
  icon: path.join(__dirname, 'build', 'icon.png'),
  electronDist: path.join(__dirname, 'node_modules', 'electron', 'dist'),
  afterPack: path.join(__dirname, 'scripts', 'after-pack.mjs'),
  directories: {
    buildResources: 'build',
    output: 'dist',
  },
  files: [
    'out/**',
    'package.json',
  ],
  extraResources: [
    {
      from: '.runtime',
      to: 'runtime',
    },
  ],
  mac: {
    icon: path.join(__dirname, 'build', 'icon.png'),
    category: 'public.app-category.developer-tools',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: false,
    entitlements: path.join(__dirname, 'build', 'entitlements.mac.plist'),
    entitlementsInherit: path.join(__dirname, 'build', 'entitlements.mac.inherit.plist'),
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
      {
        target: 'zip',
        arch: ['arm64', 'x64'],
      },
    ],
    signIgnore: [
      '/Contents/Resources/runtime/.*',
      '\\.node$',
      '\\.dylib$',
    ],
  },
  protocols: [
    {
      name: 'OwnLab',
      schemes: ['ownlab'],
    },
  ],
  dmg: {
    artifactName: 'ownlab-desktop-macos-${arch}.${ext}',
  },
  npmRebuild: false,
};
