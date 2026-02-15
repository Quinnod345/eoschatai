/**
 * EOSAI Public API - Document Analysis
 *
 * One-off document Q&A - analyze a document and answer questions about it.
 * Supports both JSON requests (text) and multipart/form-data (file uploads).
 * No persistent storage - processes in-memory.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { streamText, generateText, embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v3';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import Anthropic from '@anthropic-ai/sdk';
import type { ApiContext } from '@/lib/api/middleware';
import {
  validateApiRequest,
  addRateLimitHeaders,
  generateRequestId,
  openaiError,
} from '@/lib/api/middleware';
import { logApiKeyUsage } from '@/lib/api/keys';
import { createCustomProvider } from '@/lib/ai/providers';
import { findUpstashSystemContent } from '@/lib/ai/upstash-system-rag';

export const maxDuration = 60;

// Model mapping - using correct Claude 4.5 model IDs
const MODEL_MAP: Record<
  string,
  { provider: string; model: string; enableReasoning?: boolean }
> = {
  'eosai-v1': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  'eosai-v1-fast': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
  },
  'eosai-v1-pro': {
    provider: 'anthropic',
    model: 'claude-opus-4-5-20251101',
    enableReasoning: true, // Claude Opus 4.5 with extended thinking
  },
};

// Reasoning budget for pro model (in tokens)
const REASONING_BUDGET = 32000;

const embeddingModel = openai.embedding('text-embedding-3-small');

// Anthropic client for image processing
const createAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
};
const anthropicClient = createAnthropicClient();

// Supported file types
const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
];

const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
];

const SUPPORTED_EXTENSIONS = [
  'pdf',
  'txt',
  'md',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
];
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Request schema for JSON requests
const analyzeRequestSchema = z.object({
  document: z.string().min(1).max(100000),
  question: z.string().min(1).max(4000),
  model: z.string().optional().default('eosai-v1'),
  stream: z.boolean().optional().default(false),
  include_eos_context: z.boolean().optional().default(false),
  eos_namespace: z.string().optional().default('eos-implementer'),
  max_chunks: z.number().min(1).max(20).optional().default(5),
});

/**
 * Extract text from various document types
 */
async function extractTextFromFile(
  file: Blob,
  fileType: string,
  fileName: string,
): Promise<string> {
  // For plain text files
  if (fileType.includes('text/') || fileType.includes('markdown')) {
    return await file.text();
  }

  // For PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const buffer = await file.arrayBuffer();
      const data = await pdfParse(Buffer.from(buffer));
      const pdfText = data.text || '';

      if (pdfText.trim().length > 100) {
        return pdfText;
      }

      // If minimal text extracted, return what we have with a note
      return (
        pdfText || `PDF file "${fileName}" contains minimal extractable text.`
      );
    } catch (error) {
      console.error('[API v1] Error parsing PDF:', error);
      return `Error extracting text from PDF "${fileName}".`;
    }
  }

  // For Excel files
  if (
    fileType.includes('spreadsheet') ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      let content = '';

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        content += `## Sheet: ${sheetName}\n\n`;
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        content += `${csv}\n\n`;
      });

      return content;
    } catch (error) {
      console.error('[API v1] Error parsing Excel:', error);
      return `Error extracting content from Excel file "${fileName}".`;
    }
  }

  // For Word documents (.docx)
  if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
    try {
      const buffer = await file.arrayBuffer();
      const zip = new JSZip();
      const content = await zip.loadAsync(buffer);
      const documentXml = await content
        .file('word/document.xml')
        ?.async('text');

      if (!documentXml) {
        return `Could not extract text from DOCX file "${fileName}".`;
      }

      const tagMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (tagMatches) {
        return tagMatches
          .map((match) => match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
          .join(' ');
      }

      return `Could not extract text from DOCX file "${fileName}".`;
    } catch (error) {
      console.error('[API v1] Error parsing Word document:', error);
      return `Error extracting content from Word document "${fileName}".`;
    }
  }

  // For PowerPoint files (.pptx)
  if (fileType.includes('presentationml') || fileName.endsWith('.pptx')) {
    try {
      const buffer = await file.arrayBuffer();
      const zip = new JSZip();
      const content = await zip.loadAsync(buffer);
      const presXml = await content.file('ppt/presentation.xml')?.async('text');

      if (!presXml) {
        return `Could not find presentation.xml in PPTX file "${fileName}".`;
      }

      const slideMatches = presXml.match(/<p:sldId[^>]*>/g);
      const slideCount = slideMatches ? slideMatches.length : 0;
      const slideTexts: string[] = [];

      for (let i = 1; i <= slideCount; i++) {
        const slideXml = await content
          .file(`ppt/slides/slide${i}.xml`)
          ?.async('text');
        if (slideXml) {
          const textMatches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
          if (textMatches) {
            const slideText = textMatches
              .map((match) => match.replace(/<a:t[^>]*>([^<]*)<\/a:t>/, '$1'))
              .join(' ');
            if (slideText.trim()) {
              slideTexts.push(`## Slide ${i}\n\n${slideText}`);
            }
          }
        }
      }

      return (
        slideTexts.join('\n\n') ||
        `Could not extract text from PPTX file "${fileName}".`
      );
    } catch (error) {
      console.error('[API v1] Error parsing PowerPoint:', error);
      return `Error extracting content from PowerPoint file "${fileName}".`;
    }
  }

  return `File type "${fileType}" is not supported for text extraction.`;
}

/**
 * Process image with Claude Vision for OCR and description
 */
async function processImageWithVision(
  file: Blob,
  fileName: string,
): Promise<{ description: string; text: string }> {
  if (!anthropicClient) {
    return {
      description: `Image "${fileName}" uploaded but vision processing unavailable.`,
      text: '',
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
      'image/jpeg';
    if (file.type.includes('png')) mediaType = 'image/png';
    else if (file.type.includes('gif')) mediaType = 'image/gif';
    else if (file.type.includes('webp')) mediaType = 'image/webp';

    const response = await anthropicClient.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Analyze this image. Provide: 1) A comprehensive description of what you see, and 2) Extract any visible text content. Format as JSON with "description" and "text" fields.',
            },
          ],
        },
      ],
    });

    const analysisResult =
      response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const cleaned = analysisResult
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return { description: analysisResult, text: '' };
    }
  } catch (error) {
    console.error('[API v1] Image processing error:', error);
    return {
      description: `Error processing image "${fileName}".`,
      text: '',
    };
  }
}

/**
 * Chunk document into smaller pieces
 */
function chunkDocument(content: string, maxChunkSize = 1000): string[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      // If a single paragraph is too long, split by sentences
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let sentenceChunk = '';
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length <= maxChunkSize) {
            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk);
            sentenceChunk = sentence;
          }
        }
        if (sentenceChunk) currentChunk = sentenceChunk;
        else currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most relevant chunks for a question
 */
async function findRelevantChunks(
  chunks: string[],
  question: string,
  maxChunks: number,
): Promise<string[]> {
  if (chunks.length <= maxChunks) {
    return chunks;
  }

  // Generate embeddings for all chunks and the question
  const [questionResult, chunksResult] = await Promise.all([
    embed({ model: embeddingModel, value: question }),
    embedMany({ model: embeddingModel, values: chunks }),
  ]);

  const questionEmbedding = questionResult.embedding;
  const chunkEmbeddings = chunksResult.embeddings;

  // Calculate similarity scores
  const scored = chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(questionEmbedding, chunkEmbeddings[i]),
  }));

  // Sort by score and take top chunks
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxChunks).map((s) => s.chunk);
}

/**
 * POST /api/v1/documents/analyze
 * Analyze a document and answer questions about it.
 *
 * Accepts two request formats:
 * 1. JSON: { document: "text...", question: "..." }
 * 2. FormData: file + question (for file uploads)
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let context: ApiContext | undefined;

  // Validate API key
  const validation = await validateApiRequest(request, ['chat']);
  if ('error' in validation) {
    return validation.error;
  }
  context = validation.context;

  // Determine content type
  const contentType = request.headers.get('content-type') || '';
  const isFormData = contentType.includes('multipart/form-data');

  let documentContent: string;
  let question: string;
  let model = 'eosai-v1';
  let stream = false;
  let include_eos_context = false;
  let eos_namespace = 'eos-implementer';
  let max_chunks = 5;
  let fileName: string | undefined;
  let isImage = false;
  let imageAnalysis: { description: string; text: string } | undefined;

  if (isFormData) {
    // Handle multipart/form-data (file upload)
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return openaiError(
        'Invalid form data',
        'invalid_request_error',
        'invalid_form_data',
        null,
        400,
      );
    }

    const file = formData.get('file') as File | null;
    const questionField = formData.get('question') as string | null;

    if (!file) {
      return openaiError(
        'No file provided. Include a "file" field in your form data.',
        'invalid_request_error',
        'missing_file',
        'file',
        400,
      );
    }

    if (!questionField || questionField.trim().length === 0) {
      return openaiError(
        'No question provided. Include a "question" field in your form data.',
        'invalid_request_error',
        'missing_question',
        'question',
        400,
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return openaiError(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        'invalid_request_error',
        'file_too_large',
        'file',
        400,
      );
    }

    // Validate file type
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isDocument =
      SUPPORTED_DOCUMENT_TYPES.includes(file.type) ||
      SUPPORTED_EXTENSIONS.includes(fileExt);
    isImage =
      SUPPORTED_IMAGE_TYPES.includes(file.type) ||
      SUPPORTED_IMAGE_EXTENSIONS.includes(fileExt);

    if (!isDocument && !isImage) {
      return openaiError(
        `Unsupported file type: ${file.type || fileExt}. Supported: PDF, DOCX, XLSX, PPTX, TXT, MD, and images (JPEG, PNG, GIF, WebP).`,
        'invalid_request_error',
        'unsupported_file_type',
        'file',
        400,
      );
    }

    fileName = file.name;
    question = questionField.trim();

    // Parse optional fields
    const modelField = formData.get('model') as string | null;
    const streamField = formData.get('stream') as string | null;
    const eosContextField = formData.get('include_eos_context') as
      | string
      | null;
    const namespaceField = formData.get('eos_namespace') as string | null;
    const maxChunksField = formData.get('max_chunks') as string | null;

    if (modelField) model = modelField;
    if (streamField) stream = streamField.toLowerCase() === 'true';
    if (eosContextField)
      include_eos_context = eosContextField.toLowerCase() === 'true';
    if (namespaceField) eos_namespace = namespaceField;
    if (maxChunksField) {
      const parsed = Number.parseInt(maxChunksField, 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 20)
        max_chunks = parsed;
    }

    // Extract content from file
    if (isImage) {
      imageAnalysis = await processImageWithVision(file, fileName);
      documentContent = `## Image: ${fileName}\n\n### Description\n${imageAnalysis.description}\n\n### Extracted Text\n${imageAnalysis.text || '(No text found in image)'}`;
    } else {
      documentContent = await extractTextFromFile(file, file.type, fileName);
    }

    // Validate extracted content
    if (!documentContent || documentContent.trim().length === 0) {
      return openaiError(
        'Could not extract content from the uploaded file.',
        'invalid_request_error',
        'extraction_failed',
        'file',
        400,
      );
    }
  } else {
    // Handle JSON request (existing behavior)
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return openaiError(
        'Invalid JSON in request body',
        'invalid_request_error',
        'invalid_json',
        null,
        400,
      );
    }

    // Validate request
    const parseResult = analyzeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const error = parseResult.error.errors[0];
      return openaiError(
        `Invalid request: ${error.message}`,
        'invalid_request_error',
        'invalid_param',
        error.path.join('.'),
        400,
      );
    }

    documentContent = parseResult.data.document;
    question = parseResult.data.question;
    model = parseResult.data.model;
    stream = parseResult.data.stream;
    include_eos_context = parseResult.data.include_eos_context;
    eos_namespace = parseResult.data.eos_namespace;
    max_chunks = parseResult.data.max_chunks;
  }

  // Get model config
  const modelConfig = MODEL_MAP[model];
  if (!modelConfig) {
    return openaiError(
      `Model "${model}" is not supported. Available: ${Object.keys(MODEL_MAP).join(', ')}`,
      'invalid_request_error',
      'model_not_found',
      'model',
      400,
    );
  }

  try {
    // Chunk the document content
    const chunks = chunkDocument(documentContent);

    // Find relevant chunks for the question
    const relevantChunks = await findRelevantChunks(
      chunks,
      question,
      max_chunks,
    );

    // Build document context
    const documentContext = relevantChunks
      .map((chunk, i) => `[Section ${i + 1}]\n${chunk}`)
      .join('\n\n---\n\n');

    // Optionally get EOS context
    let eosContext = '';
    if (include_eos_context) {
      try {
        const eosResults = await findUpstashSystemContent(
          question,
          eos_namespace,
          3,
          0.6,
        );
        if (eosResults.length > 0) {
          const formattedResults = eosResults
            .map((item, i) => `[${i + 1}] ${item.title}\n${item.content}`)
            .join('\n\n');
          eosContext = `\n\n## EOS KNOWLEDGE BASE CONTEXT\n${formattedResults}`;
        }
      } catch (error) {
        console.error('[API v1] Error fetching EOS context:', error);
      }
    }

    // Build system prompt
    const documentTypeLabel = isImage ? 'IMAGE ANALYSIS' : 'DOCUMENT CONTENT';
    const systemPrompt = `You are EOSAI, an expert document analyst. You have been provided with ${isImage ? 'an image analysis' : 'a document'} and must answer the user's question based on its contents.

## ${documentTypeLabel}
${fileName ? `Source: ${fileName}\n\n` : ''}The following relevant sections have been extracted:

${documentContext}
${eosContext}

## INSTRUCTIONS
1. Answer the question based primarily on the ${isImage ? 'image analysis' : 'document content'} provided
2. Quote specific passages when relevant
3. If the answer cannot be found in the ${isImage ? 'image' : 'document'}, say so clearly
4. Be concise but thorough
5. If EOS context is provided, you may reference it to enhance your answer with EOS methodology`;

    // Create provider
    const provider = createCustomProvider(modelConfig.provider);

    // Estimate tokens
    const promptTokens = Math.ceil((systemPrompt.length + question.length) / 4);

    // Handle streaming
    if (stream) {
      // Extended thinking requires temperature undefined or 1
      const temperature = modelConfig.enableReasoning ? undefined : 0.7;

      const result = streamText({
        model: provider.languageModel(modelConfig.model),
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
        temperature,
        // Enable extended thinking for pro model (Claude Opus 4.5)
        ...(modelConfig.enableReasoning
          ? {
              providerOptions: {
                anthropic: {
                  thinking: {
                    type: 'enabled',
                    budgetTokens: REASONING_BUDGET,
                  },
                },
              },
            }
          : {}),
      });

      const responseStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let fullResponse = '';
          let tokenCount = 0;

          try {
            for await (const chunk of result.textStream) {
              fullResponse += chunk;
              tokenCount++;

              const data = {
                id: requestId,
                object: 'document.analysis.chunk',
                delta: { content: chunk },
                finish_reason: null,
                ...(fileName && {
                  file: {
                    name: fileName,
                    type: isImage ? 'image' : 'document',
                  },
                }),
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
              );
            }

            // Send final chunk
            const finalData = {
              id: requestId,
              object: 'document.analysis.chunk',
              delta: {},
              finish_reason: 'stop',
              usage: {
                prompt_tokens: promptTokens,
                completion_tokens: tokenCount,
                total_tokens: promptTokens + tokenCount,
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`),
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();

            // Log usage
            if (context) {
              await logApiKeyUsage({
                apiKeyId: context.apiKey.id,
                endpoint: '/v1/documents/analyze',
                method: 'POST',
                promptTokens,
                completionTokens: tokenCount,
                totalTokens: promptTokens + tokenCount,
                statusCode: 200,
                responseTimeMs: Date.now() - startTime,
                model,
              });
            }
          } catch (error) {
            console.error('[API v1] Stream error:', error);
            const errorData = {
              error: {
                message: 'An error occurred during streaming',
                type: 'server_error',
                code: 'stream_error',
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`),
            );
            controller.close();
          }
        },
      });

      const response = new NextResponse(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Request-ID': requestId,
        },
      });

      return addRateLimitHeaders(response, context);
    }

    // Non-streaming response
    // Extended thinking requires temperature undefined or 1
    const nonStreamTemperature = modelConfig.enableReasoning ? undefined : 0.7;

    const result = await generateText({
      model: provider.languageModel(modelConfig.model),
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
      temperature: nonStreamTemperature,
      // Enable extended thinking for pro model (Claude Opus 4.5)
      ...(modelConfig.enableReasoning
        ? {
            providerOptions: {
              anthropic: {
                thinking: {
                  type: 'enabled',
                  budgetTokens: REASONING_BUDGET,
                },
              },
            },
          }
        : {}),
    });

    const completionTokens = Math.ceil(result.text.length / 4);
    const totalTokens = promptTokens + completionTokens;

    // Log usage
    await logApiKeyUsage({
      apiKeyId: context.apiKey.id,
      endpoint: '/v1/documents/analyze',
      method: 'POST',
      promptTokens,
      completionTokens,
      totalTokens,
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      model,
    });

    // Build response with optional file info
    const responseData: Record<string, unknown> = {
      id: requestId,
      object: 'document.analysis',
      answer: result.text,
      model,
      chunks_analyzed: relevantChunks.length,
      total_chunks: chunks.length,
      finish_reason: result.finishReason || 'stop',
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
    };

    // Include file info for file uploads
    if (fileName) {
      responseData.file = {
        name: fileName,
        type: isImage ? 'image' : 'document',
      };
      // Include image analysis details for images
      if (isImage && imageAnalysis) {
        responseData.image_analysis = {
          description: imageAnalysis.description,
          extracted_text: imageAnalysis.text || null,
        };
      }
    }

    const response = NextResponse.json(responseData, {
      headers: { 'X-Request-ID': requestId },
    });

    return addRateLimitHeaders(response, context);
  } catch (error) {
    console.error('[API v1] Error analyzing document:', error);

    if (context) {
      await logApiKeyUsage({
        apiKeyId: context.apiKey.id,
        endpoint: '/v1/documents/analyze',
        method: 'POST',
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return openaiError(
      'An internal error occurred',
      'server_error',
      'internal_error',
      null,
      500,
    );
  }
}

/**
 * OPTIONS /api/v1/documents/analyze
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
