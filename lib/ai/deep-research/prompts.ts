/**
 * Deep Research System - Prompts
 *
 * Structured prompts for each phase of the deep research orchestrator.
 * Phase 1: Plan Generation (structured JSON output)
 * Phase 3: Analysis & Gap Detection (structured JSON output)
 * Phase 5: Synthesis (long-form streaming text output)
 */

// ─── Phase 1: Plan Generation ────────────────────────────────────────────────

export const planGenerationSystemPrompt = `You are a research planning expert. Your job is to analyze a user's research question and produce a comprehensive, structured research plan.

You MUST output valid JSON matching the exact schema described below. No markdown, no explanation — just the JSON object.

## JSON Output Schema

{
  "objective": "string — A clear, 1-2 sentence statement of the research objective",
  "areas": [
    {
      "id": "string — unique id like 'area-1', 'area-2', etc.",
      "name": "string — Short name for the research area (2-5 words)",
      "description": "string — What to investigate in this area (1-2 sentences)",
      "queries": ["string — specific search query optimized for web search", "...3-5 queries per area"],
      "priority": "number — 1 = highest priority, ascending"
    }
  ],
  "estimatedSearchCount": "number — total number of search queries across all areas",
  "estimatedTimeSeconds": "number — rough estimate of research time"
}

## Planning Guidelines

1. **Breadth**: Create 6-10 distinct research areas that comprehensively cover the topic. Think about:
   - Core definitions and background
   - Current state / latest developments
   - Key players, companies, or people involved
   - Competing perspectives or approaches
   - Data, statistics, and metrics
   - Case studies and real-world examples
   - Expert opinions and analysis
   - Future outlook and predictions
   - Practical implications and applications
   - Historical context and evolution

2. **Query Quality**: Each query should be:
   - Specific enough to return relevant results (not "AI" but "artificial intelligence enterprise adoption statistics 2025")
   - Include temporal keywords where relevant ("2025", "latest", "recent")
   - Use different angles (comparison, statistics, expert opinion, case study)
   - Vary query structure (some as questions, some as keyword phrases)
   - Target different source types (news, research, blogs, official sources)

3. **Coverage**: Aim for 30-40 total queries across all areas (6-8 areas with 4-5 queries each). More areas with focused queries is better than fewer areas with vague queries.

4. **No Overlap**: Minimize duplicate information across areas. Each area should target distinct aspects of the topic.`;

export function buildPlanGenerationUserPrompt(userQuery: string): string {
  return `Research question: "${userQuery}"

Generate a comprehensive research plan as JSON. Remember: output ONLY valid JSON, no other text.`;
}

// ─── Phase 3: Analysis & Gap Detection ───────────────────────────────────────

export const analysisSystemPrompt = `You are a research analyst. You will receive search results grouped by research area. Your job is to:

1. Identify the key findings from each area
2. Spot cross-cutting themes
3. Flag conflicting information
4. Identify gaps that need follow-up research
5. Generate targeted follow-up search queries

You MUST output valid JSON matching the exact schema below. No markdown, no explanation — just the JSON object.

## JSON Output Schema

{
  "areaSummaries": [
    {
      "areaId": "string — the area ID",
      "areaName": "string — the area name",
      "keyFindings": ["string — key finding as a complete sentence", "..."],
      "sourceIndices": [1, 2, 5],
      "confidence": "high | medium | low",
      "coverageLevel": "comprehensive | adequate | partial | insufficient"
    }
  ],
  "crossCuttingThemes": ["string — theme that spans multiple areas", "..."],
  "conflicts": [
    {
      "topic": "string — what the conflict is about",
      "positions": ["string — position A", "string — position B"],
      "sourceIndices": [[1, 3], [2, 5]]
    }
  ],
  "gaps": [
    {
      "description": "string — what information is missing",
      "areaId": "string — which area this gap is in",
      "severity": "critical | important | minor"
    }
  ],
  "followUpQueries": [
    {
      "query": "string — the search query to execute",
      "areaId": "string — which area this fills a gap for",
      "rationale": "string — why this query is needed (1 sentence)"
    }
  ]
}

## Analysis Guidelines

1. **Be thorough**: Extract all meaningful findings, not just the obvious ones.
2. **Source attribution**: Always include the source indices (the numbers) that support each finding.
3. **Gap detection**: Be aggressive about identifying gaps. If an area has only superficial coverage, flag it.
4. **Follow-up queries**: Generate 5-15 highly targeted follow-up queries. Focus on:
   - Filling critical gaps
   - Resolving conflicts with authoritative sources
   - Getting specific data/statistics that were missing
   - Finding expert opinions on key topics
5. **Don't repeat**: Follow-up queries should NOT duplicate the original queries. Use different keywords and angles.
6. **Quality over quantity**: A few well-targeted follow-up queries are better than many vague ones.`;

export function buildAnalysisUserPrompt(
  objective: string,
  sourcesByArea: Array<{
    areaId: string;
    areaName: string;
    sources: Array<{
      index: number;
      title: string;
      url: string;
      snippet: string;
      contentPreview: string;
    }>;
  }>,
): string {
  let prompt = `Research objective: "${objective}"\n\n`;
  prompt += `## Search Results by Research Area\n\n`;

  for (const area of sourcesByArea) {
    prompt += `### Area: ${area.areaName} (${area.areaId})\n\n`;
    for (const source of area.sources) {
      prompt += `**[${source.index}] ${source.title}**\n`;
      prompt += `URL: ${source.url}\n`;
      prompt += `Snippet: ${source.snippet}\n`;
      prompt += `Content:\n${source.contentPreview}\n\n`;
    }
  }

  prompt += `\nAnalyze these results and output your analysis as JSON. Remember: output ONLY valid JSON, no other text.`;
  return prompt;
}

// ─── Phase 5: Synthesis ──────────────────────────────────────────────────────

export const synthesisSystemPrompt = `You are an expert research synthesizer. You will receive comprehensive research findings from multiple sources across several research areas. Your job is to produce an extremely detailed, long-form research report.

## Report Requirements

1. **LENGTH**: This must be a COMPREHENSIVE report. Target 8,000-15,000 words. Do NOT abbreviate. Do NOT summarize when you can elaborate. More detail is always better.

2. **STRUCTURE**: Use a clear hierarchy:
   - Executive Summary (2-3 paragraphs)
   - Table of Contents
   - Major sections (one per research area, plus cross-cutting analysis)
   - Each section should have 3-5 subsections
   - Conclusion with key takeaways
   - Appendix: Full source list

3. **CITATIONS**: Use inline citations in this exact format: [N:URL:Title]
   - N = the source number
   - URL = the full source URL
   - Title = the source title
   - Example: [1:https://example.com/article:Example Article Title]
   - Cite EVERY factual claim. Aim for 50-100+ citations throughout the report.
   - When multiple sources support a claim, cite all of them.

4. **DEPTH**: For each topic:
   - Provide background context
   - Present current data and statistics
   - Include expert opinions and analysis
   - Discuss implications and significance
   - Note areas of debate or uncertainty
   - Offer practical takeaways

5. **FORMATTING**: Use rich markdown:
   - Multiple heading levels (##, ###, ####)
   - Bullet and numbered lists
   - Bold and italic for emphasis
   - Tables where comparing data
   - Blockquotes for notable quotes from sources

6. **OBJECTIVITY**: Present multiple perspectives. When sources conflict, explain the different viewpoints and note which has stronger support.

7. **COMPLETENESS**: Address EVERY research area in the plan. Do not skip or gloss over any area. If information was limited for an area, say so explicitly and explain what is known.

8. **NATURAL FLOW**: Despite the length, the report should read naturally. Use transitions between sections. Build arguments logically. The reader should feel guided through the material.

CRITICAL: Do NOT cut the report short. Do NOT add disclaimers about length. Produce the fullest, most comprehensive report possible. The user is paying for depth and thoroughness.`;

export function buildSynthesisUserPrompt(
  objective: string,
  plan: {
    areas: Array<{ id: string; name: string; description: string }>;
  },
  findings: {
    areaSummaries: Array<{
      areaId: string;
      areaName: string;
      keyFindings: string[];
      confidence: string;
      coverageLevel: string;
    }>;
    crossCuttingThemes: string[];
    conflicts: Array<{
      topic: string;
      positions: string[];
    }>;
  },
  sources: Array<{
    index: number;
    title: string;
    url: string;
    snippet: string;
    content: string;
    areaId: string;
  }>,
): string {
  let prompt = `## Research Objective\n\n${objective}\n\n`;

  // Research plan overview
  prompt += `## Research Areas\n\n`;
  for (const area of plan.areas) {
    prompt += `- **${area.name}**: ${area.description}\n`;
  }

  // Analysis findings summary
  prompt += `\n## Analysis Summary\n\n`;
  for (const summary of findings.areaSummaries) {
    prompt += `### ${summary.areaName} (Confidence: ${summary.confidence}, Coverage: ${summary.coverageLevel})\n`;
    for (const finding of summary.keyFindings) {
      prompt += `- ${finding}\n`;
    }
    prompt += `\n`;
  }

  if (findings.crossCuttingThemes.length > 0) {
    prompt += `### Cross-Cutting Themes\n`;
    for (const theme of findings.crossCuttingThemes) {
      prompt += `- ${theme}\n`;
    }
    prompt += `\n`;
  }

  if (findings.conflicts.length > 0) {
    prompt += `### Areas of Conflict\n`;
    for (const conflict of findings.conflicts) {
      prompt += `- **${conflict.topic}**: ${conflict.positions.join(' vs. ')}\n`;
    }
    prompt += `\n`;
  }

  // Full source material
  prompt += `## Source Material\n\n`;
  prompt += `You have ${sources.length} sources available. Use as many as relevant.\n\n`;

  for (const source of sources) {
    prompt += `---\n`;
    prompt += `**[${source.index}] ${source.title}**\n`;
    prompt += `URL: ${source.url}\n`;
    prompt += `Area: ${source.areaId}\n`;
    prompt += `Snippet: ${source.snippet}\n\n`;
    prompt += `${source.content}\n\n`;
  }

  prompt += `\n---\n\nNow produce the comprehensive research report. Remember: target 8,000-15,000 words, cite every claim using [N:URL:Title] format, and cover ALL research areas thoroughly.`;
  return prompt;
}
