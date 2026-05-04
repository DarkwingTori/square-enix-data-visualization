import { useRef, useState, useMemo } from 'react';
import { useDimensions } from '../../hooks/useDimensions';
import { useD3 } from '../../hooks/useD3';
import { franchisePlatformHistory } from '../../data/transforms';
import StepText from '../../components/StepText';
import { init as trajInit, update as trajUpdate } from './SalesTrajectory.d3';
import { init as platInit, update as platUpdate } from './PlatformHistory.d3';

const FRANCHISE_LIST = [
  'Final Fantasy', 'Dragon Quest', 'Kingdom Hearts',
  'Drakengard / Nier', 'Tomb Raider', 'Chrono',
];

const FRANCHISE_COLORS_PILL = {
  'Final Fantasy':     '#c9a84c',
  'Dragon Quest':      '#4a7cc9',
  'Kingdom Hearts':    '#9b6abf',
  'Drakengard / Nier': '#8d9a7b',
  'Tomb Raider':       '#a04a4a',
  'Chrono':            '#3498db',
};

const FRANCHISE_CONFIG = {
  'Final Fantasy':     { topGamesKey: 'Final Fantasy',  csvSeries: ['Final Fantasy'] },
  'Dragon Quest':      { topGamesKey: 'Dragon Quest',   csvSeries: ['Dragon Quest'] },
  'Kingdom Hearts':    { topGamesKey: 'Kingdom Hearts', csvSeries: ['Kingdom Hearts'] },
  'Drakengard / Nier': { topGamesKey: 'Nier',           csvSeries: ['NieR', 'Drakengard'] },
  'Tomb Raider':       { topGamesKey: 'Tomb Raider',    csvSeries: ['Tomb Raider'] },
  'Chrono':            { topGamesKey: 'Chrono',         csvSeries: ['Chrono'] },
};

const STEPS = [
  { eyebrow: 'ACT V', headline: 'Franchise Deep Dives', body: 'Select a franchise above. Every chart updates to show its sales trajectory, critic score arc, and platform history. See where Final Fantasy peaked. See why Dragon Quest never fully left Nintendo.' },
  { eyebrow: 'SALES + CRITIC', headline: 'The Trajectory', body: 'The solid line is global sales per entry. The dashed line is average critic score. For Final Fantasy around FF XIII — the divergence between commercial and critical reception is instructive.' },
  { eyebrow: 'PLATFORM BARS', headline: 'Where They Lived', body: 'Each row is a franchise entry. The colored bars show which platform families it launched on. Final Fantasy\'s PlayStation tilt vs. Dragon Quest\'s Nintendo alignment is immediately visible.' },
  { eyebrow: 'THE CONTRAST', headline: 'Two Different Bets', body: 'Square bet on PlayStation cinematic spectacle. Enix (and post-merger Dragon Quest) bet on Nintendo portability and Japanese fandom. Both won — on different terms.' },
];

export default function Act5({ rawTitles, rawRows }) {
  const [step, setStep] = useState(0);
  const [selectedFranchise, setSelectedFranchise] = useState('Final Fantasy');

  const historyData = useMemo(() => {
    if (!rawRows) return [];
    return franchisePlatformHistory(rawRows, selectedFranchise);
  }, [rawRows, selectedFranchise]);

  const trajData = useMemo(() => {
    const cfg = FRANCHISE_CONFIG[selectedFranchise] || { topGamesKey: selectedFranchise, csvSeries: [selectedFranchise] };
    return {
      franchise:    selectedFranchise,
      topGamesKey:  cfg.topGamesKey,
      titles:       (rawTitles || []).filter(t => cfg.csvSeries.includes(t.series)),
    };
  }, [selectedFranchise, rawTitles]);

  const showTraj = step <= 1;
  const showPlat = step >= 2;

  const trajRef = useRef(null);
  const trajDims = useDimensions(trajRef);
  const { svgRef: trajSvg } = useD3(trajInit, trajUpdate, { data: trajData, dims: trajDims, step });

  const platRef = useRef(null);
  const platDims = useDimensions(platRef);
  const { svgRef: platSvg } = useD3(platInit, platUpdate, { data: historyData, dims: platDims, step });

  return (
    <section id="act5" className="act-container">
      <div className="act-sticky" style={{ padding: '10px 16px 14px' }}>
        {/* Franchise selector */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 6 }}>
            ACT V — FRANCHISE DEEP DIVES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {FRANCHISE_LIST.map(f => {
              const color = FRANCHISE_COLORS_PILL[f] || '#888';
              const active = f === selectedFranchise;
              return (
                <button
                  key={f}
                  onClick={() => setSelectedFranchise(f)}
                  style={{
                    fontSize: 9, letterSpacing: '0.04em', padding: '4px 9px',
                    borderRadius: 12,
                    border: `1px solid ${active ? color : `${color}44`}`,
                    color: active ? '#000' : color,
                    background: active ? color : 'transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {/* Charts */}
        <div style={{ flex: 1, minHeight: 0, background: 'radial-gradient(ellipse at center, #0f0f1e 0%, var(--bg-void) 100%)', borderRadius: 8, border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
          <div ref={trajRef} style={{
            position: 'absolute', inset: 0,
            opacity: showTraj ? 1 : 0,
            transition: 'opacity 0.4s ease',
            pointerEvents: showTraj ? 'auto' : 'none',
          }}>
            <svg ref={trajSvg} style={{ width: '100%', height: '100%' }} />
          </div>
          <div ref={platRef} style={{
            position: 'absolute', inset: 0,
            opacity: showPlat ? 1 : 0,
            transition: 'opacity 0.4s ease',
            pointerEvents: showPlat ? 'auto' : 'none',
          }}>
            <svg ref={platSvg} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      </div>

      <div className="act-steps">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className="scroll-step"
            ref={el => {
              if (!el) return;
              const io = new IntersectionObserver(
                ([entry]) => { if (entry.isIntersecting) setStep(i); },
                { threshold: 0.5 }
              );
              io.observe(el);
            }}
          >
            <StepText {...s} />
          </div>
        ))}
      </div>
    </section>
  );
}
