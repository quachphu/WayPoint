// The one branded splash moment — built on the gradient-bar hero pattern
// (src/components/ui/gradient-bar-hero-section.tsx), reskinned around the
// mascot instead of a generic trust row, with a real CTA instead of a
// waitlist form. Ambient motion (waving bars, drifting light, floating
// mascot, CTA shine, film grain) runs continuously so it reads as a living
// startup page, not a one-shot intro animation.
const BAR_COUNT = 15;

// Same silhouette as a classic equalizer: tall in the middle, short at the edges.
function barHeight(index: number, total: number): number {
  const position = index / (total - 1);
  const distanceFromCenter = Math.abs(position - 0.5) * 2;
  return 22 + 78 * Math.pow(distanceFromCenter, 1.3);
}

function GradientBars() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="flex h-full w-full" style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div
            key={i}
            className="flex-1"
            style={
              {
                background: 'linear-gradient(to top, var(--live) 0%, var(--live-gold) 55%, transparent 100%)',
                transformOrigin: 'bottom',
                '--h': barHeight(i, BAR_COUNT) / 100,
                // Slightly different duration per bar so the wave feels organic
                // rather than every bar breathing in perfect lockstep.
                animation: `bar-wave ${2.2 + (i % 5) * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 90}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      {/* Vignette so the bars read as ambient light rather than a hard edge. */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-transparent to-gray-950/40" />
    </div>
  );
}

// Two large, slow-drifting glows behind the mascot — the classic "aurora"
// backdrop that makes a startup landing page feel alive at rest.
function AuroraBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      <div
        className="absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'var(--live)', animation: 'drift-a 14s ease-in-out infinite' }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: 'var(--live-gold)', animation: 'drift-b 18s ease-in-out infinite' }}
      />
    </div>
  );
}

// A faint, flickering noise texture — the film-grain finish most polished
// dark-mode landing pages (Linear, Vercel) add over flat gradients so they
// don't read as sterile. Oversized + translated so the flicker never
// reveals a hard edge.
const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

function FilmGrain() {
  return (
    <div
      className="pointer-events-none absolute -inset-1/4 z-[2] opacity-[0.05] mix-blend-overlay"
      aria-hidden="true"
      style={{
        backgroundImage: `url("${GRAIN_SVG}")`,
        backgroundSize: '160px 160px',
        animation: 'grain-flicker 700ms steps(1) infinite',
      }}
    />
  );
}

export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-950 px-6 text-center">
      <GradientBars />
      <AuroraBlobs />
      <FilmGrain />

      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-center gap-2 py-6">
        <img src="/mascot/orb-idle.webp" alt="" width={26} height={26} className="object-contain" draggable={false} />
        <span className="font-display text-lg font-semibold tracking-tight text-white">Waypoint</span>
      </div>

      <div className="relative z-10 flex max-w-lg flex-col items-center animate-fadeIn">
        <img
          src="/mascot/orb-idle.webp"
          alt="Waypoint"
          width={120}
          height={120}
          draggable={false}
          className="object-contain"
          style={{
            filter: 'drop-shadow(0 10px 32px color-mix(in oklch, var(--live) 55%, transparent))',
            animation: 'mascot-float 3.6s ease-in-out infinite',
          }}
        />
        <span className="font-space mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70 backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: 'var(--live)' }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--live)' }} />
          </span>
          Your voice-first travel agent
        </span>
        <h1 className="font-display mt-5 text-[clamp(2.25rem,7.5vw,4.25rem)] font-semibold leading-[1.05] text-white">
          Where are we
          <br />
          <em className="font-space italic" style={{ color: 'var(--live-gold)' }}>
            headed?
          </em>
        </h1>
        <p className="font-space mt-5 text-base leading-relaxed text-white/60 sm:text-lg">
          Your sunny little travel buddy. It plans the trip, books it, and picks up the phone when a flight falls
          apart. Just say the word.
        </p>
        <button
          onClick={onStart}
          className="font-display relative mt-8 min-w-[160px] overflow-hidden rounded-full px-8 py-3.5 text-base font-medium text-white shadow-[0_8px_28px_rgba(255,122,46,0.4)] transition-transform duration-150 ease-out hover:brightness-110 active:scale-[0.97]"
          style={{ background: 'linear-gradient(180deg, var(--live) 0%, var(--live-deep) 100%)' }}
        >
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
              animation: 'cta-shine 3.4s ease-in-out infinite',
            }}
          />
          <span className="relative">Get started</span>
        </button>
      </div>

      <p className="font-space fixed inset-x-0 bottom-6 z-10 text-xs text-white/30">
        Built for the DeepLearning.AI Voice AI Hackathon
      </p>
    </section>
  );
}
