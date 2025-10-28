#!/usr/bin/env tsx

/**
 * Context Effectiveness Analysis Script
 * Analyzes RAG context usage patterns and effectiveness
 * 
 * Usage: pnpm tsx scripts/analyze-context-effectiveness.ts
 */

import dotenv from 'dotenv';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { contextUsageLog } from '@/lib/db/schema';
import { sql, gte, lte, and } from 'drizzle-orm';

// Create db connection directly
const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: POSTGRES_URL or DATABASE_URL not found in environment');
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

interface UsageStats {
  totalQueries: number;
  byComplexity: {
    simple: number;
    medium: number;
    complex: number;
  };
  avgChunks: {
    system: number;
    persona: number;
    user: number;
    memory: number;
  };
  avgTokens: {
    total: number;
    context: number;
    response: number;
  };
  summaryUsage: number;
  feedbackStats: {
    helpful: number;
    notHelpful: number;
    pending: number;
    helpfulPercentage: number;
  };
}

async function analyzeContextEffectiveness(
  startDate?: Date,
  endDate?: Date,
): Promise<UsageStats> {
  console.log('📊 Analyzing Context Effectiveness...\n');

  // Build date filter
  const dateFilter = [];
  if (startDate) {
    dateFilter.push(gte(contextUsageLog.createdAt, startDate));
  }
  if (endDate) {
    dateFilter.push(lte(contextUsageLog.createdAt, endDate));
  }

  const whereClause = dateFilter.length > 0 ? and(...dateFilter) : undefined;

  // Get all logs
  const logs = await db
    .select()
    .from(contextUsageLog)
    .where(whereClause)
    .orderBy(contextUsageLog.createdAt);

  const totalQueries = logs.length;

  if (totalQueries === 0) {
    console.log('⚠️  No usage logs found for the specified period.');
    return {
      totalQueries: 0,
      byComplexity: { simple: 0, medium: 0, complex: 0 },
      avgChunks: { system: 0, persona: 0, user: 0, memory: 0 },
      avgTokens: { total: 0, context: 0, response: 0 },
      summaryUsage: 0,
      feedbackStats: {
        helpful: 0,
        notHelpful: 0,
        pending: 0,
        helpfulPercentage: 0,
      },
    };
  }

  // Complexity breakdown
  const byComplexity = {
    simple: logs.filter((l) => l.queryComplexity === 'simple').length,
    medium: logs.filter((l) => l.queryComplexity === 'medium').length,
    complex: logs.filter((l) => l.queryComplexity === 'complex').length,
  };

  // Average chunks
  const avgChunks = {
    system:
      logs.reduce((sum, l) => sum + (l.systemChunks || 0), 0) / totalQueries,
    persona:
      logs.reduce((sum, l) => sum + (l.personaChunks || 0), 0) / totalQueries,
    user: logs.reduce((sum, l) => sum + (l.userChunks || 0), 0) / totalQueries,
    memory:
      logs.reduce((sum, l) => sum + (l.memoryChunks || 0), 0) / totalQueries,
  };

  // Average tokens
  const avgTokens = {
    total:
      logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0) / totalQueries,
    context:
      logs.reduce((sum, l) => sum + (l.contextTokens || 0), 0) / totalQueries,
    response:
      logs.reduce((sum, l) => sum + (l.responseTokens || 0), 0) / totalQueries,
  };

  // Summary usage
  const summaryUsage = logs.filter((l) => l.conversationSummaryUsed).length;

  // Feedback stats
  const helpful = logs.filter((l) => l.userFeedback === 'helpful').length;
  const notHelpful = logs.filter(
    (l) => l.userFeedback === 'not_helpful',
  ).length;
  const pending = logs.filter((l) => l.userFeedback === 'pending').length;
  const feedbackProvided = helpful + notHelpful;
  const helpfulPercentage =
    feedbackProvided > 0 ? (helpful / feedbackProvided) * 100 : 0;

  const stats: UsageStats = {
    totalQueries,
    byComplexity,
    avgChunks,
    avgTokens,
    summaryUsage,
    feedbackStats: {
      helpful,
      notHelpful,
      pending,
      helpfulPercentage,
    },
  };

  return stats;
}

function printStats(stats: UsageStats) {
  console.log('═'.repeat(60));
  console.log('  CONTEXT EFFECTIVENESS ANALYSIS REPORT');
  console.log('═'.repeat(60));
  console.log();

  console.log('📈 OVERALL STATISTICS');
  console.log(`   Total Queries Analyzed: ${stats.totalQueries}`);
  console.log();

  console.log('🎯 QUERY COMPLEXITY DISTRIBUTION');
  console.log(
    `   Simple:  ${stats.byComplexity.simple} (${((stats.byComplexity.simple / stats.totalQueries) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   Medium:  ${stats.byComplexity.medium} (${((stats.byComplexity.medium / stats.totalQueries) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   Complex: ${stats.byComplexity.complex} (${((stats.byComplexity.complex / stats.totalQueries) * 100).toFixed(1)}%)`,
  );
  console.log();

  console.log('📚 AVERAGE CHUNKS PER QUERY');
  console.log(`   System Knowledge:  ${stats.avgChunks.system.toFixed(2)}`);
  console.log(`   Persona Documents: ${stats.avgChunks.persona.toFixed(2)}`);
  console.log(`   User Documents:    ${stats.avgChunks.user.toFixed(2)}`);
  console.log(`   User Memories:     ${stats.avgChunks.memory.toFixed(2)}`);
  console.log(
    `   Total Avg:         ${(stats.avgChunks.system + stats.avgChunks.persona + stats.avgChunks.user + stats.avgChunks.memory).toFixed(2)}`,
  );
  console.log();

  console.log('🔢 AVERAGE TOKEN USAGE');
  console.log(`   Total:    ${Math.round(stats.avgTokens.total)} tokens`);
  console.log(`   Context:  ${Math.round(stats.avgTokens.context)} tokens`);
  console.log(`   Response: ${Math.round(stats.avgTokens.response)} tokens`);
  console.log(
    `   Context %: ${((stats.avgTokens.context / stats.avgTokens.total) * 100).toFixed(1)}%`,
  );
  console.log();

  console.log('💬 CONVERSATION SUMMARY USAGE');
  console.log(
    `   Used in ${stats.summaryUsage} queries (${((stats.summaryUsage / stats.totalQueries) * 100).toFixed(1)}%)`,
  );
  console.log();

  console.log('👍 USER FEEDBACK');
  console.log(`   Helpful:     ${stats.feedbackStats.helpful}`);
  console.log(`   Not Helpful: ${stats.feedbackStats.notHelpful}`);
  console.log(`   Pending:     ${stats.feedbackStats.pending}`);
  console.log(
    `   Satisfaction Rate: ${stats.feedbackStats.helpfulPercentage.toFixed(1)}%`,
  );
  console.log();

  console.log('═'.repeat(60));
}

async function analyzeByComplexity() {
  console.log('\n📊 BREAKDOWN BY QUERY COMPLEXITY\n');

  const complexities = ['simple', 'medium', 'complex'] as const;

  for (const complexity of complexities) {
    const logs = await db
      .select()
      .from(contextUsageLog)
      .where(sql`${contextUsageLog.queryComplexity} = ${complexity}`);

    if (logs.length === 0) continue;

    const avgSystemChunks =
      logs.reduce((sum, l) => sum + (l.systemChunks || 0), 0) / logs.length;
    const avgPersonaChunks =
      logs.reduce((sum, l) => sum + (l.personaChunks || 0), 0) / logs.length;
    const avgUserChunks =
      logs.reduce((sum, l) => sum + (l.userChunks || 0), 0) / logs.length;
    const avgMemoryChunks =
      logs.reduce((sum, l) => sum + (l.memoryChunks || 0), 0) / logs.length;
    const avgTokens =
      logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0) / logs.length;

    const helpful = logs.filter((l) => l.userFeedback === 'helpful').length;
    const notHelpful = logs.filter(
      (l) => l.userFeedback === 'not_helpful',
    ).length;
    const feedbackProvided = helpful + notHelpful;
    const satisfaction =
      feedbackProvided > 0 ? (helpful / feedbackProvided) * 100 : 0;

    console.log(`${complexity.toUpperCase()} Queries (n=${logs.length}):`);
    console.log(
      `  Avg Chunks: System=${avgSystemChunks.toFixed(2)}, Persona=${avgPersonaChunks.toFixed(2)}, User=${avgUserChunks.toFixed(2)}, Memory=${avgMemoryChunks.toFixed(2)}`,
    );
    console.log(`  Avg Tokens: ${Math.round(avgTokens)}`);
    console.log(`  Satisfaction: ${satisfaction.toFixed(1)}%`);
    console.log();
  }
}

async function findOptimizationOpportunities() {
  console.log('\n💡 OPTIMIZATION OPPORTUNITIES\n');

  // Find queries with excessive context
  const highContextLogs = await db
    .select()
    .from(contextUsageLog)
    .where(sql`${contextUsageLog.contextTokens} > 8000`);

  if (highContextLogs.length > 0) {
    console.log(
      `⚠️  ${highContextLogs.length} queries used >8000 context tokens`,
    );
    console.log('   Consider: More aggressive compression or stricter limits');
  }

  // Find queries with low satisfaction and high context
  const inefficientLogs = await db
    .select()
    .from(contextUsageLog)
    .where(
      and(
        sql`${contextUsageLog.userFeedback} = 'not_helpful'`,
        sql`${contextUsageLog.contextTokens} > 5000`,
      ),
    );

  if (inefficientLogs.length > 0) {
    console.log(
      `⚠️  ${inefficientLogs.length} queries had high context but were not helpful`,
    );
    console.log(
      '   Consider: Better relevance filtering or context prioritization',
    );
  }

  // Find successful patterns
  const efficientLogs = await db
    .select()
    .from(contextUsageLog)
    .where(
      and(
        sql`${contextUsageLog.userFeedback} = 'helpful'`,
        sql`${contextUsageLog.contextTokens} < 3000`,
      ),
    );

  if (efficientLogs.length > 0) {
    console.log(
      `✅ ${efficientLogs.length} queries achieved high satisfaction with <3000 context tokens`,
    );
    console.log('   Pattern: Efficient context usage leads to better responses');
  }

  console.log();
}

// Main execution
async function main() {
  console.log('\n🚀 Starting Context Effectiveness Analysis...\n');

  try {
    // Analyze last 7 days by default
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stats = await analyzeContextEffectiveness(sevenDaysAgo);
    printStats(stats);

    await analyzeByComplexity();
    await findOptimizationOpportunities();

    console.log('✅ Analysis complete!\n');
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await client.end();
  }
}

main();

