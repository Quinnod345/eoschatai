'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Target,
  Clock,
  ChevronRight,
  Sparkles,
  FileText,
  Globe,
  BookOpen,
  MessageSquare,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ResearchPlan } from '@/lib/ai/nexus-research-storage';

interface NexusResearchPlanProps {
  plan: ResearchPlan;
  onApprove?: () => void;
  onModify?: (plan: ResearchPlan) => void;
  isGenerating?: boolean;
}

export function NexusResearchPlan({
  plan,
  onApprove,
  onModify,
  isGenerating = false,
}: NexusResearchPlanProps) {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);
  const [showFullPlan, setShowFullPlan] = useState(false);

  useEffect(() => {
    // Auto-expand plan after generation
    if (!isGenerating && plan.phases.length > 0) {
      setShowFullPlan(true);
    }
  }, [isGenerating, plan.phases.length]);

  const getApproachIcon = (approach: string) => {
    switch (approach) {
      case 'comprehensive':
        return <Globe className="w-5 h-5" />;
      case 'focused':
        return <Target className="w-5 h-5" />;
      case 'exploratory':
        return <Search className="w-5 h-5" />;
      default:
        return <Brain className="w-5 h-5" />;
    }
  };

  const getApproachColor = (approach: string) => {
    switch (approach) {
      case 'comprehensive':
        return 'from-purple-500 to-blue-500';
      case 'focused':
        return 'from-green-500 to-teal-500';
      case 'exploratory':
        return 'from-orange-500 to-pink-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-6 mb-4 border border-purple-500/20"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            animate={isGenerating ? { rotate: 360 } : {}}
            transition={
              isGenerating
                ? {
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'linear',
                  }
                : {}
            }
          >
            <Brain className="w-6 h-6 text-purple-500" />
          </motion.div>
          <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">
            {isGenerating ? 'Creating Research Plan...' : 'Research Plan'}
          </h3>
        </div>

        {!isGenerating && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Est. {Math.round(plan.estimatedDuration / 60)} minutes
            </span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
              <p className="text-sm text-muted-foreground">
                Analyzing your query and planning the most effective research
                approach...
              </p>
            </div>

            {/* Skeleton loaders */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-purple-500/20 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-purple-500/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="plan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Main Query */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-purple-500 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-purple-700 dark:text-purple-300 mb-1">
                    Research Question
                  </h4>
                  <p className="text-sm">{plan.mainQuery}</p>
                </div>
              </div>
            </div>

            {/* Research Approach */}
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg bg-gradient-to-r ${getApproachColor(plan.researchApproach)}`}
              >
                {getApproachIcon(plan.researchApproach)}
              </div>
              <div>
                <p className="text-sm font-medium capitalize">
                  {plan.researchApproach} Research Approach
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.searchQueries.length} searches across{' '}
                  {plan.phases.length} phases
                </p>
              </div>
            </div>

            {/* Sub-questions */}
            {plan.subQuestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  Key Research Areas
                </h4>
                <ul className="space-y-1">
                  {plan.subQuestions.map((question, index) => (
                    <motion.li
                      key={`subq-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <ChevronRight className="w-4 h-4 mt-0.5 text-purple-500/60" />
                      <span>{question}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Research Phases */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" />
                Research Phases
              </h4>

              {plan.phases.map((phase, index) => (
                <motion.div
                  key={`phase-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-purple-500/10 rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPhase(expandedPhase === index ? null : index)
                    }
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-purple-500/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-medium text-purple-700 dark:text-purple-300">
                        {index + 1}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">{phase.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {phase.queries.length} searches
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                        expandedPhase === index ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {expandedPhase === index && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-3">
                          <p className="text-sm text-muted-foreground">
                            {phase.description}
                          </p>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Search Queries:
                            </p>
                            {phase.queries.map((query, qIndex) => (
                              <div
                                key={qIndex}
                                className="flex items-start gap-2 text-xs text-muted-foreground"
                              >
                                <Search className="w-3 h-3 mt-0.5 text-purple-500/40" />
                                <span>{query}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Action Buttons */}
            {(onApprove || onModify) && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-purple-500/10">
                {onModify && (
                  <button
                    onClick={() => onModify(plan)}
                    className="px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                  >
                    Modify Plan
                  </button>
                )}
                {onApprove && (
                  <button
                    onClick={onApprove}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-colors"
                  >
                    Start Research
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
