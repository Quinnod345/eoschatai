import { findRelevantUserContent } from './user-rag';
import { db } from '@/lib/db';
import { persona, personaDocument, userDocuments } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Persona RAG context prompt - gets persona documents via RAG using persona ID as namespace
 * This function retrieves documents that were associated with the persona during creation
 */
export const personaRagContextPrompt = async (
  personaId: string,
  query,
  userId: string,
) => {
  if (!personaId || !query) {
    console.log(
      'Persona RAG context: No personaId or query provided, skipping',
    );
    return '';
  }

  try {
    console.log(
      `Persona RAG context: Fetching relevant documents for persona ${personaId} with query: "${query}"`,
    );

    // Check if this is the hardcoded EOS implementer
    if (personaId === 'eos-implementer') {
      console.log(
        'Persona RAG context: Hardcoded EOS implementer persona does not use persona-specific documents',
      );
      return '';
    }

    // First, verify the persona belongs to the user
    const [personaData] = await db
      .select()
      .from(persona)
      .where(and(eq(persona.id, personaId), eq(persona.userId, userId)))
      .limit(1);

    if (!personaData) {
      console.log('Persona RAG context: Persona not found or unauthorized');
      return '';
    }

    // Get the document IDs associated with this persona
    const personaDocs = await db
      .select()
      .from(personaDocument)
      .where(eq(personaDocument.personaId, personaId));

    if (personaDocs.length === 0) {
      console.log(
        'Persona RAG context: No documents associated with this persona',
      );
      return '';
    }

    const documentIds = personaDocs.map((pd) => pd.documentId);
    console.log(
      `Persona RAG context: Found ${documentIds.length} documents associated with persona "${personaData.name}"`,
    );

    // Get document metadata for better context
    const documents = await db
      .select()
      .from(userDocuments)
      .where(inArray(userDocuments.id, documentIds));

    // Search for relevant content using the persona ID as namespace
    // This allows personas to have their own vector space for documents
    const relevantDocs = await findRelevantUserContent(
      personaId, // Use persona ID as namespace instead of user ID
      query,
      10, // Get more results for personas
      0.5, // Lower threshold for better recall
    );

    console.log(
      `Persona RAG context: Found ${relevantDocs.length} relevant document chunks for persona`,
    );

    if (!relevantDocs || relevantDocs.length === 0) {
      console.log(
        'Persona RAG context: No relevant documents found in persona namespace',
      );
      return '';
    }

    // Filter results to only include documents associated with this persona
    const personaDocumentIds = new Set(documentIds);
    const filteredDocs = relevantDocs.filter((doc) =>
      personaDocumentIds.has(doc.metadata.documentId),
    );

    console.log(
      `Persona RAG context: Filtered to ${filteredDocs.length} chunks from persona-associated documents`,
    );

    if (filteredDocs.length === 0) {
      return '';
    }

    // Group documents by category and file
    const documentsByCategory: Record<string, Record<string, any[]>> = {};
    for (const doc of filteredDocs) {
      const category = doc.metadata.category || 'Other';
      const fileName = doc.metadata.fileName || 'Unknown File';

      if (!documentsByCategory[category]) {
        documentsByCategory[category] = {};
      }
      if (!documentsByCategory[category][fileName]) {
        documentsByCategory[category][fileName] = [];
      }
      documentsByCategory[category][fileName].push(doc);
    }

    console.log(
      `Persona RAG context: Grouped into ${
        Object.keys(documentsByCategory).length
      } categories for persona "${personaData.name}": ${Object.keys(documentsByCategory).join(', ')}`,
    );

    // Build the context prompt
    let contextText = `
## Persona Documents (${personaData.name})
The following are relevant excerpts from documents specifically associated with the "${personaData.name}" persona:
`;

    // Add each category section
    for (const [category, files] of Object.entries(documentsByCategory)) {
      contextText += `\n### ${category}\n`;
      console.log(
        `Persona RAG context: Adding ${Object.keys(files).length} files for category ${category}`,
      );

      // Add each file in the category
      for (const [fileName, docs] of Object.entries(files)) {
        contextText += `\n**${fileName}** (${docs.length} relevant sections):\n`;

        // Add the most relevant chunks from this file
        docs
          .sort((a, b) => b.relevance - a.relevance) // Sort by relevance
          .slice(0, 3) // Take top 3 chunks per file
          .forEach((doc, index) => {
            contextText += `\n[Relevance: ${(doc.relevance * 100).toFixed(1)}%]\n${doc.content}\n`;
            if (index < docs.length - 1) contextText += '\n---\n';
          });

        contextText += '\n---\n';
      }
    }

    contextText += `
PERSONA DOCUMENT INSTRUCTIONS:
1. These documents were specifically selected for the "${personaData.name}" persona during setup.
2. They contain specialized knowledge and context that should guide your responses when acting as this persona.
3. PRIORITIZE this persona-specific content over general user documents when there's overlap.
4. Use this information to provide expert-level responses aligned with the persona's role and expertise.
5. The persona's custom instructions should be applied in conjunction with these documents.
`;

    console.log(
      `Persona RAG context: Generated context for persona "${personaData.name}" with ${contextText.length} characters`,
    );
    return contextText;
  } catch (error) {
    console.error(
      'Persona RAG context: Error fetching persona documents:',
      error,
    );
    return '';
  }
};

/**
 * Process documents for a persona by storing them in the persona's namespace
 * This is called when documents are associated with a persona
 */
export const processPersonaDocuments = async (
  personaId: string,
  documentIds: string[],
  userId: string,
) => {
  try {
    console.log(
      `Persona RAG: Processing ${documentIds.length} documents for persona ${personaId}`,
    );

    // Check if this is the hardcoded EOS implementer
    if (personaId === 'eos-implementer') {
      console.log(
        'Persona RAG: Skipping document processing for hardcoded EOS implementer',
      );
      return;
    }

    // Import the necessary functions
    const { processUserDocument } = await import('./user-rag');

    // Get the documents from the database
    const documents = await db
      .select()
      .from(userDocuments)
      .where(
        and(
          inArray(userDocuments.id, documentIds),
          eq(userDocuments.userId, userId),
        ),
      );

    console.log(
      `Persona RAG: Found ${documents.length} documents to process for persona`,
    );

    // Process each document into the persona's namespace
    for (const doc of documents) {
      if (doc.content) {
        console.log(
          `Persona RAG: Processing document "${doc.fileName}" into persona namespace ${personaId}`,
        );

        await processUserDocument(
          personaId, // Use persona ID as namespace
          doc.id,
          doc.content,
          {
            fileName: doc.fileName,
            category: doc.category,
            fileType: doc.fileType || 'unknown',
          },
        );
      }
    }

    console.log(
      `Persona RAG: Successfully processed ${documents.length} documents for persona ${personaId}`,
    );
  } catch (error) {
    console.error('Persona RAG: Error processing persona documents:', error);
    throw error;
  }
};

/**
 * Delete all documents from a persona's namespace
 * This is called when a persona is deleted
 */
export const deletePersonaDocuments = async (personaId: string) => {
  try {
    console.log(`Persona RAG: Deleting all documents for persona ${personaId}`);

    // Check if this is the hardcoded EOS implementer
    if (personaId === 'eos-implementer') {
      console.log(
        'Persona RAG: Cannot delete documents for hardcoded EOS implementer',
      );
      return { deleted: 0 };
    }

    const { deleteUserDocuments } = await import('./user-rag');

    // Delete all documents from the persona's namespace
    const result = await deleteUserDocuments(personaId);

    console.log(
      `Persona RAG: Deleted ${result.deleted} vectors from persona ${personaId} namespace`,
    );

    return result;
  } catch (error) {
    console.error('Persona RAG: Error deleting persona documents:', error);
    throw error;
  }
};
