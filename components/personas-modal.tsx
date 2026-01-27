'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserIcon, Sparkles, Brain, Briefcase, Target } from 'lucide-react';
import { PremiumFeaturesModal } from '@/components/premium-features-modal';
import { motion } from 'framer-motion';

interface PersonasModalProps {
  open: boolean;
  onClose: () => void;
}

export function PersonasModal({ open, onClose }: PersonasModalProps) {
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const features = [
    {
      icon: <Brain className="w-5 h-5" />,
      title: 'Specialized Knowledge',
      description:
        'Each persona has deep expertise in specific EOS roles and responsibilities',
    },
    {
      icon: <Target className="w-5 h-5" />,
      title: 'Role-Based Guidance',
      description:
        'Get targeted advice based on your position - Integrator, Visionary, or department head',
    },
    {
      icon: <Briefcase className="w-5 h-5" />,
      title: 'Custom Personas',
      description:
        'Create your own AI assistants with specific knowledge and communication styles',
    },
  ];

  const examplePersonas = [
    {
      name: 'EOS Implementer',
      role: 'Expert EOS® coach and facilitator',
      color: 'from-eos-orange to-eos-orangeLight',
    },
    {
      name: 'Integrator Coach',
      role: 'Specialized in day-to-day operations',
      color: 'from-blue-500 to-blue-400',
    },
    {
      name: 'Visionary Guide',
      role: 'Strategic thinking and innovation',
      color: 'from-purple-500 to-purple-400',
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-eos-orange/20 to-eos-orangeLight/20">
                <UserIcon className="w-5 h-5 text-eos-orange" />
              </div>
              <span>EOS AI Personas</span>
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Unlock specialized AI assistants tailored to your EOS role and
              responsibilities
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

            {/* Example Personas */}
            <div>
              <h4 className="font-semibold mb-3">Available Personas</h4>
              <div className="grid gap-3">
                {examplePersonas.map((persona, index) => (
                  <motion.div
                    key={persona.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${persona.color} flex items-center justify-center text-white font-semibold`}
                    >
                      {persona.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{persona.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {persona.role}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Personas are available with EOSAI Pro
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  setShowPremiumModal(true);
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Unlock AI Personas
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PremiumFeaturesModal
        open={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />
    </>
  );
}
