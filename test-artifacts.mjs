import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { document } from './lib/db/schema.js';
import { eq, desc } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function testArtifacts() {
  try {
    console.log('Testing artifact/document functionality...\n');

    // 1. Get recent documents
    console.log('1. Fetching recent documents...');
    const recentDocs = await db
      .select()
      .from(document)
      .orderBy(desc(document.createdAt))
      .limit(10);

    console.log(`Found ${recentDocs.length} recent documents:`);
    recentDocs.forEach((doc, index) => {
      console.log(`\n${index + 1}. Document ID: ${doc.id}`);
      console.log(`   Title: ${doc.title}`);
      console.log(`   Kind: ${doc.kind}`);
      console.log(
        `   Content length: ${doc.content ? doc.content.length : 0} chars`,
      );
      console.log(
        `   Content preview: ${doc.content ? `${doc.content.substring(0, 100)}...` : 'NULL'}`,
      );
      console.log(`   Created: ${doc.createdAt}`);
      console.log(`   User ID: ${doc.userId}`);
    });

    // 2. Test creating a new document
    console.log('\n\n2. Testing document creation...');
    const testId = `test-${Date.now()}`;
    const testDoc = {
      id: testId,
      title: 'Test Artifact Document',
      kind: 'text',
      content:
        'This is a test document to verify artifact functionality is working correctly.',
      userId: recentDocs[0]?.userId || 'test-user',
      createdAt: new Date(),
    };

    console.log('Creating test document...');
    await db.insert(document).values(testDoc);
    console.log('Test document created successfully!');

    // 3. Retrieve the test document
    console.log('\n3. Retrieving test document...');
    const [retrievedDoc] = await db
      .select()
      .from(document)
      .where(eq(document.id, testId));

    if (retrievedDoc) {
      console.log('Test document retrieved successfully!');
      console.log(`Content: ${retrievedDoc.content}`);
    } else {
      console.log('ERROR: Could not retrieve test document!');
    }

    // 4. Check for any documents with null or empty content
    console.log('\n\n4. Checking for documents with null/empty content...');
    const emptyDocs = await db
      .select()
      .from(document)
      .orderBy(desc(document.createdAt))
      .limit(20);

    const problematicDocs = emptyDocs.filter(
      (doc) => !doc.content || doc.content.trim() === '',
    );
    console.log(
      `Found ${problematicDocs.length} documents with null/empty content out of last 20 documents`,
    );

    if (problematicDocs.length > 0) {
      console.log('\nProblematic documents:');
      problematicDocs.forEach((doc, index) => {
        console.log(
          `${index + 1}. ID: ${doc.id}, Title: ${doc.title}, Created: ${doc.createdAt}`,
        );
      });
    }

    // 5. Clean up test document
    console.log('\n\n5. Cleaning up test document...');
    await db.delete(document).where(eq(document.id, testId));
    console.log('Test document deleted successfully!');
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await sql.end();
    console.log('\nTest completed.');
  }
}

testArtifacts();
