import { tool } from 'ai';
import { z } from 'zod';
import { searchWebSimple } from '@/lib/web-search-simple';

/**
 * Web search tool for AI to use when it needs current information from the internet.
 * This tool uses Firecrawl to search the web and return relevant results.
 */
export const searchWeb = tool({
  description: `CRITICAL: Use this tool IMMEDIATELY when the user asks about:
- Current events, news, or "today"/"latest"/"recent" information
- Real-time data (stocks, weather, sports scores)
- Company news or product announcements  
- Breaking news or updates
- "What's happening" questions
- Any question with temporal indicators (today, now, recently, latest)

ALWAYS use this tool when you see keywords like: today, latest, recent, now, current, breaking, update, news.

DO NOT answer from memory if the query implies current/recent information - SEARCH FIRST.`,
  parameters: z.object({
    query: z
      .string()
      .describe(
        'The search query to look up. Be specific and include relevant keywords.',
      ),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe(
        'Maximum number of search results to return (1-10). Default is 5.',
      ),
  }),
  execute: async ({ query, limit = 5 }) => {
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

      // Format results for the AI to consume
      const formattedResults = results.map((result, index) => ({
        position: index + 1,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        // Include the first 1000 characters of content if available
        content: result.content
          ? result.content.substring(0, 1000) +
            (result.content.length > 1000 ? '...' : '')
          : result.snippet,
      }));

      console.log(
        `[AI Web Search] Successfully found ${formattedResults.length} results`,
      );

      return {
        success: true,
        query: query,
        results: formattedResults,
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
