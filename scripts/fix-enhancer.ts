import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Enhanced search query function
const enhanceSearchQueryCode = `
/**
 * Enhances a search query for better semantic matching
 */
const enhanceSearchQuery = (query: string): string => {
  const lowerQuery = query.toLowerCase();
  
  // Check for integrator-related queries
  if (lowerQuery.includes('integrator')) {
    // If about relationship with visionary
    if (
      lowerQuery.includes('visionary') || 
      lowerQuery.includes('relationship') ||
      lowerQuery.includes('work with') ||
      lowerQuery.includes('work together')
    ) {
      console.log('RAG: Enhancing query for visionary-integrator relationship');
      return 'visionary integrator relationship';
    }
    
    // If question asks about execution or implementing, simplify to core terms
    if (
      lowerQuery.includes('execute') || 
      lowerQuery.includes('execution') || 
      lowerQuery.includes('implement') || 
      lowerQuery.includes('how') ||
      lowerQuery.includes('vision')
    ) {
      console.log('RAG: Enhancing integrator search query for better matching');
      return 'integrator execute vision';
    }
  }
  
  // Return original query if no specific enhancement
  return query;
};
`;

// Updated findRelevantContent with enhanced query usage
const findRelevantContentWithEnhancer = `export const findRelevantContent = async (
  query: string | any,
  limit = 5,
  minRelevance = 0.8, // Increase to 80% for better quality matches
): Promise<{ content: string; relevance: number }[]> => {
  try {
    // Ensure the query is a string (in case it's passed as an object)
    let queryText = typeof query === 'string' ? query : '';

    // Handle case where the query might be an object with text property
    if (typeof query === 'object' && query !== null) {
      if (query.text && typeof query.text === 'string') {
        queryText = query.text;
      } else {
        // Try to convert to string if it's a complex object
        queryText = JSON.stringify(query);
      }
    }

    // Enhance the search query for better semantic matching
    const enhancedQuery = enhanceSearchQuery(queryText);
    
    // Log the original and enhanced queries
    if (enhancedQuery !== queryText) {
      console.log(\`RAG: Enhanced query from "\${queryText}" to "\${enhancedQuery}"\`);
    } else {
      console.log('RAG: Using original query:', queryText);
    }

    // Generate full embedding for the query
    const { embedding } = await embed({
      model: embeddingModel,
      value: enhancedQuery,
    });

    // Truncate the embedding for Upstash Vector
    const truncatedEmbedding = truncateVector(embedding, 1024);`;

// Test the enhancement logic
function testQueryEnhancer() {
  const testQueries = [
    'how do integrators execute a vision',
    'what should an integrator do',
    'integrator and visionary relationship',
    'how do visionaries work with integrators',
    'something unrelated to integrators',
    { text: 'how do integrators execute a vision', type: 'text' },
  ];

  console.log('Testing query enhancer function:');
  console.log('--------------------------------');

  // Define the enhance function
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const enhanceSearchQuery = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('integrator')) {
      if (
        lowerQuery.includes('execute') ||
        lowerQuery.includes('execution') ||
        lowerQuery.includes('implement') ||
        lowerQuery.includes('how') ||
        lowerQuery.includes('vision')
      ) {
        return 'integrator execute vision';
      }

      if (
        lowerQuery.includes('visionary') ||
        lowerQuery.includes('relationship') ||
        lowerQuery.includes('work with') ||
        lowerQuery.includes('work together')
      ) {
        return 'visionary integrator relationship';
      }
    }

    return query;
  };

  for (const query of testQueries) {
    const queryStr = typeof query === 'string' ? query : (query.text as string);
    const enhanced = enhanceSearchQuery(queryStr);
    console.log(`Original: "${queryStr}"`);
    console.log(`Enhanced: "${enhanced}"`);
    console.log('--------------------------------');
  }
}

// Modify the embeddings.ts file
function updateEmbeddingsFile() {
  const filePath = path.resolve(process.cwd(), 'lib/ai/embeddings.ts');

  try {
    // Read the original file
    let content = readFileSync(filePath, 'utf8');

    // Add the enhanceSearchQuery function after the embedding model declaration
    const embeddingModelRegex =
      /const embeddingModel = openai\.embedding\('text-embedding-ada-002'\);/;
    if (embeddingModelRegex.test(content)) {
      content = content.replace(
        embeddingModelRegex,
        `const embeddingModel = openai.embedding('text-embedding-ada-002');

${enhanceSearchQueryCode}`,
      );
      console.log('Added enhanceSearchQuery function');
    } else {
      console.log('Could not find embedding model declaration');
      return;
    }

    // Update the findRelevantContent function to use enhanceSearchQuery
    const findRelevantContentRegex =
      /export const findRelevantContent = async \([^{]*\{/s;
    if (findRelevantContentRegex.test(content)) {
      content = content.replace(
        findRelevantContentRegex,
        findRelevantContentWithEnhancer,
      );
      console.log('Updated findRelevantContent function');
    } else {
      console.log('Could not find findRelevantContent function');
      return;
    }

    // Write the updated content back to the file
    writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated embeddings.ts file');
  } catch (error) {
    console.error('Error updating embeddings.ts file:', error);
  }
}

// Run the script
console.log('Starting query enhancer implementation');
testQueryEnhancer();
console.log('\nUpdating embeddings.ts file...');
updateEmbeddingsFile();
