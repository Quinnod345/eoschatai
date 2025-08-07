'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Sparkles,
  FileSearch,
  CheckCircle2,
  Loader2,
  Target,
  Microscope,
  BookOpen,
  Zap,
  Globe,
  Database,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResearchStep {
  number: number;
  title: string;
  questionsCount: number;
  status: 'pending' | 'searching' | 'analyzing' | 'complete';
  questionsSearched?: number;
}

interface NexusProgressProps {
  phase: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'complete';
  message?: string;
  plan?: {
    mainObjective: string;
    steps: ResearchStep[];
    expectedOutcome: string;
  };
  currentStep?: number;
  totalResults?: number;
  className?: string;
}

const phaseIcons = {
  planning: Brain,
  searching: Search,
  analyzing: Microscope,
  synthesizing: Sparkles,
  complete: CheckCircle2,
};

const phaseColors = {
  planning: 'text-purple-500',
  searching: 'text-blue-500',
  analyzing: 'text-orange-500',
  synthesizing: 'text-green-500',
  complete: 'text-emerald-500',
};

const phaseBgColors = {
  planning: 'bg-purple-500/10',
  searching: 'bg-blue-500/10',
  analyzing: 'bg-orange-500/10',
  synthesizing: 'bg-green-500/10',
  complete: 'bg-emerald-500/10',
};

export function NexusResearchProgress({
  phase,
  message,
  plan,
  currentStep,
  totalResults = 0,
  className,
}: NexusProgressProps) {
  const [animatedResults, setAnimatedResults] = useState(0);
  const Icon = phaseIcons[phase];

  // Animate result counter
  useEffect(() => {
    if (totalResults > animatedResults) {
      const timer = setTimeout(() => {
        setAnimatedResults((prev) => Math.min(prev + 1, totalResults));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [totalResults, animatedResults]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'relative overflow-hidden rounded-2xl p-6',
        'backdrop-filter backdrop-blur-[16px]',
        'border border-white/30 dark:border-zinc-700/30',
        'bg-white/70 dark:bg-zinc-900/70',
        className,
      )}
      style={{
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:
          'inset 0px 0px 10px rgba(0, 0, 0, 0.1), 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.12)',
      }}
    >
      {/* Static background tint */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn('absolute inset-0 opacity-5', phaseBgColors[phase])}
        />
      </div>

      <div className="relative z-10">
        {/* Phase Header */}
        <div className="mb-6 flex items-center gap-3">
          <motion.div
            className={cn('rounded-full p-3', phaseBgColors[phase])}
            animate={{ rotate: phase === 'complete' ? 0 : 360 }}
            transition={{
              duration: phase === 'complete' ? 0.5 : 2,
              repeat: phase === 'complete' ? 0 : Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          >
            <Icon className={cn('h-6 w-6', phaseColors[phase])} />
          </motion.div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold capitalize">
              {phase} Research
            </h3>
            {message && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground"
              >
                {message}
              </motion.p>
            )}
          </div>
          {phase === 'searching' && animatedResults > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1"
            >
              <Database className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">
                {animatedResults} sources
              </span>
            </motion.div>
          )}
        </div>

        {/* Research Plan Display */}
        {plan && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            {/* Objective */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Research Objective</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {plan.mainObjective}
              </p>
            </div>

            {/* Steps Progress */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Research Steps</span>
              </div>

              {plan.steps.map((step, index) => {
                const isActive = currentStep === step.number;
                const isComplete = currentStep
                  ? step.number < currentStep
                  : false;
                const isPending = currentStep
                  ? step.number > currentStep
                  : true;

                return (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      'relative rounded-lg border p-4 transition-all',
                      isActive && 'border-primary bg-primary/5',
                      isComplete && 'border-emerald-500/50 bg-emerald-500/5',
                      isPending && 'border-muted opacity-50',
                    )}
                  >
                    {/* Step connector line */}
                    {index < plan.steps.length - 1 && (
                      <div
                        className={cn(
                          'absolute -bottom-3 left-8 h-6 w-0.5',
                          isComplete ? 'bg-emerald-500' : 'bg-muted',
                        )}
                      />
                    )}

                    <div className="flex items-start gap-3">
                      {/* Step indicator */}
                      <motion.div
                        className={cn(
                          'relative flex h-8 w-8 items-center justify-center rounded-full font-medium',
                          isActive && 'bg-primary text-primary-foreground',
                          isComplete && 'bg-emerald-500 text-white',
                          isPending && 'bg-muted text-muted-foreground',
                        )}
                        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                        transition={{
                          duration: 1,
                          repeat: isActive ? Number.POSITIVE_INFINITY : 0,
                        }}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          step.number
                        )}
                      </motion.div>

                      {/* Step content */}
                      <div className="flex-1">
                        <h4 className="font-medium">{step.title}</h4>
                        <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileSearch className="h-3 w-3" />
                            {step.questionsCount} question
                            {step.questionsCount !== 1 ? 's' : ''}
                          </span>
                          {isActive && step.questionsSearched !== undefined && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center gap-1"
                            >
                              <Zap className="h-3 w-3 text-yellow-500" />
                              {step.questionsSearched}/{step.questionsCount}{' '}
                              searched
                            </motion.span>
                          )}
                        </div>

                        {/* Progress bar for active step */}
                        {isActive && step.questionsSearched !== undefined && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                          >
                            <motion.div
                              className="h-full bg-primary"
                              initial={{ width: '0%' }}
                              animate={{
                                width: `${(step.questionsSearched / step.questionsCount) * 100}%`,
                              }}
                              transition={{ duration: 0.5 }}
                            />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Expected Outcome */}
            {phase === 'synthesizing' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-green-500/10 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">
                    Synthesizing Research
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {plan.expectedOutcome}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Fun loading messages */}
        {phase !== 'complete' && (
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Globe className="h-4 w-4 animate-pulse" />
            <AnimatedLoadingText phase={phase} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function AnimatedLoadingText({ phase }: { phase: string }) {
  const messages = {
    planning: [
      'Analyzing your query...',
      'Creating research strategy...',
      'Identifying key areas to explore...',
      'Formulating research questions...',
    ],
    searching: [
      'Scouring the web for insights...',
      'Finding authoritative sources...',
      'Collecting relevant information...',
      'Discovering hidden gems...',
    ],
    analyzing: [
      'Processing search results...',
      'Extracting key insights...',
      'Identifying patterns...',
      'Connecting the dots...',
    ],
    synthesizing: [
      'Weaving insights together...',
      'Creating comprehensive response...',
      'Adding citations and references...',
      'Polishing the final answer...',
    ],
  };

  const [messageIndex, setMessageIndex] = useState(0);
  const phaseMessages = messages[phase as keyof typeof messages] || [];

  useEffect(() => {
    if (phaseMessages.length === 0) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % phaseMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [phase, phaseMessages.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={messageIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {phaseMessages[messageIndex]}
      </motion.span>
    </AnimatePresence>
  );
}
