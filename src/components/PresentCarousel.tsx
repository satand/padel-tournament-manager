'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MVPStandingRow, RankingRow } from '@/lib/domain/types';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { PresentAutoRefresh } from '@/components/PresentAutoRefresh';

export type BracketMatch = {
  id: string;
  teamA: string | null;
  teamB: string | null;
  sets: string[];
  winner: 'A' | 'B' | null;
  done: boolean;
};
export type BracketColumn = { roundLabel: string; matches: BracketMatch[] };
export type ChampionWinner = { rank: number; label: string; team: string; tone: 'gold' | 'silver' };

export type PresentSlide =
  | { kind: 'standings'; id: string; title: string; rows: RankingRow[]; phaseReached?: Map<string, string> }
  | { kind: 'groups'; id: string; title: string; groups: { name: string; rows: RankingRow[] }[] }
  | { kind: 'mvp'; id: string; title: string; subtitle?: string; rows: MVPStandingRow[] }
  | { kind: 'champion'; id: string; title: string; winners: ChampionWinner[] }
  | { kind: 'bracket'; id: string; title: string; columns: BracketColumn[] };

export type PresentScreen = { id: string; label: string; slides: PresentSlide[] };

type Props = {
  name: string;
  screens: PresentScreen[];
  slideMs: number;
  defaultScreenId?: string;
};

export function PresentCarousel({ name, screens, slideMs, defaultScreenId }: Props) {
  const initialScreen = useMemo(() => {
    const idx = screens.findIndex((s) => s.id === defaultScreenId);
    return idx >= 0 ? idx : 0;
  }, [screens, defaultScreenId]);

  const [screenIdx, setScreenIdx] = useState(initialScreen);
  const [slideIdx, setSlideIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [isFull, setIsFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const screen = screens[Math.min(screenIdx, Math.max(0, screens.length - 1))];
  const slides = screen?.slides ?? [];
  const safeIdx = slides.length ? Math.min(slideIdx, slides.length - 1) : 0;
  const slide = slides[safeIdx];

  useEffect(() => {
    if (!playing || slides.length <= 1) return;
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % slides.length), slideMs);
    return () => clearInterval(t);
  }, [playing, slideMs, slides.length, safeIdx]);

  const selectScreen = useCallback((i: number) => {
    setScreenIdx(i);
    setSlideIdx(0);
  }, []);

  const go = useCallback((dir: number) => {
    setSlideIdx((i) => (slides.length ? (i + dir + slides.length) % slides.length : 0));
  }, [slides.length]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFullscreen]);

  return (
    <div
      ref={rootRef}
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        color: '#f8fafc',
        padding: 'clamp(12px, 2vw, 28px)',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PRESENT_CSS }} />
      <PresentAutoRefresh intervalMs={20000} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ background: '#14b8a6', color: '#042f2e', fontWeight: 800, fontSize: 12, padding: '4px 10px', borderRadius: 999 }}>PROIEZIONE</span>
          <strong style={{ fontSize: 'clamp(16px, 2.4vw, 26px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '46vw' }}>{name}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            aria-label="Schermata"
            value={String(Math.min(screenIdx, Math.max(0, screens.length - 1)))}
            onChange={(e) => selectScreen(Number(e.target.value))}
            style={{ fontSize: 'clamp(14px, 1.6vw, 18px)', padding: '8px 10px', borderRadius: 12, border: '1px solid #334155', background: '#1e293b', color: '#f8fafc' }}
          >
            {screens.map((s, i) => <option key={s.id} value={String(i)}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Slide */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(8px, 2vh, 28px) 0' }}>
        <div style={{ width: '100%', maxWidth: 1200, maxHeight: '100%', overflow: 'auto' }}>
          {renderSlide(slide)}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap', paddingTop: 6 }}>
        <ControlBtn onClick={() => go(-1)} disabled={slides.length <= 1} label="Precedente">‹</ControlBtn>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {slides.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Vai alla slide ${i + 1}`}
              onClick={() => setSlideIdx(i)}
              style={{ width: i === safeIdx ? 26 : 10, height: 10, borderRadius: 999, border: 'none', cursor: 'pointer', background: i === safeIdx ? '#14b8a6' : '#475569', transition: 'width .2s' }}
            />
          ))}
        </div>

        <ControlBtn onClick={() => go(1)} disabled={slides.length <= 1} label="Successiva">›</ControlBtn>
        <ControlBtn onClick={() => setPlaying((p) => !p)} label={playing ? 'Pausa' : 'Play'}>{playing ? '⏸' : '▶'}</ControlBtn>
        <ControlBtn onClick={toggleFullscreen} label="Schermo intero">{isFull ? '🗗' : '⛶'}</ControlBtn>
        <span style={{ color: '#94a3b8', fontSize: 13, minWidth: 56, textAlign: 'center' }}>
          {slides.length ? `${safeIdx + 1}/${slides.length}` : '0/0'}
        </span>
      </div>
    </div>
  );
}

function ControlBtn({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{ fontSize: 18, minWidth: 40, height: 40, borderRadius: 12, border: '1px solid #334155', background: '#1e293b', color: '#f8fafc', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, lineHeight: 1 }}
    >
      {children}
    </button>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: '0 0 clamp(10px, 2vh, 22px)', fontSize: 'clamp(22px, 3.4vw, 40px)', textAlign: 'center', letterSpacing: '-0.02em' }}>{children}</h2>;
}

function renderSlide(slide?: PresentSlide) {
  if (!slide) {
    return <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 22 }}>Nessun dato da proiettare.</p>;
  }
  switch (slide.kind) {
    case 'standings':
      return (
        <div>
          <SlideTitle>{slide.title}</SlideTitle>
          {slide.rows.length > 0 ? <LightPanel><RankingTable rows={slide.rows} phaseReached={slide.phaseReached} /></LightPanel> : <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 18 }}>Nessuna squadra.</p>}
        </div>
      );
    case 'groups':
      return (
        <div>
          <SlideTitle>{slide.title}</SlideTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'clamp(12px, 1.5vw, 20px)' }}>
            {slide.groups.map((g) => (
              <LightPanel key={g.name}>
                <RankingTable rows={g.rows} />
              </LightPanel>
            ))}
          </div>
        </div>
      );
    case 'mvp':
      return (
        <div>
          <SlideTitle>{slide.title}{slide.subtitle ? <span style={{ fontSize: '0.5em', fontWeight: 400, color: '#cbd5e1' }}> {slide.subtitle}</span> : ''}</SlideTitle>
          {slide.rows.length > 0 ? <LightPanel><MVPTable rows={slide.rows} /></LightPanel> : <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 18 }}>Nessun dato MVP.</p>}
        </div>
      );
    case 'champion':
      return <ChampionSlide slide={slide} />;
    case 'bracket':
      return <BracketView columns={slide.columns} title={slide.title} />;
    default:
      return null;
  }
}

function LightPanel({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#f8fafc', color: '#0f172a', borderRadius: 16, padding: 'clamp(10px, 1.5vw, 20px)' }}>{children}</div>;
}

function ChampionSlide({ slide }: { slide: PresentSlide & { kind: 'champion' } }) {
  return (
    <div style={{ position: 'relative', textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Fireworks />
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 'clamp(40px, 8vw, 110px)', lineHeight: 1 }}>🏆</div>
        <div style={{ fontSize: 'clamp(16px, 2vw, 26px)', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '.12em' }}>
          {slide.title}
        </div>
        <div style={{ display: 'flex', gap: 'clamp(16px, 4vw, 56px)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'clamp(16px, 3vh, 34px)' }}>
          {slide.winners.map((w) => <MedalBox key={w.label} winner={w} />)}
        </div>
      </div>
    </div>
  );
}

function MedalBox({ winner }: { winner: ChampionWinner }) {
  const gold = winner.tone === 'gold';
  const accent = gold ? '#fcd34d' : '#cbd5e1';
  return (
    <div
      style={{
        position: 'relative',
        minWidth: 'clamp(220px, 30vw, 360px)',
        padding: 'clamp(18px, 2.6vw, 34px)',
        borderRadius: 22,
        background: gold ? 'linear-gradient(160deg,#3a2f10,#1e293b)' : 'linear-gradient(160deg,#243043,#1e293b)',
        border: `2px solid ${accent}`,
        boxShadow: `0 0 40px ${gold ? 'rgba(252,211,77,.35)' : 'rgba(203,213,225,.25)'}`
      }}
    >
      <MedalDisc tone={winner.tone} number={winner.rank} />
      <div style={{ fontSize: 'clamp(13px, 1.6vw, 18px)', color: accent, textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 10 }}>{winner.label}</div>
      <div style={{ fontSize: 'clamp(24px, 4vw, 48px)', fontWeight: 900, marginTop: 4, color: '#f8fafc', wordBreak: 'break-word' }}>{winner.team}</div>
    </div>
  );
}

function MedalDisc({ tone, number }: { tone: 'gold' | 'silver'; number: number }) {
  const gold = tone === 'gold';
  const size = 'clamp(80px, 10vw, 128px)';
  const discBg = gold
    ? 'radial-gradient(circle at 35% 28%, #fff6bf 0%, #fcd34d 34%, #d97706 70%, #92400e 100%)'
    : 'radial-gradient(circle at 35% 28%, #ffffff 0%, #e2e8f0 34%, #94a3b8 70%, #475569 100%)';
  const ring = gold ? '#b45309' : '#64748b';
  const numColor = gold ? '#7c2d12' : '#1e293b';
  const glow = gold ? 'rgba(252,211,77,.5)' : 'rgba(203,213,225,.4)';
  const ribbonA = gold ? '#ef4444' : '#3b82f6';
  const ribbonB = gold ? '#991b1b' : '#1e3a8a';
  const ribbon = (deg: number): React.CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: '50%',
    width: '30%',
    height: '54%',
    background: `linear-gradient(180deg, ${ribbonA}, ${ribbonB})`,
    transform: `translateX(-50%) rotate(${deg}deg)`,
    transformOrigin: 'top center',
    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%)',
    boxShadow: '0 2px 4px rgba(0,0,0,.3)',
    zIndex: 1
  });
  return (
    <div style={{ position: 'relative', width: size, height: `calc(${size} + 26px)`, margin: '0 auto' }}>
      <span style={ribbon(-18)} />
      <span style={ribbon(18)} />
      <div
        className={`medal medal--${tone}`}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: size,
          height: size,
          borderRadius: '50%',
          background: discBg,
          border: `4px solid ${ring}`,
          boxShadow: `0 0 30px ${glow}, inset 0 2px 6px rgba(255,255,255,.55), inset 0 -6px 10px rgba(0,0,0,.28)`,
          display: 'grid',
          placeItems: 'center',
          zIndex: 2
        }}
      >
        <span style={{ fontSize: 'clamp(30px, 4.6vw, 58px)', fontWeight: 900, color: numColor, textShadow: '0 1px 0 rgba(255,255,255,.35)', lineHeight: 1 }}>{number}</span>
      </div>
    </div>
  );
}

const FIREWORKS = [
  { left: '18%', top: '22%', color: '#fcd34d', delay: '0s' },
  { left: '82%', top: '28%', color: '#2dd4bf', delay: '0.6s' },
  { left: '30%', top: '58%', color: '#fb7185', delay: '1.2s' },
  { left: '68%', top: '62%', color: '#cbd5e1', delay: '0.9s' },
  { left: '50%', top: '16%', color: '#a78bfa', delay: '1.7s' },
  { left: '12%', top: '70%', color: '#f97316', delay: '2.1s' },
  { left: '88%', top: '72%', color: '#fcd34d', delay: '1.4s' }
];
const PARTICLES = '0 -16px, 0 16px, -16px 0, 16px 0, 11px -11px, -11px 11px, 11px 11px, -11px -11px'
  .split(', ')
  .map((o) => `${o} 0 2px currentColor`)
  .join(', ');

function Fireworks() {
  return (
    <div className="fw" aria-hidden>
      {FIREWORKS.map((f, i) => (
        <span
          key={i}
          className="fw-b"
          style={{ left: f.left, top: f.top, color: f.color, background: f.color, boxShadow: PARTICLES, animationDelay: f.delay }}
        />
      ))}
    </div>
  );
}

const CARD_H = 86;
const GAP_Y = 16;
const PAD = 0.22;

function BracketView({ columns, title }: { columns: BracketColumn[]; title: string }) {
  const nC = columns.length;
  const maxN = Math.max(1, ...columns.map((c) => c.matches.length));
  const height = maxN * (CARD_H + GAP_Y) - GAP_Y;
  const colPct = 100 / nC;
  const gapPct = PAD * colPct;

  const connectors: React.ReactNode[] = [];
  for (let ci = 0; ci < nC - 1; ci++) {
    const nr = columns[ci].matches.length;
    const nr2 = columns[ci + 1].matches.length;
    const boundary = ((ci + 1) * colPct).toFixed(4);
    const stubLeft = ((ci + 1 - PAD) * colPct).toFixed(4);
    for (let j = 0; j < nr2; j++) {
      const a = 2 * j;
      const b = 2 * j + 1;
      if (a >= nr) continue;
      const cA = ((a + 0.5) / nr) * height;
      const cB = b < nr ? ((b + 0.5) / nr) * height : cA;
      const cN = ((j + 0.5) / nr2) * height;
      connectors.push(
        <span key={`va-${ci}-${j}`} className="br-line" style={{ left: `calc(${boundary}% - 1.5px)`, top: cA, height: Math.max(0, cB - cA) }} />,
        <span key={`ha-${ci}-${j}`} className="br-line-h" style={{ left: `${stubLeft}%`, top: cA - 1.5, width: `${gapPct.toFixed(4)}%` }} />,
        <span key={`hb-${ci}-${j}`} className="br-line-h" style={{ left: `${stubLeft}%`, top: cB - 1.5, width: `${gapPct.toFixed(4)}%` }} />,
        <span key={`hn-${ci}-${j}`} className="br-line-h" style={{ left: `${boundary}%`, top: cN - 1.5, width: `${gapPct.toFixed(4)}%` }} />
      );
    }
  }

  return (
    <div>
      <SlideTitle>{title}</SlideTitle>
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ minWidth: nC * 230 }}>
          <div style={{ display: 'flex' }}>
            {columns.map((c, ci) => (
              <div key={`h-${ci}`} style={{ flex: 1, textAlign: 'center', color: '#94a3b8', fontSize: 'clamp(11px, 1.2vw, 15px)', textTransform: 'uppercase', letterSpacing: '.06em', paddingBottom: 8 }}>
                {c.roundLabel}
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', height }}>
            {connectors}
            {columns.map((c, ci) => {
              const nr = c.matches.length;
              return c.matches.map((m, j) => {
                const center = ((j + 0.5) / nr) * height;
                return (
                  <div
                    key={m.id}
                    style={{
                      position: 'absolute',
                      left: `${((ci + PAD) * colPct).toFixed(4)}%`,
                      width: `${((1 - 2 * PAD) * colPct).toFixed(4)}%`,
                      top: center - CARD_H / 2,
                      height: CARD_H
                    }}
                  >
                    <MatchCard m={m} />
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ m }: { m: BracketMatch }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '5px 8px', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <BracketTeam name={m.teamA} win={m.winner === 'A'} />
        <BracketTeam name={m.teamB} win={m.winner === 'B'} />
      </div>
      {m.sets.length ? (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right', fontWeight: 800, color: '#fbbf24', fontSize: 'clamp(12px, 1.5vw, 17px)', letterSpacing: '.02em' }}>
          {m.sets.map((s, i) => <span key={i}>{s}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function BracketTeam({ name, win }: { name: string | null; win: boolean }) {
  const label = name ?? 'in attesa';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: win ? 900 : 600, fontSize: 'clamp(12px, 1.4vw, 17px)', color: win ? '#4ade80' : name ? '#f8fafc' : '#64748b', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
      <span style={{ width: 14, flexShrink: 0 }}>{win ? '🏅' : ''}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  );
}

const PRESENT_CSS = `
.fw{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.fw-b{position:absolute;width:5px;height:5px;border-radius:50%;opacity:0;transform:scale(.1);animation:fw-burst 2.6s ease-out infinite}
@keyframes fw-burst{0%{transform:scale(.1);opacity:0}12%{opacity:1}70%{opacity:.9}100%{transform:scale(13);opacity:0}}
.br-line{position:absolute;width:3px;background:#7c8aa5;border-radius:2px}
.br-line-h{position:absolute;height:3px;background:#7c8aa5;border-radius:2px}
@media (prefers-reduced-motion: reduce){.fw-b{animation-duration:6s;animation-iteration-count:2}}
`;
