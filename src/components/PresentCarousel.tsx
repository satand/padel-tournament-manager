'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MVPStandingRow, RankingRow } from '@/lib/domain/types';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { PresentAutoRefresh } from '@/components/PresentAutoRefresh';

export type PresentSlide =
  | { kind: 'group'; id: string; title: string; rows: RankingRow[] }
  | { kind: 'standings'; id: string; title: string; rows: RankingRow[] }
  | { kind: 'mvp'; id: string; title: string; subtitle?: string; rows: MVPStandingRow[] }
  | { kind: 'champion'; id: string; title: string; champion: string; silver?: string }
  | {
      kind: 'match';
      id: string;
      title: string;
      phaseLabel: string;
      bracketLabel?: string;
      teamA: string;
      teamB: string;
      score: string;
      statusLabel: string;
      done: boolean;
      winnerName?: string;
      court?: string;
      when: string;
    };

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
    case 'group':
    case 'standings':
      return (
        <div>
          <SlideTitle>{slide.title}</SlideTitle>
          {slide.rows.length > 0 ? <LightPanel><RankingTable rows={slide.rows} /></LightPanel> : <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 18 }}>Nessuna squadra.</p>}
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
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(60px, 12vw, 160px)', lineHeight: 1 }}>🏆</div>
          <div style={{ fontSize: 'clamp(16px, 2vw, 26px)', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '.1em' }}>Campione</div>
          <div style={{ fontSize: 'clamp(30px, 6vw, 76px)', fontWeight: 900, margin: '10px 0' }}>{slide.champion}</div>
          {slide.silver && <div style={{ fontSize: 'clamp(16px, 2.2vw, 28px)', color: '#cbd5e1' }}>🥈 {slide.silver}</div>}
        </div>
      );
    case 'match':
      return <MatchSlide slide={slide} />;
    default:
      return null;
  }
}

function LightPanel({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#f8fafc', color: '#0f172a', borderRadius: 16, padding: 'clamp(10px, 1.5vw, 20px)' }}>{children}</div>;
}

function MatchSlide({ slide }: { slide: PresentSlide & { kind: 'match' } }) {
  const aWins = !!slide.winnerName && slide.winnerName === slide.teamA;
  const bWins = !!slide.winnerName && slide.winnerName === slide.teamB;
  const bracket = slide.bracketLabel ? `${slide.bracketLabel} · ` : '';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: 'clamp(14px, 1.8vw, 22px)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {bracket}{slide.phaseLabel}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 'clamp(8px, 2vw, 24px)', margin: 'clamp(14px, 3vh, 34px) 0' }}>
        <Team name={slide.teamA} win={aWins} align="right" />
        <div style={{ fontSize: 'clamp(16px, 2.4vw, 30px)', color: '#64748b', fontWeight: 800 }}>VS</div>
        <Team name={slide.teamB} win={bWins} align="left" />
      </div>
      {slide.score && (
        <div style={{ display: 'inline-block', fontSize: 'clamp(28px, 6vw, 64px)', fontWeight: 900, background: '#1e293b', padding: '6px 26px', borderRadius: 16, letterSpacing: '.04em' }}>{slide.score}</div>
      )}
      <div style={{ color: '#cbd5e1', fontSize: 'clamp(14px, 1.8vw, 22px)', marginTop: 'clamp(10px, 2vh, 20px)', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: slide.done ? '#4ade80' : '#fbbf24', fontWeight: 800 }}>{slide.statusLabel}</span>
        <span>{slide.when}</span>
        {slide.court && <span>{slide.court}</span>}
      </div>
    </div>
  );
}

function Team({ name, win, align }: { name: string; win: boolean; align: 'left' | 'right' }) {
  return (
    <div style={{ textAlign: align, fontWeight: win ? 900 : 700, fontSize: 'clamp(20px, 4vw, 52px)', color: win ? '#4ade80' : '#f8fafc', wordBreak: 'break-word', lineHeight: 1.05 }}>
      {win ? '🏅 ' : ''}{name}
    </div>
  );
}
