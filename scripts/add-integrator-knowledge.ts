import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Index } from '@upstash/vector';
import dotenv from 'dotenv';
import path from 'node:path';
import { generateUUID } from '../lib/utils';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup Upstash Vector client
const upstashVectorClient = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL || '',
  token: process.env.UPSTASH_VECTOR_REST_TOKEN || '',
});

// OpenAI embedding model
const embeddingModel = openai.embedding('text-embedding-3-small');

/**
 * Truncates a vector to the specified dimension
 */
const truncateVector = (vector: number[], targetDimension = 1024): number[] => {
  if (vector.length <= targetDimension) {
    return vector;
  }
  return vector.slice(0, targetDimension);
};

/**
 * Add content to the vector database
 */
async function addContent(title: string, content: string): Promise<string> {
  try {
    console.log(`Adding content: "${title}"`);

    // Generate embedding for the content
    const { embedding } = await embed({
      model: embeddingModel,
      value: content,
    });

    // Truncate the embedding for Upstash Vector
    const truncatedEmbedding = truncateVector(embedding, 1024);

    // Create a unique ID
    const id = generateUUID();

    // Store in Upstash Vector
    await upstashVectorClient.upsert([
      {
        id: `${id}-0`,
        vector: truncatedEmbedding,
        metadata: {
          documentId: id,
          chunk: content,
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    console.log(`Successfully added content with ID: ${id}`);
    return id;
  } catch (error) {
    console.error('Error adding content:', error);
    throw error;
  }
}

// Integrator knowledge from Rocket Fuel
const integratorKnowledge = [
  {
    title: 'Integrating an Integrator into the Leadership Team',
    content: `To integrate your Integrator into your leadership team, follow these steps from Rocket Fuel by Gino Wickman and Mark C. Winters:

1. Make a formal announcement to the entire company introducing the Integrator role and explaining its importance.
2. Update your Accountability Chart to clearly define the Integrator's role, responsibilities, and authority in relation to the leadership team.
3. Hold a leadership team meeting to establish clear communication channels between the Visionary, Integrator, and other leadership team members.
4. Give your Integrator full authority to lead the leadership team meetings.
5. Provide your new Integrator time to develop relationships with the leadership team members.
6. Create a Visionary-Integrator Cadence™ - a structured meeting rhythm between you (the Visionary) and your Integrator.
7. Clearly communicate to the team which decisions require Visionary input and which the Integrator can make independently.
8. Demonstrate visible support for your Integrator's decisions, even when you might have made a different choice.
9. Give your Integrator time to understand your company's core values and culture before making major changes.
10. Be patient - it typically takes 6-12 months for a Visionary-Integrator relationship to fully mature.

Remember that according to Rocket Fuel, the Integrator's role is to harmoniously integrate the major functions of the business, including sales, marketing, operations, and finance. The ultimate goal is to create a healthy leadership team dynamic where the Visionary focuses on innovation and big-picture thinking while the Integrator executes and manages day-to-day operations.`,
  },
  {
    title: 'Visionary-Integrator Relationship',
    content: `The Visionary-Integrator Relationship is a cornerstone concept in Rocket Fuel by Gino Wickman and Mark C. Winters. Here are the key aspects:

1. Complementary roles: The Visionary generates ideas, builds relationships, solves big problems, and sees the future. The Integrator executes the vision, leads the leadership team, manages day-to-day operations, and creates organizational harmony.

2. The "Same Page Meeting": Visionaries and Integrators should meet weekly for 90 minutes to align on priorities, discuss challenges, and ensure they're working together effectively.

3. Issue resolution: When Visionaries and Integrators disagree, they should use the "Integrator has the right to say 'no,' the Visionary has the right to overrule" principle. This ensures thoughtful decision-making while preserving the Visionary's ultimate authority.

4. Mutual respect: Successful V/I relationships are built on deep trust and appreciation for each other's strengths. Visionaries must resist the urge to circumvent their Integrators, and Integrators must value the Visionary's creative energy.

5. Clear accountability: The Accountability Chart should clearly define who reports to whom, with most of the leadership team typically reporting to the Integrator.

6. Communication protocol: Establish clear rules about how information flows between the Visionary, Integrator, and leadership team to prevent confusion.

7. Five Rules for Success:
   - Stay on the same page
   - No end runs (team members going around the Integrator to the Visionary)
   - The Integrator is the tie-breaker
   - You're both accountable
   - Maintain mutual respect

When properly structured, the Visionary-Integrator relationship creates a powerful leadership dynamic that combines creative energy with disciplined execution, allowing companies to achieve their full potential.`,
  },
  {
    title: 'The Four Readiness Factors for a Visionary to Hire an Integrator',
    content: `The Four Readiness Factors for a Visionary to Hire an Integrator (from pages 67–68 of Rocket Fuel):

Financial Readiness
The organization must be able to afford an Integrator. This means the business has the financial resources to pay for the role at the appropriate level.

Psychological Readiness
The Visionary must be mentally and emotionally prepared to let go of certain responsibilities and trust the Integrator to handle them.

Lifestyle Readiness
The Visionary must be ready for the changes in their day-to-day life and work style that will come from having an Integrator in place.

Unique Ability® Readiness
The Visionary must be prepared to focus their time and energy on their own Unique Ability®—the things they do best and enjoy most—while letting the Integrator handle the rest.

Reference:
These four factors are outlined on pages 67–68 of Rocket Fuel by Gino Wickman and Mark C. Winters.`,
  },
];

// Main function to run the script
async function main() {
  if (
    !process.env.UPSTASH_VECTOR_REST_URL ||
    !process.env.UPSTASH_VECTOR_REST_TOKEN
  ) {
    console.error(
      'Error: UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set',
    );
    process.exit(1);
  }

  console.log('Adding Integrator knowledge to the vector database');

  try {
    const addedIds = [];
    for (const { title, content } of integratorKnowledge) {
      const id = await addContent(title, content);
      addedIds.push(id);
    }
    console.log(`Successfully added ${addedIds.length} knowledge items`);
    console.log('Added IDs:', addedIds);
  } catch (error) {
    console.error('Failed to add knowledge:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
