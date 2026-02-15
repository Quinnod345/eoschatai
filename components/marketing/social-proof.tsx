'use client';

const trustItems = [
  { value: '24/7', label: 'Always-on EOS guidance' },
  { value: 'Role-Based', label: 'Personalized AI personas' },
  { value: 'Document-Aware', label: 'Answers from your EOS docs' },
];

export default function SocialProof() {
  return (
    <section className="social-proof-section relative z-20 bg-black pb-8">
      <div className="container mx-auto px-6">
        <div className="social-proof-card max-w-5xl mx-auto rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-md px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-montserrat text-xs md:text-sm uppercase tracking-[0.14em] text-white/70 mb-2">
                Trusted workflow
              </p>
              <p className="font-montserrat text-lg md:text-2xl font-semibold text-white">
                Built for teams running on EOS
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              {trustItems.map((item) => (
                <div key={item.label}>
                  <p className="font-montserrat text-base md:text-lg font-semibold text-eos-orange">
                    {item.value}
                  </p>
                  <p className="font-montserrat text-xs md:text-sm text-white/80">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
