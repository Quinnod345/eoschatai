import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { StepResults } from './nexus-search-executor';

export interface StepAnalysis {
  stepNumber: number;
  stepTitle: string;
  analysis: string;
  keyFindings: string[];
  relevantSources: Array<{
    url: string;
    title: string;
    relevance: string;
  }>;
}

/**
 * Analyze the search results for a single research step
 */
export async function analyzeStepResults(
  stepResults: StepResults,
): Promise<StepAnalysis> {
  const { step, searchResults } = stepResults;

  console.log(
    `[Nexus Analyzer] Analyzing step ${step.stepNumber}: ${step.stepTitle}`,
  );

  // Prepare content for analysis
  const searchContent = searchResults
    .map((sr) => {
      const resultsText = sr.results
        .map(
          (r, idx) => `
Source ${idx + 1}: ${r.title}
URL: ${r.url}
Summary: ${r.snippet}
Content excerpt: ${r.content.substring(0, 500)}...
`,
        )
        .join('\n');

      return `
Question: ${sr.question}
Found ${sr.results.length} sources:
${resultsText}`;
    })
    .join('\n---\n');

  const prompt = `Analyze these search results for research step "${step.stepTitle}":

Objective: ${step.objective}

Search Results:
${searchContent}

Provide:
1. A comprehensive analysis of what was found
2. Key findings that directly address the step's objective
3. How each source contributes to answering the questions
4. Which sources are most valuable and why

Focus on extracting actionable insights and practical information.`;

  try {
    const result = await generateText({
      model: openai('gpt-5-mini'),
      prompt,
      maxTokens: 1000,
    });

    // Extract key findings and sources from the analysis
    const keyFindings = extractKeyFindings(result.text);
    const relevantSources = extractRelevantSources(searchResults);

    return {
      stepNumber: step.stepNumber,
      stepTitle: step.stepTitle,
      analysis: result.text,
      keyFindings,
      relevantSources,
    };
  } catch (error) {
    console.error(
      `[Nexus Analyzer] Error analyzing step ${step.stepNumber}:`,
      error,
    );
    return {
      stepNumber: step.stepNumber,
      stepTitle: step.stepTitle,
      analysis: 'Unable to analyze results for this step.',
      keyFindings: [],
      relevantSources: [],
    };
  }
}

/**
 * Extract key findings from analysis text
 */
function extractKeyFindings(analysisText: string): string[] {
  const findings: string[] = [];
  const lines = analysisText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for bullet points or numbered items
    if (trimmed.match(/^[-•*]|\d+\.|^Key finding/i)) {
      const finding = trimmed
        .replace(/^[-•*]\s*|\d+\.\s*|^Key finding[:\s]*/i, '')
        .trim();
      if (finding.length > 20) {
        findings.push(finding);
      }
    }
  }

  return findings.slice(0, 5); // Top 5 findings
}

/**
 * Extract the most relevant sources with explanations
 */
function extractRelevantSources(
  searchResults: any[],
): StepAnalysis['relevantSources'] {
  const sources: StepAnalysis['relevantSources'] = [];

  for (const questionResult of searchResults) {
    for (const result of questionResult.results.slice(0, 2)) {
      // Top 2 per question
      if (result.url && result.title) {
        sources.push({
          url: result.url,
          title: result.title,
          relevance: `Addresses: ${questionResult.question}`,
        });
      }
    }
  }

  return sources;
}
