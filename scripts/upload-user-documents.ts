#!/usr/bin/env tsx

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { addSystemContent } from '@/lib/ai/system-rag';

/**
 * Upload documents for EOS Implementer persona profiles
 * This script processes documents in profile-specific directories
 * and uploads them to the appropriate Upstash namespaces for the EOS Implementer persona
 */

const EOS_DOCUMENTS_DIR = 'eos-implementer-documents'; // Root directory for EOS Implementer documents

// Mapping of directory names to EOS Implementer profile namespaces
const PROFILE_NAMESPACE_MAPPING = {
  general: 'eos-implementer',
  'vision-day-1': 'eos-implementer-vision-day-1',
  'vision-day-2': 'eos-implementer-vision-day-2',
  'quarterly-planning': 'eos-implementer-quarterly-planning',
  'level-10': 'eos-implementer-level-10',
  ids: 'eos-implementer-ids',
  'annual-planning': 'eos-implementer-annual-planning',
} as const;

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.doc', '.docx'];

interface UploadResult {
  success: boolean;
  fileName: string;
  profile: string;
  namespace: string;
  error?: string;
}

async function processFile(
  filePath: string,
  namespace: string,
  profileName: string,
): Promise<UploadResult> {
  const fileName = basename(filePath);

  try {
    console.log(`📤 Processing ${fileName} for ${profileName} profile`);

    // Read file content
    const content = await readFile(filePath, 'utf-8');

    // Skip empty files
    if (content.trim().length < 50) {
      console.log(`   ⏭️  Skipping empty file: ${fileName}`);
      return {
        success: false,
        fileName,
        profile: profileName,
        namespace,
        error: 'File too short or empty',
      };
    }

    // Extract title from filename (remove extension and format)
    const title = fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
      .replace(/\b\w/g, (l) => l.toUpperCase()); // Title case

    // Add content to system knowledge base
    await addSystemContent(namespace, title, content, {
      fileName,
      profile: profileName,
      uploadedAt: new Date().toISOString(),
      source: 'eos-implementer-upload',
    });

    console.log(`   ✅ Successfully uploaded: ${title}`);

    return {
      success: true,
      fileName,
      profile: profileName,
      namespace,
    };
  } catch (error) {
    console.error(`   ❌ Failed to process ${fileName}:`, error);
    return {
      success: false,
      fileName,
      profile: profileName,
      namespace,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function processDirectory(
  dirPath: string,
  namespace: string,
  profileName: string,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subResults = await processDirectory(
          fullPath,
          namespace,
          profileName,
        );
        results.push(...subResults);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();

        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const result = await processFile(fullPath, namespace, profileName);
          results.push(result);
        } else {
          console.log(`   ⏭️  Skipping unsupported file: ${entry.name}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
  }

  return results;
}

async function uploadEOSImplementerDocuments() {
  console.log('🚀 Starting EOS Implementer document upload...');
  console.log(`📁 Base directory: ${EOS_DOCUMENTS_DIR}`);

  try {
    // Check if EOS documents directory exists
    try {
      await stat(EOS_DOCUMENTS_DIR);
    } catch {
      console.error(
        `❌ Error: Directory '${EOS_DOCUMENTS_DIR}' does not exist`,
      );
      console.log(
        `   Please create the directory and add your documents in profile folders:`,
      );
      console.log(`   ${EOS_DOCUMENTS_DIR}/`);
      console.log(`   ├── general/                # General EOS methodology`);
      console.log(
        `   ├── vision-day-1/           # Vision Building Day 1 - People and Data`,
      );
      console.log(
        `   ├── vision-day-2/           # Vision Building Day 2 - Vision, Issues, Process, Traction`,
      );
      console.log(
        `   ├── quarterly-planning/     # Quarterly planning sessions`,
      );
      console.log(
        `   ├── level-10/               # Level 10 meeting facilitation`,
      );
      console.log(
        `   ├── ids/                    # Issues Solving (IDS) methodology`,
      );
      console.log(
        `   └── annual-planning/        # Annual planning and strategic sessions`,
      );
      process.exit(1);
    }

    // Get all profile directories
    const entries = await readdir(EOS_DOCUMENTS_DIR, { withFileTypes: true });
    const profileDirs = entries.filter((entry) => entry.isDirectory());

    if (profileDirs.length === 0) {
      console.log(
        '⚠️  No profile directories found in eos-implementer-documents/',
      );
      console.log('   Create folders for EOS Implementer profiles:');
      Object.keys(PROFILE_NAMESPACE_MAPPING).forEach((profile) => {
        console.log(`   - ${profile}/`);
      });
      process.exit(0);
    }

    console.log(`📂 Found ${profileDirs.length} profile directories`);

    const allResults: UploadResult[] = [];

    // Process each profile directory
    for (const dir of profileDirs) {
      const dirName = dir.name.toLowerCase();
      const namespace =
        PROFILE_NAMESPACE_MAPPING[
          dirName as keyof typeof PROFILE_NAMESPACE_MAPPING
        ];

      if (!namespace) {
        console.log(`\n⚠️  Unknown profile directory: ${dir.name}`);
        console.log(
          `   Valid profiles: ${Object.keys(PROFILE_NAMESPACE_MAPPING).join(', ')}`,
        );
        continue;
      }

      // Get profile display name
      const profileDisplayNames = {
        general: 'General EOS Implementer',
        'vision-day-1': 'Vision Building Day 1',
        'vision-day-2': 'Vision Building Day 2',
        'quarterly-planning': 'Quarterly Planning',
        'level-10': 'Level 10 Meeting Facilitation',
        ids: 'Issues Solving (IDS)',
        'annual-planning': 'Annual Planning',
      };

      const profileName =
        profileDisplayNames[dirName as keyof typeof profileDisplayNames] ||
        dirName;

      console.log(`\n📂 Processing profile: ${profileName}`);
      console.log(`   📍 Namespace: ${namespace}`);

      const dirPath = join(EOS_DOCUMENTS_DIR, dir.name);
      const results = await processDirectory(dirPath, namespace, profileName);
      allResults.push(...results);
    }

    // Summary
    console.log('\n📊 Upload Summary:');
    console.log('='.repeat(60));

    const successful = allResults.filter((r) => r.success);
    const failed = allResults.filter((r) => !r.success);

    console.log(`✅ Successful uploads: ${successful.length}`);
    console.log(`❌ Failed uploads: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\nSuccessfully uploaded files by profile:');

      // Group by profile
      const byProfile = successful.reduce(
        (acc, result) => {
          if (!acc[result.profile]) acc[result.profile] = [];
          acc[result.profile].push(result);
          return acc;
        },
        {} as Record<string, UploadResult[]>,
      );

      Object.entries(byProfile).forEach(([profile, results]) => {
        console.log(`\n  📋 ${profile}:`);
        results.forEach((r) => {
          console.log(`     - ${r.fileName}`);
        });
      });
    }

    if (failed.length > 0) {
      console.log('\nFailed uploads:');
      failed.forEach((r) => {
        console.log(`   - ${r.fileName} (${r.profile}): ${r.error}`);
      });
    }

    console.log('\n🎉 EOS Implementer document upload completed!');
    console.log(
      '\n💡 These documents are now available to the EOS Implementer persona',
    );
    console.log(
      '   and will be used when users select the corresponding profiles.',
    );
  } catch (error) {
    console.error('💥 Error uploading EOS Implementer documents:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  uploadEOSImplementerDocuments();
}

export { uploadEOSImplementerDocuments };
