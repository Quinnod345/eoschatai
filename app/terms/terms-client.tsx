'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import LandingNavbar from '@/components/marketing/landing-navbar';
import LandingFooter from '@/components/marketing/landing-footer';

export default function TermsClient() {
  return (
    <div className="relative w-full bg-black overflow-x-hidden min-h-screen">
      {/* Navbar */}
      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center"
          >
            <h1 className="font-montserrat text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Terms of Service
            </h1>
            <p className="font-montserrat text-lg text-white/70 max-w-2xl mx-auto">
              Please read these terms carefully before using EOSAI.
            </p>
            <p className="font-montserrat text-sm text-white/50 mt-4">
              Last updated: January 3, 2026
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content Section */}
      <section className="relative z-30 bg-black py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="prose prose-invert prose-lg max-w-none"
            >
              {/* Acceptance of Terms */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  1. Acceptance of Terms
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  By accessing or using EOSAI (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you disagree with any part of the terms, you may not access the Service.
                </p>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  These Terms apply to all visitors, users, and others who access or use the Service. By using the Service, you represent that you are at least 18 years old and have the legal capacity to enter into these Terms.
                </p>
              </div>

              {/* Description of Service */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  2. Description of Service
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  EOSAI is an AI-powered assistant platform designed to support EOS® (Entrepreneurial Operating System) implementation. The Service provides:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>AI chat assistance for EOS-related questions and guidance</li>
                  <li>Document upload and analysis using RAG (Retrieval-Augmented Generation) technology</li>
                  <li>Custom AI personas tailored to different EOS roles</li>
                  <li>Voice conversation and meeting recording capabilities</li>
                  <li>Document creation tools (V/TO, Scorecards, Accountability Charts)</li>
                  <li>Deep research capabilities through our Nexus engine</li>
                  <li>Team collaboration and organization management features</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  The Service is provided &quot;as is&quot; and we reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.
                </p>
              </div>

              {/* User Accounts */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  3. User Accounts
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  When you create an account with us, you must provide accurate, complete, and current information. Failure to do so constitutes a breach of the Terms.
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>You are responsible for safeguarding the password used to access the Service</li>
                  <li>You agree not to share your account credentials with any third party</li>
                  <li>You must notify us immediately upon becoming aware of any breach of security</li>
                  <li>You are responsible for all activities that occur under your account</li>
                </ul>
              </div>

              {/* Acceptable Use */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  4. Acceptable Use
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree NOT to:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Use the Service in any way that violates any applicable law or regulation</li>
                  <li>Attempt to gain unauthorized access to any portion of the Service</li>
                  <li>Use the Service to transmit any malicious code, viruses, or harmful content</li>
                  <li>Impersonate or attempt to impersonate EOSAI, an employee, or another user</li>
                  <li>Use the Service for any fraudulent or misleading purposes</li>
                  <li>Interfere with or disrupt the integrity or performance of the Service</li>
                  <li>Attempt to reverse engineer, decompile, or extract source code from the Service</li>
                  <li>Use the Service to generate content that is harmful, abusive, or illegal</li>
                  <li>Scrape, data mine, or use automated tools to access the Service without permission</li>
                  <li>Resell, sublicense, or commercialize the Service without authorization</li>
                </ul>
              </div>

              {/* User Content */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  5. User Content
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  You retain ownership of any content you upload, submit, or create using the Service (&quot;User Content&quot;). By uploading content, you grant us a limited license to:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Process and store your content to provide the Service</li>
                  <li>Use your content to generate AI responses and insights</li>
                  <li>Create embeddings and indexes for document search functionality</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  You represent and warrant that you own or have the necessary rights to all content you upload, and that such content does not infringe upon the intellectual property rights of any third party.
                </p>
              </div>

              {/* Intellectual Property */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  6. Intellectual Property
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  The Service and its original content (excluding User Content), features, and functionality are and will remain the exclusive property of EOSAI and its licensors. The Service is protected by copyright, trademark, and other laws.
                </p>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  EOS®, the EOS Model™, V/TO™, Traction®, and related terms are trademarks of EOS Worldwide, LLC. EOSAI is an independent product and is not affiliated with, endorsed by, or sponsored by EOS Worldwide, LLC.
                </p>
              </div>

              {/* Subscriptions and Payments */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  7. Subscriptions and Payments
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  Some features of the Service require a paid subscription. By subscribing:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>You agree to pay all fees associated with your chosen plan</li>
                  <li>Subscriptions are billed on a recurring basis (monthly or annually)</li>
                  <li>All payments are processed securely through Stripe</li>
                  <li>You may cancel your subscription at any time through your account settings</li>
                  <li>Cancellation takes effect at the end of the current billing period</li>
                  <li>We do not provide refunds for partial subscription periods</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  We reserve the right to change our pricing at any time. Any price changes will be communicated to you in advance and will apply to subsequent billing periods.
                </p>
              </div>

              {/* AI-Generated Content */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  8. AI-Generated Content
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  The Service uses artificial intelligence to generate responses, documents, and insights. You acknowledge that:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>AI-generated content may not always be accurate, complete, or up-to-date</li>
                  <li>You should verify important information before relying on it</li>
                  <li>AI responses are not a substitute for professional advice (legal, financial, medical, etc.)</li>
                  <li>We are not responsible for decisions made based on AI-generated content</li>
                  <li>AI outputs may vary and are not guaranteed to be consistent</li>
                </ul>
              </div>

              {/* Disclaimers */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  9. Disclaimers
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>MERCHANTABILITY or fitness for a particular purpose</li>
                  <li>Non-infringement of third-party rights</li>
                  <li>Uninterrupted, secure, or error-free operation</li>
                  <li>Accuracy or reliability of any content or information</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  EOSAI is not an EOS Implementer® and does not provide official EOS implementation services. The Service is a tool to assist with EOS-related tasks and should not replace the guidance of a certified EOS Implementer®.
                </p>
              </div>

              {/* Limitation of Liability */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  10. Limitation of Liability
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL EOSAI, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, OR AFFILIATES BE LIABLE FOR:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                  <li>Any loss of profits, revenue, data, or business opportunities</li>
                  <li>Any damages arising from your use or inability to use the Service</li>
                  <li>Any damages resulting from unauthorized access to your account</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  Our total liability to you for any claims arising from or related to the Service shall not exceed the amount you paid us in the twelve (12) months prior to the claim.
                </p>
              </div>

              {/* Indemnification */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  11. Indemnification
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  You agree to defend, indemnify, and hold harmless EOSAI and its officers, directors, employees, and agents from and against any claims, damages, obligations, losses, liabilities, costs, or expenses arising from:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Your use of the Service</li>
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any third-party rights</li>
                  <li>Any content you upload or submit to the Service</li>
                </ul>
              </div>

              {/* Termination */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  12. Termination
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Your right to use the Service will immediately cease</li>
                  <li>You may request a copy of your data before termination</li>
                  <li>We may delete your account and associated data</li>
                  <li>Provisions that should survive termination will remain in effect</li>
                </ul>
              </div>

              {/* Governing Law */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  13. Governing Law
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved in the courts of the State of Delaware.
                </p>
              </div>

              {/* Changes to Terms */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  14. Changes to Terms
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days&apos; notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                </p>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                </p>
              </div>

              {/* Contact */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  15. Contact Us
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  If you have any questions about these Terms, please contact us:
                </p>
                <div className="mt-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                  <p className="font-montserrat text-white/80">
                    <strong className="text-white">Email:</strong>{' '}
                    <a href="mailto:legal@eosai.app" className="text-eos-orange hover:underline">
                      legal@eosai.app
                    </a>
                  </p>
                  <p className="font-montserrat text-white/80 mt-2">
                    <strong className="text-white">General Inquiries:</strong>{' '}
                    <a href="mailto:quinn@upaway.dev" className="text-eos-orange hover:underline">
                      quinn@upaway.dev
                    </a>
                  </p>
                </div>
              </div>

              {/* Back to Home */}
              <div className="flex justify-center mt-12">
                <Link href="/">
                  <button type="button" className="font-montserrat bg-gradient-to-r from-eos-orange to-orange-600 hover:from-eos-orange/90 hover:to-orange-600/90 text-white px-8 py-3 rounded-full shadow-[0_8px_32px_rgba(255,121,0,0.3)] hover:shadow-[0_8px_48px_rgba(255,121,0,0.4)] transition-all duration-300 font-semibold">
                    Back to Home
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
