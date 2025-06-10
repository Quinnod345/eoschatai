import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - EOS Bot AI',
  description:
    'Privacy Policy for EOS Bot AI - Your AI-powered chat assistant for EOS Worldwide.',
};

export default function PrivacyPolicy() {
  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

        <h2 className="text-xl font-semibold mt-8 mb-4">1. Introduction</h2>
        <p>
          Welcome to EOS Bot AI (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
          &ldquo;us&rdquo;). We respect your privacy and are committed to
          protecting your personal data. This privacy policy will inform you
          about how we look after your personal data when you visit our website
          (https://app.eosbot.ai) and tell you about your privacy rights.
        </p>

        <p className="mb-4">
          When you use EOS Chat AI, we collect certain information to provide
          and improve our services. This includes information you provide
          directly (such as when you create an account), information we collect
          automatically (such as usage data), and information from third parties
          (such as authentication providers).
        </p>

        <p className="text-muted-foreground">
          We use terms like &ldquo;we,&rdquo; &ldquo;us,&rdquo; and
          &ldquo;our&rdquo; to refer to EOS Chat AI.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">2. Data We Collect</h2>
        <p>
          We may collect, use, store and transfer different kinds of personal
          data about you which we have grouped together as follows:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>
            <strong>Identity Data</strong> includes first name, last name,
            username, or similar identifier.
          </li>
          <li>
            <strong>Contact Data</strong> includes email address and telephone
            numbers.
          </li>
          <li>
            <strong>Technical Data</strong> includes internet protocol (IP)
            address, browser type and version, time zone setting and location,
            browser plug-in types and versions, operating system and platform,
            and other technology on the devices you use to access this website.
          </li>
          <li>
            <strong>Usage Data</strong> includes information about how you use
            our website and services.
          </li>
          <li>
            <strong>Chat Data</strong> includes the content of conversations you
            have with our AI assistant.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          3. How We Use Your Data
        </h2>
        <p>
          We will only use your personal data when the law allows us to. Most
          commonly, we will use your personal data in the following
          circumstances:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>To register you as a new customer and manage your account.</li>
          <li>To provide and improve our AI chat services.</li>
          <li>To respond to your inquiries and fulfill your requests.</li>
          <li>
            To send administrative information to you, such as changes to our
            terms, conditions, and policies.
          </li>
          <li>
            To analyze website usage to improve our content, products, and
            services.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          4. Data Sharing and Disclosure
        </h2>
        <p>We may share your personal information with:</p>
        <ul className="list-disc pl-6 mb-4">
          <li>
            Service providers acting as processors who provide IT and system
            administration services.
          </li>
          <li>
            Professional advisers including lawyers, bankers, auditors, and
            insurers.
          </li>
          <li>
            Regulators and other authorities who require reporting of processing
            activities in certain circumstances.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">5. Data Security</h2>
        <p>
          We have put in place appropriate security measures to prevent your
          personal data from being accidentally lost, used, or accessed in an
          unauthorized way. In addition, we limit access to your personal data
          to those employees, agents, contractors, and other third parties who
          have a business need to know.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">6. Data Retention</h2>
        <p>
          We will only retain your personal data for as long as necessary to
          fulfill the purposes we collected it for, including for the purposes
          of satisfying any legal, accounting, or reporting requirements.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          7. Your Legal Rights
        </h2>
        <p>
          Under certain circumstances, you have rights under data protection
          laws in relation to your personal data, including the right to:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li>Request access to your personal data.</li>
          <li>Request correction of your personal data.</li>
          <li>Request erasure of your personal data.</li>
          <li>Object to processing of your personal data.</li>
          <li>Request restriction of processing your personal data.</li>
          <li>Request transfer of your personal data.</li>
          <li>Right to withdraw consent.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          8. Third-Party Links
        </h2>
        <p>
          This website may include links to third-party websites, plug-ins, and
          applications. Clicking on those links or enabling those connections
          may allow third parties to collect or share data about you. We do not
          control these third-party websites and are not responsible for their
          privacy statements.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">9. Cookies</h2>
        <p>
          We use cookies and similar tracking technologies to track the activity
          on our website and hold certain information. Cookies are files with a
          small amount of data that may include an anonymous unique identifier.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">
          10. Changes to the Privacy Policy
        </h2>
        <p>
          We may update our Privacy Policy from time to time. We will notify you
          of any changes by posting the new Privacy Policy on this page and
          updating the &ldquo;Last Updated&rdquo; date at the top of this
          Privacy Policy.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4">11. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us
          at:
          <br />
          Email: privacy@app.eosbot.ai
          <br />
          Address: 123 EOS Way, Suite 456, Tech City, TC 78901
        </p>
      </div>
    </div>
  );
}
