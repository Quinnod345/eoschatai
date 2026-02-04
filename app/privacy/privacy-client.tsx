'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import LandingNavbar from '@/components/marketing/landing-navbar';
import LandingFooter from '@/components/marketing/landing-footer';

export default function PrivacyClient() {
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
              Privacy Policy
            </h1>
            <p className="font-montserrat text-lg text-white/70 max-w-2xl mx-auto">
              Your privacy is important to us. This policy explains how we collect, use, and protect your information.
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
              {/* Introduction */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Introduction
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  EOSAI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered assistant platform for EOS® implementation.
                </p>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  By accessing or using EOSAI, you agree to this Privacy Policy. If you do not agree with the terms of this policy, please do not access the application.
                </p>
              </div>

              {/* Information We Collect */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Information We Collect
                </h2>
                
                <h3 className="font-montserrat text-xl font-semibold text-white/90 mt-6 mb-3">
                  Personal Information
                </h3>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We may collect personal information that you voluntarily provide when using our service, including:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Name and email address when you create an account</li>
                  <li>Profile information such as your role and company details</li>
                  <li>Payment information when you subscribe to premium plans (processed securely via Stripe)</li>
                  <li>Communication preferences and settings</li>
                </ul>

                <h3 className="font-montserrat text-xl font-semibold text-white/90 mt-6 mb-3">
                  Usage Data
                </h3>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We automatically collect certain information when you access our service:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Device and browser information</li>
                  <li>IP address and general location data</li>
                  <li>Usage patterns and feature interactions</li>
                  <li>Chat conversations and AI interactions (for service improvement)</li>
                </ul>

                <h3 className="font-montserrat text-xl font-semibold text-white/90 mt-6 mb-3">
                  Documents and Content
                </h3>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  When you upload documents to EOSAI for our RAG (Retrieval-Augmented Generation) system, we process and store this content to provide personalized AI responses. This may include:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>EOS documents (V/TO, Scorecards, Accountability Charts, etc.)</li>
                  <li>Meeting notes and recordings</li>
                  <li>Business documents you choose to upload</li>
                </ul>
              </div>

              {/* How We Use Your Information */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  How We Use Your Information
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We use the information we collect for various purposes, including:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Providing and maintaining our AI assistant service</li>
                  <li>Personalizing your experience based on your documents and preferences</li>
                  <li>Processing transactions and managing subscriptions</li>
                  <li>Sending important service updates and notifications</li>
                  <li>Improving our AI models and service quality</li>
                  <li>Responding to customer support inquiries</li>
                  <li>Detecting and preventing fraud or abuse</li>
                  <li>Complying with legal obligations</li>
                </ul>
              </div>

              {/* Data Storage and Security */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Data Storage and Security
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We implement industry-standard security measures to protect your information:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li>Data encryption in transit (TLS/SSL) and at rest</li>
                  <li>Secure cloud infrastructure hosted on reputable providers</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Secure payment processing through Stripe</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  Your data is stored on secure servers in the United States. We retain your information for as long as your account is active or as needed to provide services, comply with legal obligations, and resolve disputes.
                </p>
              </div>

              {/* Third-Party Services */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Third-Party Services
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We work with trusted third-party service providers to operate our platform:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li><strong>OpenAI / Anthropic:</strong> AI model providers for chat functionality</li>
                  <li><strong>Stripe:</strong> Secure payment processing</li>
                  <li><strong>Vercel:</strong> Hosting and infrastructure</li>
                  <li><strong>Upstash:</strong> Vector database for document search</li>
                  <li><strong>Google:</strong> Calendar integration and OAuth authentication</li>
                  <li><strong>Sentry:</strong> Error monitoring and performance tracking</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  These providers have their own privacy policies governing the use of your information.
                </p>
              </div>

              {/* Your Rights */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Your Rights and Choices
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  You have several rights regarding your personal information:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                  <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                  <li><strong>Export:</strong> Export your data in a portable format</li>
                  <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  To exercise these rights, please contact us at{' '}
                  <a href="mailto:privacy@eosai.app" className="text-eos-orange hover:underline">
                    privacy@eosai.app
                  </a>
                  {' '}or use the account settings within the application.
                </p>
              </div>

              {/* Cookies */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Cookies and Tracking
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We use cookies and similar tracking technologies to enhance your experience:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-4 text-white/80 font-montserrat">
                  <li><strong>Essential cookies:</strong> Required for authentication and core functionality</li>
                  <li><strong>Analytics cookies:</strong> Help us understand how users interact with our service</li>
                  <li><strong>Preference cookies:</strong> Remember your settings and preferences</li>
                </ul>
                <p className="font-montserrat text-white/80 leading-relaxed mt-4">
                  You can control cookie preferences through your browser settings.
                </p>
              </div>

              {/* Children's Privacy */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Children&apos;s Privacy
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  EOSAI is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a minor, please contact us immediately.
                </p>
              </div>

              {/* Changes to Policy */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Changes to This Policy
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this policy periodically.
                </p>
              </div>

              {/* Contact */}
              <div className="mb-12">
                <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-white mb-4">
                  Contact Us
                </h2>
                <p className="font-montserrat text-white/80 leading-relaxed">
                  If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="mt-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                  <p className="font-montserrat text-white/80">
                    <strong className="text-white">Email:</strong>{' '}
                    <a href="mailto:privacy@eosai.app" className="text-eos-orange hover:underline">
                      privacy@eosai.app
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
