'use client';

import { ChevronDown, Mail } from 'lucide-react';

const faqItems = [
  {
    question: 'What is EOS AI?',
    answer:
      'EOS AI is an intelligent assistant built for EOS implementation. It helps your team work through core tools like the V/TO, Scorecard, and meeting workflows with practical guidance.',
  },
  {
    question: 'How can EOS AI help my business?',
    answer:
      'EOS AI keeps your team aligned by turning your context and documents into actionable support for execution, planning, and decision-making.',
  },
  {
    question: 'What EOS tools does EOS AI support?',
    answer:
      'EOS AI supports core EOS workflows including V/TO development, accountability planning, Scorecard review, Rock tracking, and meeting support.',
  },
  {
    question: 'Can I upload my existing EOS documents?',
    answer:
      'Yes. Upload existing EOS docs and EOS AI will use them as context so responses are personalized to your company and your operating rhythm.',
  },
  {
    question: 'Does EOS AI replace an EOS Implementer?',
    answer:
      'No. EOS AI is designed to complement your implementer by helping your team stay focused and prepared between sessions.',
  },
];

export default function FAQSection() {
  return (
    <section className="faq-section relative z-20 py-24 bg-gradient-to-b from-zinc-950 via-black to-black">
      <div className="container mx-auto px-6">
        <div className="faq-container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-white mb-4">
              Questions, Answered
            </h2>
            <p className="font-montserrat text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              Everything you need to know before rolling EOS AI into your team.
            </p>
          </div>

          <div className="space-y-4 mb-10" role="list" aria-label="FAQ items">
            {faqItems.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-md px-5 py-4 md:px-6 md:py-5"
              >
                <summary className="list-none cursor-pointer flex items-center justify-between gap-4">
                  <span className="font-montserrat text-base md:text-lg font-semibold text-white">
                    {faq.question}
                  </span>
                  <ChevronDown className="w-5 h-5 text-white/70 transition-transform duration-300 group-open:rotate-180 flex-shrink-0" />
                </summary>

                <div className="grid grid-rows-[0fr] transition-all duration-300 ease-out group-open:grid-rows-[1fr]">
                  <div className="overflow-hidden">
                    <p className="pt-4 font-montserrat text-sm md:text-base text-white/85 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </details>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-white/80">
            <Mail className="w-4 h-4 text-eos-orange" />
            <p className="font-montserrat text-sm md:text-base">
              Need more detail? Contact us at{' '}
              <a
                href="mailto:support@eosbot.ai"
                className="text-eos-orange hover:text-orange-400 transition-colors"
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
