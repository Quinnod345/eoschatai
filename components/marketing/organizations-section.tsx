'use client';

import { Shield, Share2, UserPlus, Infinity as InfinityIcon } from 'lucide-react';

const orgFeatures = [
  {
    icon: Share2,
    title: 'Shared AI Personas',
    description:
      'Create and distribute custom AI personas across your entire organization. Every team member gets consistent, role-specific guidance.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description:
      'Owner, Admin, and Member roles with granular permissions. Control who can manage billing, invite members, and access shared resources.',
  },
  {
    icon: UserPlus,
    title: 'Flexible Invitations',
    description:
      'Invite team members via email or shareable invite codes. Onboard your entire leadership team in minutes.',
  },
  {
    icon: InfinityIcon,
    title: 'Unlimited Seats',
    description:
      'Mastery-tier organizations get unlimited seats for resource sharing. No per-seat charges, no cap on collaboration.',
  },
];

export default function OrganizationsSection() {
  return (
    <section className="org-section relative z-20 py-24 md:py-32 bg-gradient-to-b from-black to-[#001020]/30 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,46,93,0.15),transparent_60%)]" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: visual */}
            <div className="org-visual relative">
              <div className="relative aspect-square max-w-[480px] mx-auto">
                {/* Central hub */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-eos-orange/20 to-eos-orange/5 border border-eos-orange/20 flex items-center justify-center shadow-[0_0_60px_rgba(255,118,0,0.1)]">
                    <span className="font-montserrat text-lg font-bold text-white/90">
                      Org
                    </span>
                  </div>
                </div>

                {/* Orbiting member nodes */}
                {['Visionary', 'Integrator', 'Finance', 'Marketing', 'Sales', 'Ops'].map(
                  (role, i) => {
                    const angle = (360 / 6) * i - 90;
                    const rad = (angle * Math.PI) / 180;
                    const radius = 42;
                    const x = 50 + radius * Math.cos(rad);
                    const y = 50 + radius * Math.sin(rad);

                    return (
                      <div
                        key={role}
                        className="absolute w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center backdrop-blur-sm"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: 'translate(-50%, -50%)',
                          animation: `orgFloat 3s ease-in-out infinite`,
                          animationDelay: `${i * 0.4}s`,
                        }}
                      >
                        <span className="font-mono text-[9px] tracking-wide text-white/40 text-center leading-tight">
                          {role}
                        </span>
                      </div>
                    );
                  }
                )}

                {/* Connection lines (SVG) with pulse */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const angle = (360 / 6) * i - 90;
                    const rad = (angle * Math.PI) / 180;
                    const x = 50 + 42 * Math.cos(rad);
                    const y = 50 + 42 * Math.sin(rad);
                    return (
                      <line
                        key={i}
                        x1="50"
                        y1="50"
                        x2={x}
                        y2={y}
                        stroke="rgba(255,255,255,1)"
                        strokeWidth="0.3"
                        strokeDasharray="2 2"
                        style={{
                          animation: `orgPulse 2.5s ease-in-out infinite`,
                          animationDelay: `${i * 0.3}s`,
                        }}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Right: content */}
            <div className="org-content">
              <p className="font-mono text-xs tracking-[0.2em] text-eos-orange/70 uppercase mb-4">
                Teams
              </p>
              <h2 className="font-montserrat text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
                Built for
                <br />
                Organizations
              </h2>
              <p className="font-montserrat text-base text-white/50 leading-relaxed mb-10 max-w-lg">
                Bring your entire leadership team into one workspace. Shared
                knowledge, shared personas, and shared context mean everyone
                moves faster together.
              </p>

              <div className="space-y-6">
                {orgFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.title} className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        <Icon className="w-4 h-4 text-white/50" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h3 className="font-montserrat text-sm font-semibold text-white mb-1">
                          {feature.title}
                        </h3>
                        <p className="font-montserrat text-sm text-white/40 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
