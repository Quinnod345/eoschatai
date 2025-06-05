#!/usr/bin/env tsx

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addSystemContent } from '@/lib/ai/system-rag';

/**
 * Upload and chunk documents for system personas
 * This script processes documents in the knowledge-base directory
 * and uploads them to the appropriate namespaces for system personas
 */

const KNOWLEDGE_BASE_DIR = 'knowledge-base';

// Mapping of directory names to knowledge namespaces
const NAMESPACE_MAPPING = {
  'eos-implementer': 'eos-implementer',
  'eos-implementer-vision-day-1': 'eos-implementer-vision-day-1',
  'eos-implementer-vision-day-2': 'eos-implementer-vision-day-2',
  'eos-implementer-quarterly-planning': 'eos-implementer-quarterly-planning',
  'eos-implementer-level-10': 'eos-implementer-level-10',
  'eos-implementer-ids': 'eos-implementer-ids',
  'eos-implementer-annual-planning': 'eos-implementer-annual-planning',
} as const;

async function uploadSystemKnowledge() {
  try {
    console.log('🚀 Starting system knowledge upload...');

    // Get all directories in knowledge-base
    const directories = await readdir(KNOWLEDGE_BASE_DIR, {
      withFileTypes: true,
    });
    const knowledgeDirs = directories
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => name in NAMESPACE_MAPPING);

    console.log(
      `📁 Found ${knowledgeDirs.length} knowledge directories:`,
      knowledgeDirs,
    );

    for (const dirName of knowledgeDirs) {
      const namespace =
        NAMESPACE_MAPPING[dirName as keyof typeof NAMESPACE_MAPPING];
      const dirPath = join(KNOWLEDGE_BASE_DIR, dirName);

      console.log(
        `\n📂 Processing directory: ${dirName} -> namespace: ${namespace}`,
      );

      try {
        // Get all markdown files in the directory
        const files = await readdir(dirPath);
        const markdownFiles = files.filter((file) => file.endsWith('.md'));

        console.log(
          `   📄 Found ${markdownFiles.length} markdown files:`,
          markdownFiles,
        );

        for (const fileName of markdownFiles) {
          const filePath = join(dirPath, fileName);

          try {
            console.log(`   📖 Reading file: ${fileName}`);
            const content = await readFile(filePath, 'utf-8');

            // Skip empty or placeholder files
            if (
              content.trim().length < 100 ||
              content.includes('placeholder document')
            ) {
              console.log(`   ⏭️  Skipping placeholder file: ${fileName}`);
              continue;
            }

            // Extract title from filename (remove .md extension)
            const title = fileName.replace('.md', '').replace(/-/g, ' ');

            console.log(
              `   🔄 Processing: ${title} (${content.length} characters)`,
            );

            // Add content to system knowledge base
            await addSystemContent(namespace, title, content, {
              fileName,
              directory: dirName,
              uploadedAt: new Date().toISOString(),
            });

            console.log(`   ✅ Successfully uploaded: ${title}`);
          } catch (fileError) {
            console.error(
              `   ❌ Error processing file ${fileName}:`,
              fileError,
            );
          }
        }
      } catch (dirError) {
        console.error(`❌ Error processing directory ${dirName}:`, dirError);
      }
    }

    console.log('\n🎉 System knowledge upload completed successfully!');
  } catch (error) {
    console.error('💥 Error uploading system knowledge:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  uploadSystemKnowledge();
}

export { uploadSystemKnowledge };
