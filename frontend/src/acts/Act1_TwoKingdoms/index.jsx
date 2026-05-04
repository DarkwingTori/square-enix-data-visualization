import { useRef, useState } from 'react';
import { useDimensions } from '../../hooks/useDimensions';
import { useD3 } from '../../hooks/useD3';
import ScrollSection from '../../components/ScrollSection';
import StepText from '../../components/StepText';
import CatalogStats from './CatalogStats';
import { init as donutInit, update as donutUpdate } from './GenreDonut.d3';
import { init as barInit, update as barUpdate } from './TopGamesBar.d3';

const STEPS = [
  { eyebrow: 'ACT I', headline: 'Two Kingdoms', body: 'Before there was Square Enix, there were two separate companies with two very different visions. Squaresoft: cinematic, ambitious, PlayStation-bound. Enix: deep RPG roots, fiercely Nintendo-loyal. Neither needed the other — until they did.' },
  { eyebrow: 'GENRE DNA', headline: 'RPG vs. Everything', body: 'Squaresoft\'s catalog was dominated by RPGs — Final Fantasy, Chrono Trigger, Secret of Mana. Enix was more diverse: puzzle games, Dragon Quest, and a string of Nintendo exclusives. The donuts show exactly how different their DNA was.' },
  { eyebrow: 'BY THE NUMBERS', headline: 'Genre Breakdown', body: 'Squaresoft put roughly 65% of its releases into Role-Playing. Enix split more evenly across RPG, Puzzle, and Action-Adventure. Two companies, two philosophies — one future company.' },
  { eyebrow: 'BEST SELLERS', headline: 'Top Titles by Sales', body: 'Final Fantasy dominated Squaresoft\'s output commercially. For Enix, Dragon Quest\'s early NES entries remain its best-performing titles to this day — Japan treated each new entry like a national holiday.' },
];

export default function Act1({ statsData }) {
  const [step, setStep] = useState(0);

  // Chart A: Genre donuts (steps 1-2)
  const donutRef = useRef(null);
  const donutDims = useDimensions(donutRef);
  const { svgRef: donutSvg } = useD3(donutInit, donutUpdate, {
    data: statsData,
    dims: donutDims,
    step,
  });

  // Chart B: Top games bar (step 3)
  const barRef = useRef(null);
  const barDims = useDimensions(barRef);
  const { svgRef: barSvg } = useD3(barInit, barUpdate, {
    data: statsData,
    dims: barDims,
    step,
  });

  // Show one chart at a time based on step
  const showStats = step === 0;
  const showDonut = step === 1 || step === 2;
  const showBar   = step === 3;

  const chartEl = (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Stat cards */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: showStats ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showStats ? 'auto' : 'none',
      }}>
        <CatalogStats stats={statsData} visible={step >= 0} />
      </div>

      {/* Genre donuts */}
      <div ref={donutRef} style={{
        position: 'absolute', inset: 0,
        opacity: showDonut ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showDonut ? 'auto' : 'none',
      }}>
        <svg ref={donutSvg} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Top games bar */}
      <div ref={barRef} style={{
        position: 'absolute', inset: 0,
        opacity: showBar ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showBar ? 'auto' : 'none',
      }}>
        <svg ref={barSvg} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );

  return (
    <ScrollSection
      id="act1"
      actLabel="ACT I — THE TWO KINGDOMS"
      onStep={setStep}
      steps={STEPS.map((s, i) => <StepText key={i} {...s} />)}
    >
      {chartEl}
    </ScrollSection>
  );
}
