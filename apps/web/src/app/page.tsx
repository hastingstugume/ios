'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const LIVE_SIGNALS = [
  { score: 94, label: 'BUYING_INTENT',   source: 'r/entrepreneur',  text: 'Looking for AI automation agency, $20-50k budget available…', color: '#22c55e' },
  { score: 88, label: 'BUYING_INTENT',   source: 'Founder forum',   text: 'Growth team looking for a retained partner to improve conversions…', color: '#22c55e' },
  { score: 91, label: 'BUYING_INTENT',   source: 'Ops community',   text: 'Need outside support for a time-sensitive systems migration this month…', color: '#22c55e' },
  { score: 78, label: 'RECOMMENDATION',  source: 'Buyer thread',    text: 'Comparing vendors and open to expert guidance before deciding…', color: '#3b82f6' },
  { score: 85, label: 'PAIN_COMPLAINT',  source: 'r/entrepreneur',  text: 'Internal processes are slowing delivery and the team needs help…', color: '#f59e0b' },
  { score: 72, label: 'HIRING_SIGNAL',   source: 'Ops community',   text: 'Open to interim specialist support while searching for a permanent hire…', color: '#a78bfa' },
  { score: 69, label: 'RECOMMENDATION',  source: 'Buyer thread',    text: 'Looking for a short expert review before committing budget…', color: '#3b82f6' },
  { score: 82, label: 'BUYING_INTENT',   source: 'r/SaaS',          text: 'Scaling to 500 customers, need proper infrastructure help…', color: '#22c55e' },
];

const STEPS = [
  { n: '01', title: 'Source capture',   desc: 'Relevant conversations and posts are collected automatically throughout the day' },
  { n: '02', title: 'Keyword match',  desc: 'Only posts matching your monitored phrases continue downstream' },
  { n: '03', title: 'Signal review',    desc: 'Each match is organized by category, confidence, and a short reason it deserves attention' },
  { n: '04', title: 'Feed & alert',   desc: 'Signal appears in your feed; IMMEDIATE alert rules fire by email' },
  { n: '05', title: 'Engage',         desc: 'Save, annotate, and act with AI-generated outreach suggestions' },
];

const FEATURES = [
  { icon: '◈', title: 'Broad Source Coverage',      desc: 'Track the places your buyers already talk so your team sees meaningful demand as it appears.' },
  { icon: '◎', title: 'Signal Classification',      desc: 'Every post is grouped into clear opportunity types with a confidence score for faster review.' },
  { icon: '◬', title: 'Instant Alert Rules',         desc: 'Set confidence thresholds, filter by category, and get email alerts the moment a matching signal appears.' },
  { icon: '◉', title: 'Pipeline Management',         desc: 'Save, bookmark, ignore, and annotate signals so your team can move from discovery to follow-up with less friction.' },
  { icon: '◫', title: 'Team Workspaces',             desc: 'Keep opportunities organized for your team with shared visibility and cleaner collaboration.' },
  { icon: '◐', title: 'Flexible for Growth',         desc: 'Start with a simple workflow today and expand your process as your team handles more demand.' },
];

const STATS = [
  { value: '30 min', label: 'scan interval' },
  { value: '0–100',  label: 'confidence score' },
  { value: '7',      label: 'signal categories' },
  { value: '∞',      label: 'sources per org' },
];

const PRICING = [
  {
    tier: 'Starter',
    price: '$29',
    note: 'per workspace / month',
    summary: 'For solo operators validating demand and testing source coverage.',
    features: ['3 sources', '25 tracked keywords', 'Opportunity feed', 'Basic email alerts'],
    featured: false,
  },
  {
    tier: 'Growth',
    price: '$99',
    note: 'per workspace / month',
    summary: 'For agencies and consultancies running a repeatable lead capture workflow.',
    features: ['15 sources', 'Unlimited keywords', 'Advanced alert rules', 'Team collaboration'],
    featured: true,
  },
  {
    tier: 'Scale',
    price: 'Custom',
    note: 'for larger teams',
    summary: 'For larger teams needing broader coverage, premium support, and a more tailored rollout.',
    features: ['Unlimited sources', 'Priority onboarding', 'Team access controls', 'Dedicated support'],
    featured: false,
  },
];

function TickerRow({ signal, visible }: { signal: typeof LIVE_SIGNALS[0]; visible: boolean }) {
  return (
    <tr style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(-10px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
    }}>
      <td style={{ padding: '9px 18px', color: signal.color, fontWeight: 500, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {signal.score}
      </td>
      <td style={{ padding: '9px 8px' }}>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap',
          color: signal.color, background: signal.color + '14', border: `1px solid ${signal.color}38`,
        }}>
          {signal.label.replace('_', ' ')}
        </span>
      </td>
      <td style={{ padding: '9px 8px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
        {signal.source}
      </td>
      <td style={{ padding: '9px 8px 9px 18px', fontSize: 12, color: '#94a3b8', overflow: 'hidden', maxWidth: 0, width: '100%' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{signal.text}</div>
      </td>
      <td style={{ padding: '9px 18px 9px 0', textAlign: 'right' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: signal.color, display: 'inline-block' }} />
      </td>
    </tr>
  );
}

export default function LandingPage() {
  const [tick, setTick] = useState(0);
  const [rowsVisible, setRowsVisible] = useState<boolean[]>([]);

  useEffect(() => {
    // stagger row reveals
    const timers: NodeJS.Timeout[] = [];
    LIVE_SIGNALS.slice(0, 6).forEach((_, i) => {
      timers.push(setTimeout(() => {
        setRowsVisible((prev) => { const next = [...prev]; next[i] = true; return next; });
      }, i * 100));
    });
    return () => timers.forEach(clearTimeout);
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => {
      setRowsVisible([]);
      setTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const signals = [...LIVE_SIGNALS.slice(tick % LIVE_SIGNALS.length), ...LIVE_SIGNALS].slice(0, 6);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          background: #070b12;
          color: #e2e8f0;
          font-family: var(--font-dm-mono), monospace;
          font-size: 14px;
          line-height: 1.6;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        @keyframes fadeUp   { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseDot { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        @keyframes scanDown { from { transform:translateY(-60px) } to { transform:translateY(360px) } }
        @keyframes borderGlow {
          0%,100% { border-color: rgba(34,211,238,0.15) }
          50%      { border-color: rgba(34,211,238,0.35) }
        }
      `}</style>

      {/* ─── NAV ─────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 58,
        background: 'rgba(7,11,18,0.88)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg,rgba(14,165,233,0.18),rgba(34,211,238,0.28))',
            border: '1px solid rgba(34,211,238,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#22d3ee',
          }}>◈</div>
          <span style={{ fontFamily: 'var(--font-syne), sans-serif', fontWeight: 700, fontSize: 15, color: '#e2e8f0', letterSpacing: -0.3 }}>
            IOS
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[['#how-it-works','How it works'],['#features','Features'],['#pricing','Pricing']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: '#64748b', textDecoration: 'none', fontSize: 13, padding: '6px 14px', borderRadius: 6, transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color='#e2e8f0')}
              onMouseLeave={e => (e.currentTarget.style.color='#64748b')}>
              {label}
            </a>
          ))}
          <Link href="/login" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, padding: '6px 14px', borderRadius: 6 }}>Sign in</Link>
          <Link href="/register" style={{
            background: 'linear-gradient(135deg,#0ea5e9,#22d3ee)', color: '#fff', textDecoration: 'none',
            fontSize: 13, fontWeight: 600, padding: '7px 18px', borderRadius: 7,
            fontFamily: 'var(--font-syne), sans-serif', transition: 'opacity 0.2s',
          }}>Get started →</Link>
        </div>
      </nav>

      {/* ─── HERO ─────────────────────────────────────────── */}
      <section style={{ minHeight: '100vh', paddingTop: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden', paddingLeft: 24, paddingRight: 24 }}>
        {/* grid bg */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(34,211,238,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.04) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%,black 30%,transparent 100%)',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%,black 30%,transparent 100%)',
        }} />
        {/* top glow */}
        <div style={{
          position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
          width: 900, height: 700, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at top,rgba(14,165,233,0.13) 0%,transparent 65%)',
        }} />

        {/* eyebrow */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.22)',
          borderRadius: 999, padding: '5px 14px 5px 8px',
          fontSize: 11, color: '#22d3ee', letterSpacing: '0.05em', marginBottom: 28,
          animation: 'fadeUp 0.6s ease both',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulseDot 2s infinite', display: 'inline-block' }} />
          Live signal scanning
        </div>

        {/* headline */}
        <h1 style={{
          fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(40px, 6.5vw, 76px)',
          fontWeight: 800, lineHeight: 1.04, letterSpacing: -2.5,
          textAlign: 'center', maxWidth: 820, animation: 'fadeUp 0.6s ease 0.08s both',
        }}>
          Find people{' '}
          <span style={{
            background: 'linear-gradient(135deg,#22d3ee,#0ea5e9,#38bdf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>asking to buy</span>
          <br />before your competitors do
        </h1>

        {/* sub */}
        <p style={{
          marginTop: 22, maxWidth: 520, textAlign: 'center', color: '#94a3b8',
          fontSize: 15, lineHeight: 1.75, animation: 'fadeUp 0.6s ease 0.18s both',
        }}>
          Internet Opportunity Scanner continuously monitors public conversations and surfaces
          high-confidence buying signals for B2B service providers.
        </p>

        {/* CTAs */}
        <div style={{ marginTop: 36, display: 'flex', gap: 12, alignItems: 'center', animation: 'fadeUp 0.6s ease 0.28s both' }}>
          <Link href="/register" style={{
            background: 'linear-gradient(135deg,#0ea5e9,#22d3ee)', color: '#fff', textDecoration: 'none',
            fontFamily: 'var(--font-syne), sans-serif', fontSize: 14, fontWeight: 600, padding: '12px 28px',
            borderRadius: 9, boxShadow: '0 0 36px rgba(14,165,233,0.35)', transition: 'transform 0.15s,box-shadow 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 10px 48px rgba(14,165,233,0.45)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow='0 0 36px rgba(14,165,233,0.35)'; }}
          >
            Start scanning free →
          </Link>
          <Link href="/login" style={{
            color: '#94a3b8', textDecoration: 'none', fontSize: 13,
            padding: '12px 22px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)',
            transition: 'color 0.2s,border-color 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#e2e8f0'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.22)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#94a3b8'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.12)'; }}
          >
            View demo workspace
          </Link>
        </div>

        {/* ── Live feed panel ── */}
        <div style={{
          marginTop: 60, width: '100%', maxWidth: 860,
          background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
          animation: 'fadeUp 0.7s ease 0.38s both', position: 'relative',
        }}>
          {/* scan line */}
          <div style={{ position: 'absolute', top: 42, left: 0, right: 0, pointerEvents: 'none', overflow: 'hidden', height: 340 }}>
            <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(34,211,238,0.35),transparent)', animation: 'scanDown 3.5s linear infinite' }} />
            <div style={{ height: 60, marginTop: -30, background: 'linear-gradient(180deg,transparent,rgba(34,211,238,0.03),transparent)', animation: 'scanDown 3.5s linear infinite' }} />
          </div>

          {/* titlebar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />)}
              <span style={{ fontSize: 11, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginLeft: 4 }}>opportunity-scanner — live feed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e', letterSpacing: '0.05em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulseDot 1.5s infinite', display: 'inline-block' }} />
              SCANNING
            </div>
          </div>

          {/* table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 60 }} />
              <col style={{ width: 148 }} />
              <col style={{ width: 118 }} />
              <col />
              <col style={{ width: 36 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['SCORE','CATEGORY','SOURCE','SIGNAL',''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 18px', fontSize: 10, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 400, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((sig, i) => (
                <TickerRow key={`${tick}-${i}`} signal={sig} visible={!!rowsVisible[i]} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── STATS BAR ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{
            flex: 1, maxWidth: 200, padding: '22px 24px', textAlign: 'center',
            borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
          }}>
            <div style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 30, fontWeight: 800, letterSpacing: -1.2, color: '#e2e8f0' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── HOW IT WORKS ─────────────────────────────────── */}
      <div id="how-it-works" style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 40px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 14 }}>// how it works</div>
        <h2 style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: -1.2, marginBottom: 12 }}>
          From raw post to qualified lead<br />in under a minute
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 15, maxWidth: 480, lineHeight: 1.75 }}>
          The process runs quietly in the background. You just check your feed.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 0, marginTop: 60, position: 'relative' }}>
          {/* connector line */}
          <div style={{ position: 'absolute', top: 27, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),rgba(255,255,255,0.1),transparent)' }} />
          {STEPS.map((s) => (
            <div key={s.n} style={{ textAlign: 'center', padding: '0 14px' }}>
              <div style={{
                width: 54, height: 54, borderRadius: 13, margin: '0 auto 16px',
                background: '#111927', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-syne), sans-serif', fontSize: 17, fontWeight: 800, color: '#22d3ee',
                position: 'relative', zIndex: 1,
              }}>{s.n}</div>
              <div style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── FEATURES ─────────────────────────────────────── */}
      <div id="features" style={{ background: 'linear-gradient(180deg,#070b12 0%,#0d1420 100%)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 40px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 14 }}>// capabilities</div>
          <h2 style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: -1.2, marginBottom: 12 }}>
            Everything a B2B service firm<br />needs to hunt leads at scale
          </h2>

          {/* features grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', marginTop: 52 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: '#070b12', padding: '28px 26px', transition: 'background 0.2s', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget.style.background='#111927')}
                onMouseLeave={e => (e.currentTarget.style.background='#070b12')}
              >
                <span style={{ fontSize: 22, color: '#22d3ee', marginBottom: 14, display: 'block', fontFamily: 'var(--font-dm-mono), monospace' }}>{f.icon}</span>
                <div style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.75 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── PRICING ─────────────────────────────────────── */}
      <div id="pricing" style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 40px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#22d3ee', marginBottom: 14 }}>// pricing</div>
        <h2 style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: -1.2, marginBottom: 12 }}>
          Simple plans for teams<br />tracking buyer intent
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 15, maxWidth: 560, lineHeight: 1.75 }}>
          Start small, scale source coverage as your workflow matures, and move to a custom setup when your team needs deeper support.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden', marginTop: 52 }}>
          {PRICING.map((plan) => (
            <div
              key={plan.tier}
              style={{
                background: plan.featured ? 'linear-gradient(180deg,rgba(14,165,233,0.10) 0%,#0d1420 26%,#070b12 100%)' : '#070b12',
                padding: '30px 28px',
                position: 'relative',
                borderTop: plan.featured ? '1px solid rgba(34,211,238,0.35)' : '1px solid transparent',
              }}
            >
              {plan.featured && (
                <div style={{
                  position: 'absolute', top: 16, right: 16,
                  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#22d3ee', padding: '5px 9px',
                  borderRadius: 999, background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)',
                }}>
                  Most popular
                </div>
              )}

              <div style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                {plan.tier}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: -1.4, color: '#e2e8f0' }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {plan.note}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8, minHeight: 72 }}>
                {plan.summary}
              </p>

              <div style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#cbd5e1', fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: plan.featured ? '#22d3ee' : '#475569', display: 'inline-block', flexShrink: 0 }} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Link href="/register" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 22, width: '100%',
                background: plan.featured ? 'linear-gradient(135deg,#0ea5e9,#22d3ee)' : 'transparent',
                color: '#fff', textDecoration: 'none',
                border: plan.featured ? 'none' : '1px solid rgba(255,255,255,0.12)',
                fontFamily: 'var(--font-syne), sans-serif', fontSize: 13, fontWeight: 600,
                padding: '12px 18px', borderRadius: 10,
              }}>
                {plan.price === 'Custom' ? 'Talk to us' : 'Start with ' + plan.tier}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ─── CTA SECTION ──────────────────────────────────── */}
      <div style={{ padding: '80px 40px 120px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: -100, left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, pointerEvents: 'none', background: 'radial-gradient(ellipse,rgba(14,165,233,0.10) 0%,transparent 65%)' }} />
        <div style={{
          maxWidth: 660, margin: '0 auto',
          background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '56px 48px', position: 'relative', overflow: 'hidden',
          animation: 'borderGlow 4s ease infinite',
        }}>
          {/* top line accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(34,211,238,0.55),transparent)' }} />

          <h2 style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, letterSpacing: -1.2, marginBottom: 14 }}>
            Ready to stop missing<br />inbound intent?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.8, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
            Set up in 10 minutes. Add your keywords, connect your first sources, and let the scanner run.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/register" style={{
              background: 'linear-gradient(135deg,#0ea5e9,#22d3ee)', color: '#fff', textDecoration: 'none',
              fontFamily: 'var(--font-syne), sans-serif', fontSize: 14, fontWeight: 600, padding: '12px 28px',
              borderRadius: 9, boxShadow: '0 0 36px rgba(14,165,233,0.3)',
            }}>
              Create free workspace →
            </Link>
            <Link href="/login" style={{
              color: '#94a3b8', textDecoration: 'none', fontSize: 13,
              padding: '12px 22px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)',
            }}>
              Log into demo
            </Link>
          </div>
        </div>
      </div>

      {/* ─── FOOTER ───────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '22px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#475569' }}>© 2026 Internet Opportunity Scanner. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[['#features','Features'],['#pricing','Pricing'],['/login','Sign in']].map(([href, label]) => (
            <a key={label} href={href} style={{ fontSize: 12, color: '#475569', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color='#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.color='#475569')}>
              {label}
            </a>
          ))}
        </div>
      </footer>
    </>
  );
}
