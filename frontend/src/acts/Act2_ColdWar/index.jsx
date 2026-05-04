import { useRef, useState } from 'react';
import { useDimensions } from '../../hooks/useDimensions';
import { useD3 } from '../../hooks/useD3';
import ScrollSection from '../../components/ScrollSection';
import StepText from '../../components/StepText';
import { init as cwInit, update as cwUpdate } from './ColdWarTimeline.d3';
import { init as exInit, update as exUpdate } from './ExclusivityBar.d3';

const STEPS = [
  { eyebrow: 'ACT II', headline: 'The Nintendo Cold War', body: '1997. Square chose PlayStation for Final Fantasy VII. Nintendo took it personally. What followed was five years of zero Square releases on any Nintendo platform — a corporate cold war with real consequences for fans.' },
  { eyebrow: '1987 — 2005', headline: 'The Dot Timeline', body: 'Each dot is a game. Nintendo on top. PlayStation on the bottom. Watch the Nintendo row go silent from 1997 to 2002 while PlayStation floods with FF VII, FF VIII, FF IX, Vagrant Story, and Chrono Cross.' },
  { eyebrow: '1997 — 2002', headline: 'Five Years of Nothing', body: 'The red band marks the cold war years. Not a single Square release on Nintendo hardware. That gap — visually stark — is the most dramatic moment in JRPG history.' },
  { eyebrow: 'EXCLUSIVITY', headline: 'How Strategy Shifted', body: 'Squaresoft was nearly 100% exclusive pre-defection. Square Enix post-merger trended heavily multiplatform. The stacked bars show exactly how the exclusivity strategy evolved across all three eras.' },
];

export default function Act2({ coldWarDots, exclusivityData }) {
  const [step, setStep] = useState(0);

  const cwRef = useRef(null);
  const cwDims = useDimensions(cwRef);
  const { svgRef: cwSvg } = useD3(cwInit, cwUpdate, { data: coldWarDots, dims: cwDims, step });

  const exRef = useRef(null);
  const exDims = useDimensions(exRef);
  const { svgRef: exSvg } = useD3(exInit, exUpdate, { data: exclusivityData, dims: exDims, step: step - 3 });

  const showTimeline   = step <= 2;
  const showExclusivity = step >= 3;

  const chartEl = (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={cwRef} style={{
        position: 'absolute', inset: 0,
        opacity: showTimeline ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showTimeline ? 'auto' : 'none',
      }}>
        <svg ref={cwSvg} style={{ width: '100%', height: '100%' }} />
      </div>

      <div ref={exRef} style={{
        position: 'absolute', inset: 0,
        opacity: showExclusivity ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showExclusivity ? 'auto' : 'none',
      }}>
        <svg ref={exSvg} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );

  return (
    <ScrollSection
      id="act2"
      actLabel="ACT II — THE NINTENDO COLD WAR"
      onStep={setStep}
      steps={STEPS.map((s, i) => <StepText key={i} {...s} />)}
    >
      {chartEl}
    </ScrollSection>
  );
}
