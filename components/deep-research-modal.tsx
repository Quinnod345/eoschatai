'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, TrendingUp, Globe, FileSearch, Sparkles } from 'lucide-react';
import { UpgradePrompt } from '@/components/upgrade-prompt';
import { motion } from 'framer-motion';

interface DeepResearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeepResearchModal({ open, onClose }: DeepResearchModalProps) {
  const features = [
    {
      icon: <Search className="w-5 h-5" />,
      title: '40 Web Lookups per Session',
      description:
        'Comprehensive research with up to 40 intelligent searches to find exactly what you need',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Market & Competitor Analysis',
      description:
        'Compare competitors, analyze market trends, and evaluate EOS scorecards automatically',
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: 'Real-Time Information',
      description:
        'Access current data from across the web with intelligent filtering and relevance scoring',
    },
    {
      icon: <FileSearch className="w-5 h-5" />,
      title: 'Deep Contextual Understanding',
      description:
        'AI that understands complex queries and synthesizes information from multiple sources',
    },
  ];

  const useCases = [
    'Competitive landscape analysis for quarterly planning',
    'Industry trend research for strategic decisions',
    'Market sizing and opportunity assessment',
    'Best practices research for EOS implementation',
    'Technology evaluation and vendor comparison',
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <span>Nexus Deep Research</span>
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Advanced AI-powered research for leadership teams making strategic
            decisions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Feature List */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-3"
              >
                <div className="p-2 rounded-lg bg-muted h-fit">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-semibold">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Use Cases */}
          <div>
            <h4 className="font-semibold mb-3">Perfect for:</h4>
            <ul className="space-y-2">
              {useCases.map((useCase, index) => (
                <motion.li
                  key={useCase}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{useCase}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Deep Research is available with EOS Chat AI Business
            </p>
            <UpgradePrompt
              feature="premium"
              placement="deep-research:modal"
              cta="View Premium Plans"
            >
              <Button className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Unlock Deep Research
              </Button>
            </UpgradePrompt>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

