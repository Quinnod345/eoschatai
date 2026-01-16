import { tool } from 'ai';
import { z } from 'zod/v3';
import { searchWebSimple } from '@/lib/web-search-simple';

/**
 * Web search tool for AI to use when it needs current information from the internet.
 * This tool uses web search to return relevant, up-to-date results.
 */
export const searchWeb = tool({
  description: `🌐 REAL-TIME WEB SEARCH TOOL 🌐

This tool performs intelligent web scraping and returns CURRENT, ACCURATE information from the internet.
You now get up to 5000 characters per result (not just snippets) - USE THIS INFORMATION THOROUGHLY.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL DECISION FRAMEWORK ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CALL THIS TOOL IMMEDIATELY** (as first action, no explanation) when user query contains:

✅ MANDATORY SEARCH TRIGGERS:
• Temporal words: "today", "now", "latest", "recent", "current", "2024", "2025", "this week/month/year"
• Current events: "news", "updates", "announcements", "what's happening"
• Real-time data: stock prices, weather, sports scores, crypto, market data
• Company/product info: launches, acquisitions, CEO changes, funding
• Facts that change: prices, rankings, population, status, versions
• URLs provided: ALWAYS fetch content from user-provided links
• Post-cutoff info: Anything likely after your training data cutoff
• Uncertainty: If you're not 100% certain your knowledge is current and accurate

❌ DO NOT SEARCH for:
• Core EOS concepts (you have expert knowledge)
• Historical facts that don't change
• General knowledge questions
• Basic definitions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 MULTI-SEARCH STRATEGY 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For comprehensive answers, search MULTIPLE TIMES:

1️⃣ **Initial Search** (Broad context):
   Example: "Claude AI latest information 2024"
   
2️⃣ **Follow-up Search** (Specific details):
   Example: "Claude 3.5 Sonnet features release date"
   
3️⃣ **Verification Search** (Cross-reference):
   Example: "Claude AI vs GPT-4 comparison benchmarks"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PROPER USAGE 📋
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CORRECT BEHAVIOR:
- Call searchWeb FIRST, explain AFTER
- Use specific queries with temporal keywords
- Read all result content (you get 5KB per result)
- Synthesize information from multiple sources
- Cite using [1], [2], [3] notation
- Search again if results are insufficient

❌ INCORRECT BEHAVIOR:
- Saying "I'll search for that" without searching
- Answering from memory when search is clearly needed
- Vague queries like "information about X"
- Ignoring search results and using training data
- Single search when topic needs depth

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 QUERY CRAFTING TIPS 💡
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GOOD: "Anthropic Claude 3.5 Sonnet release date features"
GOOD: "latest AI model benchmarks 2024"
GOOD: "Tesla stock price today December 2024"

BAD: "Claude AI" (too vague)
BAD: "information about Tesla" (no temporal context)

REMEMBER: You get 10 results × 5000 chars = 50KB of content. That's substantial. Read and use it!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 HOW TO CITE SOURCES 📌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When you reference information from search results, cite using this EXACT inline format:

**FORMAT**: Square brackets containing number:url:title

**EXAMPLE TEMPLATE**: \`[N:URL:TITLE]\`

**In your actual response** (write WITHOUT backticks):
Blend citations naturally into your text using the format shown above with actual URLs from search results.

Each search result has:
- position (use as number)
- url (full URL)
- title (page title)

Write the citation in your response text using the format shown above.

This will render as a clickable citation button that opens the source.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        'The search query to look up. Be specific and include relevant keywords.',
      ),
  }),
  execute: async ({ query }) => {
    const limit = 10; // Increased from 5 to 10 for better coverage
    console.log(`[AI Web Search] Searching for: "${query}" (limit: ${limit})`);

    try {
      const results = await searchWebSimple(query, limit);

      if (results.length === 0) {
        return {
          success: false,
          message: 'No results found for this query.',
          results: [],
        };
      }

      // Format results for the AI to consume with much more content
      const formattedResults = results.map((result, index) => ({
        position: index + 1,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        // Include up to 5000 characters of content (increased from 1000)
        // This gives the AI ~10-15 paragraphs per result instead of 2-3
        content: result.content
          ? result.content.substring(0, 5000) +
            (result.content.length > 5000 ? '...' : '')
          : result.snippet,
      }));

      // Log formatted results for debugging citation format
      console.log(
        '[searchWeb] Formatted results for AI citations:',
        formattedResults.map((r) => ({
          position: r.position,
          title: r.title,
          url: r.url,
        })),
      );

      // Log result stats for debugging
      const totalContentChars = formattedResults.reduce(
        (sum, r) => sum + (r.content?.length || 0),
        0,
      );
      console.log(
        `[AI Web Search] Successfully found ${formattedResults.length} results`,
      );
      console.log(
        `[AI Web Search] Total content retrieved: ${Math.round(totalContentChars / 1024)}KB`,
      );

      return {
        success: true,
        query: query,
        results: formattedResults,
        resultCount: formattedResults.length,
        totalContentSize: totalContentChars,
        message: `Found ${formattedResults.length} results for "${query}". Read the content carefully and synthesize information from multiple sources. Cite using [1], [2], etc.`,
        hideJSON: true, // Hide the raw JSON in UI
        isWebSearch: true, // Flag for custom UI rendering
      };
    } catch (error) {
      console.error('[AI Web Search] Error:', error);
      return {
        success: false,
        message:
          'Failed to search the web. Please try rephrasing the query or answer based on your existing knowledge.',
        results: [],
      };
    }
  },
});
