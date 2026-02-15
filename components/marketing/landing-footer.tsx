'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingFooter() {
  return (
    <footer
      className="relative z-40 bg-black pointer-events-auto border-t border-white/10"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/images/eos-model-bulb.svg"
                alt="EOSAI"
                width={32}
                height={32}
                className="brightness-110"
              />
              <span className="font-montserrat text-xl font-bold text-white">
                EOSAI
              </span>
            </div>
            <p className="font-montserrat text-sm text-white/80">
              Your AI-powered assistant for EOS implementation and business
              growth.
            </p>
          </div>

          <nav aria-label="Product links">
            <h3 className="font-montserrat font-semibold text-white mb-4">
              Product
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/features"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/chat"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  Try Chat
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  API Documentation
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Company links">
            <h3 className="font-montserrat font-semibold text-white mb-4">
              Company
            </h3>
            <ul className="space-y-2">
              <li>
                <span className="font-montserrat text-sm text-white/80 cursor-default">
                  Contact
                </span>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Get started links">
            <h3 className="font-montserrat font-semibold text-white mb-4">
              Get Started
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/register"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  Create Account
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/chat"
                  className="font-montserrat text-sm text-white/80 hover:text-white transition-colors"
                >
                  Start Chat
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="pt-8 border-t border-white/10">
          <p className="font-montserrat text-sm text-white/60 text-center">
            © {new Date().getFullYear()} EOSAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
