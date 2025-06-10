import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - EOS Bot AI',
  description:
    'Terms of Service for EOS Bot AI - Your AI-powered chat assistant for EOS Worldwide.',
};

export default function TermsOfService() {
  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          1. Acceptance of Terms
        </h2>
        <p>
          By accessing or using EOS Bot AI services (&ldquo;Service&rdquo;) at
          https://app.eosbot.ai, you agree to be bound by these Terms of
          Service. If you disagree with any part of the terms, you may not
          access the Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          2. Description of Service
        </h2>
        <p>
          EOS Bot AI provides an AI-powered chat assistant for EOS Worldwide.
          The Service may include features such as conversational AI, document
          analysis, and other AI-powered functionalities as described on our
          website.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">3. User Accounts</h2>
        <p>
          When you create an account with us, you must provide information that
          is accurate, complete, and current at all times. Failure to do so
          constitutes a breach of the Terms, which may result in immediate
          termination of your account on our Service.
        </p>
        <p>
          You are responsible for safeguarding the password that you use to
          access the Service and for any activities or actions under your
          password. You agree not to disclose your password to any third party.
          You must notify us immediately upon becoming aware of any breach of
          security or unauthorized use of your account.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          4. Intellectual Property
        </h2>
        <p>
          The Service and its original content, features, and functionality are
          and will remain the exclusive property of EOS Bot AI and its
          licensors. The Service is protected by copyright, trademark, and other
          laws.
        </p>
        <p>
          Our trademarks and trade dress may not be used in connection with any
          product or service without the prior written consent of EOS Bot AI.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">5. User Content</h2>
        <p>
          You retain all your ownership rights to any content you submit, post,
          or display on or through the Service. By uploading content to the
          Service, you grant us a worldwide, non-exclusive, royalty-free license
          to use, reproduce, and distribute your content in connection with the
          Service.
        </p>
        <p>
          You are responsible for your use of the Service, for any content you
          provide, and for any consequences thereof.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">6. Prohibited Uses</h2>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>Violate any applicable laws or regulations.</li>
          <li>Infringe any intellectual property rights.</li>
          <li>
            Transmit any material that is harmful, threatening, abusive,
            harassing, defamatory, or otherwise objectionable.
          </li>
          <li>
            Impersonate any person or entity or falsely state or misrepresent
            your affiliation with a person or entity.
          </li>
          <li>
            Interfere with or disrupt the Service or servers or networks
            connected to the Service.
          </li>
          <li>
            Collect or store personal data about other users without their
            express permission.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">7. Termination</h2>
        <p>
          We may terminate or suspend your account immediately, without prior
          notice or liability, for any reason whatsoever, including without
          limitation if you breach the Terms.
        </p>
        <p>
          Upon termination, your right to use the Service will immediately
          cease. If you wish to terminate your account, you may simply
          discontinue using the Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          8. Limitation of Liability
        </h2>
        <p>
          In no event shall EOS Bot AI, nor its directors, employees, partners,
          agents, suppliers, or affiliates, be liable for any indirect,
          incidental, special, consequential or punitive damages, including
          without limitation, loss of profits, data, use, goodwill, or other
          intangible losses, resulting from your access to or use of or
          inability to access or use the Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">9. Disclaimer</h2>
        <p>
          Your use of the Service is at your sole risk. The Service is provided
          on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. The
          Service is provided without warranties of any kind, whether express or
          implied.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          10. Changes to Terms
        </h2>
        <p>
          We reserve the right, at our sole discretion, to modify or replace
          these Terms at any time. We will provide notice of any changes by
          posting the new Terms on this page. Your continued use of the Service
          after any such changes constitutes your acceptance of the new Terms.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">11. Contact Us</h2>
        <p>
          If you have any questions about these Terms, please contact us at:
          <br />
          Email: legal@app.eosbot.ai
          <br />
          Address: 123 EOS Way, Suite 456, Tech City, TC 78901
        </p>
      </div>
    </div>
  );
}
