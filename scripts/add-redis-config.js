#!/usr/bin/env node

/**
 * Helper script to add Redis configuration to your .env.local file
 * This is used to enable resumable streams in EOS Chat AI
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ENV_FILE = path.join(process.cwd(), '.env.local');
const REDIS_CONFIG = `
# Redis Configuration for Resumable Streams
REDIS_URL=redis://default:your_password@your-redis-instance.upstash.io:12345

# Optional: Uncomment the line below for local development with Redis
# REDIS_URL=redis://localhost:6379
`;

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Print header
console.log('='.repeat(80));
console.log(
  ' EOS Chat AI - Redis Configuration Helper '
    .padStart(50, '=')
    .padEnd(80, '='),
);
console.log('='.repeat(80));
console.log(
  '\nThis script will help you add Redis configuration to your .env.local file',
);
console.log(
  'Redis is required for resumable streams, which improve chat reliability\n',
);

// Check if .env.local exists
if (!fs.existsSync(ENV_FILE)) {
  console.log('⚠️  .env.local file not found. Creating a new one...');
  fs.writeFileSync(ENV_FILE, '# EOS Chat AI environment variables\n', 'utf8');
  console.log('✅ Created .env.local file');
}

// Read current .env.local file
const envContent = fs.readFileSync(ENV_FILE, 'utf8');

// Check if Redis config already exists
if (envContent.includes('REDIS_URL=')) {
  console.log('⚠️  Redis configuration already exists in .env.local');
  rl.question('Do you want to update it? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      updateRedisConfig();
    } else {
      console.log(
        '\n❌ Operation cancelled. Existing Redis configuration was not modified.',
      );
      rl.close();
    }
  });
} else {
  rl.question(
    'Do you want to add Redis configuration to .env.local? (y/n): ',
    (answer) => {
      if (answer.toLowerCase() === 'y') {
        addRedisConfig();
      } else {
        console.log('\n❌ Operation cancelled. No changes were made.');
        rl.close();
      }
    },
  );
}

// Function to add Redis configuration
function addRedisConfig() {
  rl.question(
    '\nWhich Redis provider do you want to use?\n1. Upstash (Recommended)\n2. Redis Labs\n3. Local Redis\n4. Custom\nEnter your choice (1-4): ',
    (providerChoice) => {
      let redisUrl = '';

      switch (providerChoice) {
        case '1': // Upstash
          rl.question(
            '\nEnter your Upstash Redis connection string (from Upstash Console): ',
            (url) => {
              redisUrl =
                url ||
                'redis://default:your_password@your-redis-instance.upstash.io:12345';
              saveConfiguration(redisUrl);
            },
          );
          break;

        case '2': // Redis Labs
          rl.question('\nEnter your Redis Labs connection string: ', (url) => {
            redisUrl =
              url ||
              'redis://default:your_password@redis-12345.c12345.us-east-1-1.ec2.cloud.redislabs.com:12345';
            saveConfiguration(redisUrl);
          });
          break;

        case '3': // Local Redis
          redisUrl = 'redis://localhost:6379';
          console.log(
            '\nUsing local Redis configuration: redis://localhost:6379',
          );
          console.log(
            'Make sure Redis is installed and running on your local machine',
          );
          saveConfiguration(redisUrl);
          break;

        case '4': // Custom
          rl.question(
            '\nEnter your custom Redis connection string: ',
            (url) => {
              if (!url) {
                console.log(
                  '❌ No connection string provided. Operation cancelled.',
                );
                rl.close();
                return;
              }
              redisUrl = url;
              saveConfiguration(redisUrl);
            },
          );
          break;

        default:
          console.log('❌ Invalid choice. Operation cancelled.');
          rl.close();
      }
    },
  );
}

// Function to update existing Redis configuration
function updateRedisConfig() {
  // Extract current Redis URL
  const redisUrlMatch = envContent.match(/REDIS_URL=(.*?)(\r?\n|$)/);
  const currentRedisUrl = redisUrlMatch ? redisUrlMatch[1] : '';

  console.log(`\nCurrent Redis URL: ${currentRedisUrl}`);

  rl.question(
    'Enter new Redis URL (leave empty to keep current): ',
    (newUrl) => {
      const redisUrl = newUrl || currentRedisUrl;

      // Replace the existing Redis URL
      const updatedContent = envContent.replace(
        /REDIS_URL=.*?(\r?\n|$)/,
        `REDIS_URL=${redisUrl}\n`,
      );

      fs.writeFileSync(ENV_FILE, updatedContent, 'utf8');
      console.log('✅ Updated Redis configuration in .env.local');

      console.log('\n📝 Next steps:');
      console.log(
        '1. Run the test script: node scripts/test-redis-connection.js',
      );
      console.log('2. Add REDIS_URL to your Vercel environment variables');
      console.log('3. Redeploy your application');

      rl.close();
    },
  );
}

// Function to save Redis configuration to .env.local
function saveConfiguration(redisUrl) {
  // Add Redis configuration to .env.local
  const updatedContent = `${envContent}\n# Redis Configuration for Resumable Streams\nREDIS_URL=${redisUrl}\n`;

  fs.writeFileSync(ENV_FILE, updatedContent, 'utf8');
  console.log('✅ Added Redis configuration to .env.local');

  console.log('\n📝 Next steps:');
  console.log('1. Run the test script: node scripts/test-redis-connection.js');
  console.log('2. Add REDIS_URL to your Vercel environment variables');
  console.log('3. Redeploy your application');

  rl.close();
}
