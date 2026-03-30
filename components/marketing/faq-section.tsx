'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Mail } from 'lucide-react';

const faqItems = [
  {
    question: 'What is EOS AI?',
    answer:
      'EOS AI is an intelligent workspace built for teams running on EOS. It helps you work through core tools like the V/TO, Scorecard, Accountability Chart, and meeting workflows with AI-powered guidance grounded in the methodology.',
  },
  {
    question: 'How does it understand my company?',
    answer:
      'Upload your existing EOS documents, configure company context, and EOS AI uses retrieval-augmented generation (RAG) to ground every response in your actual business data. It also builds memory over time to give increasingly personalized support.',
  },
  {
    question: 'What EOS tools does it support?',
    answer:
      'V/TO development, accountability charts, scorecard tracking, Rock planning, Level 10 meeting support, IDS methodology, and to-do management. The Composer Studio can generate and export all of these as professional documents.',
  },
  {
    question: 'Does it replace an EOS Implementer?',
    answer:
      'No. EOS AI complements your implementer by keeping your team focused, prepared, and aligned between sessions. Think of it as always-on support that amplifies what your implementer delivers in person.',
  },
  {
    question: 'How does the EOS Academy integration work?',
    answer:
      'If you have a Circle membership through the EOS Academy, your plan syncs automatically: Discover maps to Free, Strengthen to Pro, and Mastery to Business. Each enrolled course also activates a dedicated AI assistant trained on that course material.',
  },
  {
    question: 'Can my whole team use it?',
    answer:
      'Yes. Business-tier organizations support up to 50 members with role-based access (Owner, Admin, Member). Mastery members from the EOS Academy get unlimited seats for resource sharing. Invite teammates via email or shareable invite codes.',
  },
  {
    question: 'What AI models power it?',
    answer:
      'EOS AI uses state-of-the-art models from Anthropic (Claude) and OpenAI. You get streaming responses, tool calling, and multi-step reasoning with the model best suited to each task.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'All data is encrypted in transit and at rest. Authentication uses OAuth 2.0 with Google. Payments are PCI-compliant via Stripe. You can delete your data at any time.',
  },
];

function FAQItem({ faq }: { faq: (typeof faqItems)[number] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-colors duration-200 hover:border-white/[0.1]"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span className="font-montserrat text-base md:text-lg font-semibold text-white">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-white/30" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5">
              <p className="font-montserrat text-sm md:text-base text-white/50 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  return (
    <section className="faq-section relative z-20 py-24 md:py-32 bg-zinc-950">
      <div className="container mx-auto px-6">
        <div className="faq-container max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
              FAQ
            </p>
            <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-white tracking-tight">
              Questions, Answered
            </h2>
          </div>

          <div className="space-y-3 mb-12" role="list" aria-label="FAQ items">
            {faqItems.map((faq) => (
              <FAQItem key={faq.question} faq={faq} />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-white/40">
            <Mail className="w-4 h-4 text-eos-orange/60" />
            <p className="font-montserrat text-sm">
              More questions?{' '}
              <a
                href="mailto:support@eosbot.ai"
                className="text-eos-orange/70 hover:text-eos-orange transition-colors"
              >
                support@eosbot.ai
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
