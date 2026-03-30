'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingFooter() {
  return (
    <footer
      className="relative z-40 bg-black pointer-events-auto border-t border-white/[0.06]"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/images/eos-model-bulb.svg"
                alt="EOSAI"
                width={28}
                height={28}
                className="brightness-110"
              />
              <span className="font-montserrat text-lg font-bold text-white tracking-tight">
                EOSAI
              </span>
            </div>
            <p className="font-montserrat text-sm text-white/40 max-w-xs leading-relaxed">
              The AI-powered workspace for EOS implementation and
              business growth.
            </p>
          </div>

          <nav aria-label="Product links">
            <h3 className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase mb-4">
              Product
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/features"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/solutions"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Solutions
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  API Docs
                </Link>
              </li>
              <li>
                <Link
                  href="/chat"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Try Chat
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Company links">
            <h3 className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase mb-4">
              Company
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/privacy"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Terms
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@eosbot.ai"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Get started links">
            <h3 className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase mb-4">
              Get Started
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/register"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Create Account
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="font-montserrat text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="font-montserrat text-sm text-eos-orange/60 hover:text-eos-orange/80 transition-colors"
                >
                  EOS Academy
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="pt-8 border-t border-white/[0.04]">
          <p className="font-mono text-xs text-white/20 text-center tracking-wide">
            &copy; {new Date().getFullYear()} EOSAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
