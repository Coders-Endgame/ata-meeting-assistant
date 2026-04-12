import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import './LandingPage.css';

/* ── Inline SVG Illustrations ── */

function HeroIllustration() {
  return (
    <svg className="hero-illustration" viewBox="0 0 600 420" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Laptop body */}
      <rect className="il-laptop" x="120" y="80" width="360" height="230" rx="16" fill="var(--il-device)" stroke="var(--il-stroke)" strokeWidth="2" />
      {/* Screen */}
      <rect x="140" y="100" width="320" height="190" rx="8" fill="var(--il-screen)" />
      {/* Video grid on screen */}
      <rect className="il-float-1" x="155" y="115" width="140" height="78" rx="6" fill="var(--il-accent1)" opacity="0.85" />
      <rect className="il-float-2" x="305" y="115" width="140" height="78" rx="6" fill="var(--il-accent2)" opacity="0.85" />
      <rect className="il-float-3" x="155" y="200" width="140" height="78" rx="6" fill="var(--il-accent3)" opacity="0.85" />
      <rect className="il-float-4" x="305" y="200" width="140" height="78" rx="6" fill="var(--il-accent1)" opacity="0.6" />
      {/* Person silhouettes in video tiles */}
      <circle cx="225" cy="145" r="14" fill="var(--il-person)" />
      <path d="M205 170 Q225 185 245 170" fill="var(--il-person)" opacity="0.7" />
      <circle cx="375" cy="145" r="14" fill="var(--il-person)" />
      <path d="M355 170 Q375 185 395 170" fill="var(--il-person)" opacity="0.7" />
      <circle cx="225" cy="230" r="14" fill="var(--il-person)" />
      <path d="M205 255 Q225 270 245 255" fill="var(--il-person)" opacity="0.7" />
      <circle cx="375" cy="230" r="14" fill="var(--il-person)" />
      <path d="M355 255 Q375 270 395 255" fill="var(--il-person)" opacity="0.7" />
      {/* Laptop base */}
      <path d="M80 310 L120 310 L120 316 Q120 320 124 320 L476 320 Q480 320 480 316 L480 310 L520 310 Q526 310 524 318 L510 340 Q508 344 504 344 L96 344 Q92 344 90 340 L76 318 Q74 310 80 310Z" fill="var(--il-device)" stroke="var(--il-stroke)" strokeWidth="2" />
      {/* Floating elements */}
      <g className="il-orbit-1">
        <rect x="490" y="60" width="90" height="70" rx="10" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="1.5" />
        <line x1="505" y1="78" x2="565" y2="78" stroke="var(--il-accent1)" strokeWidth="3" strokeLinecap="round" />
        <line x1="505" y1="90" x2="550" y2="90" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
        <line x1="505" y1="100" x2="558" y2="100" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
        <line x1="505" y1="110" x2="540" y2="110" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="il-orbit-2">
        <rect x="20" y="100" width="80" height="80" rx="10" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="1.5" />
        <circle cx="60" cy="128" r="16" fill="var(--il-accent2)" opacity="0.2" stroke="var(--il-accent2)" strokeWidth="2" />
        <polyline points="50,128 57,136 72,120" fill="none" stroke="var(--il-accent2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="34" y1="158" x2="86" y2="158" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
        <line x1="34" y1="168" x2="74" y2="168" stroke="var(--il-text-line)" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Waveform / AI spark */}
      <g className="il-pulse">
        <circle cx="530" cy="190" r="28" fill="var(--il-accent1)" opacity="0.12" />
        <circle cx="530" cy="190" r="18" fill="var(--il-accent1)" opacity="0.25" />
        <path d="M520 190 L525 180 L530 196 L535 184 L540 190" fill="none" stroke="var(--il-accent1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Sparkles */}
      <g className="il-sparkle-1"><path d="M100 60 L103 68 L110 70 L103 72 L100 80 L97 72 L90 70 L97 68Z" fill="var(--il-accent1)" /></g>
      <g className="il-sparkle-2"><path d="M500 340 L502 346 L508 348 L502 350 L500 356 L498 350 L492 348 L498 346Z" fill="var(--il-accent2)" /></g>
      <g className="il-sparkle-3"><path d="M560 50 L562 54 L566 55 L562 56 L560 60 L558 56 L554 55 L558 54Z" fill="var(--il-accent3)" /></g>
    </svg>
  );
}

function TranscriptIcon() {
  return (
    <svg className="feature-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="6" width="50" height="64" rx="8" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="2" />
      <rect className="il-line-animate-1" x="20" y="20" width="30" height="4" rx="2" fill="var(--il-accent1)" />
      <rect className="il-line-animate-2" x="20" y="30" width="24" height="4" rx="2" fill="var(--il-text-line)" />
      <rect className="il-line-animate-3" x="20" y="40" width="28" height="4" rx="2" fill="var(--il-text-line)" />
      <rect className="il-line-animate-4" x="20" y="50" width="20" height="4" rx="2" fill="var(--il-text-line)" />
      <g className="il-orbit-mic">
        <circle cx="58" cy="56" r="16" fill="var(--il-accent2)" opacity="0.15" />
        <rect x="54" y="44" width="8" height="16" rx="4" fill="var(--il-accent2)" />
        <path d="M50 56 Q50 64 58 64 Q66 64 66 56" fill="none" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" />
        <line x1="58" y1="64" x2="58" y2="70" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function SummaryIcon() {
  return (
    <svg className="feature-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="32" fill="var(--il-accent1)" opacity="0.1" stroke="var(--il-accent1)" strokeWidth="2" />
      <g className="il-brain-pulse">
        <path d="M28 44 Q28 30 40 28 Q52 30 52 44" fill="none" stroke="var(--il-accent1)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M32 44 Q32 34 40 32 Q48 34 48 44" fill="none" stroke="var(--il-accent1)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <circle cx="40" cy="44" r="3" fill="var(--il-accent1)" />
        {/* Rays */}
        <line x1="40" y1="18" x2="40" y2="24" stroke="var(--il-accent1)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <line x1="54" y1="24" x2="50" y2="28" stroke="var(--il-accent1)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <line x1="26" y1="24" x2="30" y2="28" stroke="var(--il-accent1)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </g>
      <rect className="il-line-animate-1" x="26" y="52" width="28" height="3" rx="1.5" fill="var(--il-text-line)" />
      <rect className="il-line-animate-2" x="28" y="58" width="24" height="3" rx="1.5" fill="var(--il-text-line)" />
    </svg>
  );
}

function ActionItemIcon() {
  return (
    <svg className="feature-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="60" height="60" rx="12" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="2" />
      {/* Checkboxes */}
      <g className="il-check-1">
        <rect x="18" y="22" width="14" height="14" rx="3" fill="var(--il-accent2)" opacity="0.15" stroke="var(--il-accent2)" strokeWidth="1.5" />
        <polyline points="21,29 24,33 31,25" fill="none" stroke="var(--il-accent2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <rect x="38" y="27" width="24" height="3" rx="1.5" fill="var(--il-text-line)" />
      <g className="il-check-2">
        <rect x="18" y="42" width="14" height="14" rx="3" fill="var(--il-accent3)" opacity="0.15" stroke="var(--il-accent3)" strokeWidth="1.5" />
        <polyline points="21,49 24,53 31,45" fill="none" stroke="var(--il-accent3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <rect x="38" y="47" width="20" height="3" rx="1.5" fill="var(--il-text-line)" />
      <g className="il-check-3">
        <rect x="18" y="62" width="14" height="14" rx="3" fill="var(--il-accent1)" opacity="0.1" stroke="var(--il-stroke)" strokeWidth="1.5" strokeDasharray="3 2" />
      </g>
      <rect x="38" y="67" width="18" height="3" rx="1.5" fill="var(--il-text-line)" opacity="0.5" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg className="feature-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Robot head */}
      <rect x="18" y="24" width="44" height="38" rx="10" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="2" />
      {/* Antenna */}
      <line x1="40" y1="10" x2="40" y2="24" stroke="var(--il-stroke)" strokeWidth="2" />
      <circle className="il-antenna-blink" cx="40" cy="8" r="5" fill="var(--il-accent1)" />
      {/* Eyes */}
      <circle className="il-eye-left" cx="32" cy="40" r="5" fill="var(--il-accent2)" />
      <circle className="il-eye-right" cx="48" cy="40" r="5" fill="var(--il-accent2)" />
      {/* Mouth */}
      <path d="M30 52 Q40 58 50 52" fill="none" stroke="var(--il-accent1)" strokeWidth="2" strokeLinecap="round" />
      {/* Ears */}
      <rect x="8" y="34" width="10" height="16" rx="4" fill="var(--il-accent1)" opacity="0.2" stroke="var(--il-stroke)" strokeWidth="1.5" />
      <rect x="62" y="34" width="10" height="16" rx="4" fill="var(--il-accent1)" opacity="0.2" stroke="var(--il-stroke)" strokeWidth="1.5" />
      {/* Body hint */}
      <path d="M26 62 Q40 72 54 62" fill="var(--il-card)" stroke="var(--il-stroke)" strokeWidth="2" />
    </svg>
  );
}

/* ── Intersection Observer hook for scroll reveal ── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.15 }
    );
    const children = el.querySelectorAll('.reveal');
    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ── Landing Page ── */

export default function LandingPage() {
  const revealRef = useScrollReveal();

  return (
    <div className="landing-page" ref={revealRef}>

      {/* ─── Hero Section ─── */}
      <section className="hero-section reveal">
        <div className="hero-text">
          <span className="hero-badge">AI-Powered Meeting Assistant</span>
          <h1 className="hero-title">
            Turn Every <span className="gradient-text">Meeting</span> into
            <br />Clear Actions &amp; Insights
          </h1>
          <p className="hero-subtitle">
            Automatically record, transcribe, summarize, and extract action items from your
            Zoom meetings — so you can focus on what matters.
          </p>
          <div className="hero-buttons">
            <Link to="/auth">
              <button className="button primary hero-cta">Get Started Free</button>
            </Link>
            <a href="#features" className="hero-secondary-link">
              See how it works ↓
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <HeroIllustration />
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="features-section" id="features">
        <h2 className="section-title reveal">
          Everything You Need After a Meeting
        </h2>
        <p className="section-subtitle reveal">
          From live recording to structured follow-ups — all automated.
        </p>

        <div className="features-grid">
          <div className="feature-card reveal">
            <BotIcon />
            <h3>Zoom Bot Recording</h3>
            <p>A smart bot joins your Zoom meeting, records the audio and captures every word spoken.</p>
          </div>
          <div className="feature-card reveal">
            <TranscriptIcon />
            <h3>Live Transcription</h3>
            <p>Get a full, accurate transcript of your meeting — searchable and shareable with your team.</p>
          </div>
          <div className="feature-card reveal">
            <SummaryIcon />
            <h3>AI Summaries</h3>
            <p>Our AI distills long discussions into concise summaries so you never miss the key points.</p>
          </div>
          <div className="feature-card reveal">
            <ActionItemIcon />
            <h3>Action Items</h3>
            <p>Automatically extract tasks and assign them to team members with clear deadlines.</p>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="steps-section">
        <h2 className="section-title reveal">How It Works</h2>
        <div className="steps-timeline">
          <div className="step reveal">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Create a Session</h4>
              <p>Paste your Zoom meeting link and invite your team.</p>
            </div>
          </div>
          <div className="step reveal">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Bot Joins &amp; Records</h4>
              <p>Our AI bot seamlessly joins the call and starts recording.</p>
            </div>
          </div>
          <div className="step reveal">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Get Transcript &amp; Summary</h4>
              <p>Receive a full transcript and AI-generated summary instantly.</p>
            </div>
          </div>
          <div className="step reveal">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Track Action Items</h4>
              <p>Review extracted tasks, assign owners, and stay on track.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="cta-section reveal">
        <div className="cta-card">
          <h2>Ready to supercharge your meetings?</h2>
          <p>Join teams who save hours every week with AI meeting notes.</p>
          <Link to="/auth">
            <button className="button primary hero-cta">Start Now — It's Free</button>
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer reveal">
        <p>© 2026 ATA Meeting Assistant · Built with ❤️</p>
      </footer>
    </div>
  );
}
