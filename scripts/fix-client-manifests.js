#!/usr/bin/env node

/**
 * Fix Client Reference Manifests
 *
 * This script helps resolve missing client reference manifest files
 * that can occur during Vercel deployments.
 */

const fs = require('node:fs');
const path = require('node:path');

const serverAppDir = '.next/server/app';

function findMissingManifests() {
  const missingManifests = [];

  // Check for common problematic routes
  const routesToCheck = ['(chat)', '(auth)', 'chat', 'chat/[id]'];

  routesToCheck.forEach((route) => {
    const routeDir = path.join(serverAppDir, route);
    const manifestFile = path.join(
      routeDir,
      'page_client-reference-manifest.js',
    );

    if (fs.existsSync(routeDir) && !fs.existsSync(manifestFile)) {
      // Check if there's a page.js file (indicating this should have a manifest)
      const pageFile = path.join(routeDir, 'page.js');
      if (fs.existsSync(pageFile)) {
        missingManifests.push({ route, routeDir, manifestFile });
      }
    }
  });

  return missingManifests;
}

function copyManifestFromSimilarRoute(missingManifest) {
  // Try to find a similar manifest to copy
  const possibleSources = [
    path.join(serverAppDir, 'chat', 'page_client-reference-manifest.js'),
    path.join(serverAppDir, 'page_client-reference-manifest.js'),
  ];

  for (const source of possibleSources) {
    if (fs.existsSync(source)) {
      try {
        fs.copyFileSync(source, missingManifest.manifestFile);
        console.log(
          `✅ Copied manifest from ${source} to ${missingManifest.manifestFile}`,
        );
        return true;
      } catch (error) {
        console.error(`❌ Failed to copy manifest: ${error.message}`);
      }
    }
  }

  return false;
}

function main() {
  console.log('🔍 Checking for missing client reference manifests...');

  if (!fs.existsSync(serverAppDir)) {
    console.log(
      '❌ .next/server/app directory not found. Make sure you have built the project.',
    );
    process.exit(1);
  }

  const missingManifests = findMissingManifests();

  if (missingManifests.length === 0) {
    console.log('✅ All client reference manifests are present.');
    return;
  }

  console.log(
    `⚠️  Found ${missingManifests.length} missing client reference manifest(s):`,
  );
  missingManifests.forEach((manifest) => {
    console.log(`   - ${manifest.route}`);
  });

  console.log('\n🔧 Attempting to fix missing manifests...');

  let fixedCount = 0;
  missingManifests.forEach((manifest) => {
    if (copyManifestFromSimilarRoute(manifest)) {
      fixedCount++;
    }
  });

  console.log(
    `\n✅ Fixed ${fixedCount} out of ${missingManifests.length} missing manifests.`,
  );

  if (fixedCount < missingManifests.length) {
    console.log('⚠️  Some manifests could not be fixed automatically.');
    console.log(
      '   This might indicate a deeper routing issue that needs manual resolution.',
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = { findMissingManifests, copyManifestFromSimilarRoute };
