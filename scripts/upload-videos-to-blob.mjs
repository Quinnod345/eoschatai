#!/usr/bin/env node

import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '.env') });

// Check for token
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is not set');
  console.error('Please add it to your .env.local or .env file');
  process.exit(1);
}

const videos = [
  'what-is-eos.mp4',
  'company-context.mp4',
  'document-context.mp4',
  'chatexample.mp4',
];

async function uploadVideos() {
  console.log('🚀 Starting video upload to Vercel Blob...\n');
  const urls = {};

  for (const videoName of videos) {
    try {
      const videoPath = join(__dirname, '..', 'public', 'videos', videoName);
      console.log(`📹 Uploading ${videoName}...`);

      const fileBuffer = await readFile(videoPath);
      const blob = await put(`videos/${videoName}`, fileBuffer, {
        access: 'public',
        contentType: 'video/mp4',
      });

      urls[videoName] = blob.url;
      console.log(`✅ Uploaded: ${blob.url}\n`);
    } catch (error) {
      console.error(`❌ Failed to upload ${videoName}:`, error.message);
    }
  }

  console.log('\n📋 All video URLs:');
  console.log(JSON.stringify(urls, null, 2));

  console.log(
    '\n🎉 Upload complete! Copy these URLs to replace the local paths in your code.',
  );

  return urls;
}

uploadVideos().catch(console.error);
