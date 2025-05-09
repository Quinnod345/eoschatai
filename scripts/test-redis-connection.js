// Test Redis connection for resumable streams
const { createClient } = require('redis');
require('dotenv').config({ path: '.env.local' });

// Get Redis URL from environment variable
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error('❌ REDIS_URL is not defined in .env.local');
  console.log(
    'Please add REDIS_URL=your_redis_connection_string to your .env.local file',
  );
  process.exit(1);
}

async function testRedisConnection() {
  console.log(
    `🔄 Testing connection to Redis at ${REDIS_URL.replace(/redis:\/\/[^@]*@/, 'redis://***@')}`,
  );

  try {
    // Create Redis client
    const client = createClient({
      url: REDIS_URL,
    });

    // Handle errors
    client.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
      process.exit(1);
    });

    // Connect to Redis
    await client.connect();
    console.log('✅ Successfully connected to Redis!');

    // Test simple operation
    await client.set('test-key', 'Hello from EOS Chat AI!');
    const value = await client.get('test-key');
    console.log(`✅ Test operation successful. Value: ${value}`);

    // Test pubsub (important for resumable streams)
    const subscriber = client.duplicate();
    await subscriber.connect();

    await subscriber.subscribe('test-channel', (message) => {
      console.log(`✅ Received message on test channel: ${message}`);
      cleanup();
    });

    // Publish a test message
    await client.publish('test-channel', 'Testing resumable streams');

    async function cleanup() {
      // Clean up resources
      await client.del('test-key');
      await subscriber.unsubscribe('test-channel');
      await subscriber.quit();
      await client.quit();
      console.log('✅ Redis test completed successfully!');
      process.exit(0);
    }

    // If no pubsub message received in 5 seconds, still clean up
    setTimeout(async () => {
      console.log(
        '⚠️ Timeout reached, no pubsub message received. This may indicate an issue with Redis pubsub.',
      );
      await cleanup();
    }, 5000);
  } catch (error) {
    console.error('❌ Redis test failed:', error);
    process.exit(1);
  }
}

testRedisConnection();
