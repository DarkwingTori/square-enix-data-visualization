import { useRef, useState } from 'react';
import { useDimensions } from '../../hooks/useDimensions';
import { useD3 } from '../../hooks/useD3';
import ScrollSection from '../../components/ScrollSection';
import StepText from '../../components/StepText';
import MergerScorecard from './MergerScorecard';
import { init as mergeInit, update as mergeUpdate } from './MergeAnimation.d3';

const STEPS = [
  { eyebrow: 'ACT III', headline: 'The Merger', body: 'April 2003. Squaresoft and Enix announced a merger that shocked the industry. Two of Japan\'s most important RPG publishers — formerly rivals — becoming one. The streams converge.' },
  { eyebrow: 'ONE COMPANY', headline: 'Two Rivers Become One', body: 'Squaresoft brought cinematic spectacle, global sales, and PlayStation dominance. Enix brought Dragon Quest, Nintendo relationships, and a loyal Japanese fanbase. Together: Square Enix.' },
  { eyebrow: 'THE NUMBERS', headline: 'Before vs. After', body: 'The merger doubled the combined catalog. Post-merger, platform count expanded from 2 primary families to 7. Titles per year accelerated. But did quality follow?' },
  { eyebrow: 'THE QUESTION', headline: 'Did Quality Decline?', body: 'The fan narrative says yes — mergers dilute focus. The data gives a more nuanced answer. Average critic scores shifted, but the catalog also tripled in scope. More titles, more variance.' },
];

export default function Act3({ scorecard }) {
  const [step, setStep] = useState(0);

  const mergeRef = useRef(null);
  const mergeDims = useDimensions(mergeRef);
  const { svgRef: mergeSvg } = useD3(mergeInit, mergeUpdate, {
    data: scorecard,
    dims: mergeDims,
    step,
  });

  const showAnimation = step <= 1;
  const showScorecard  = step >= 2;

  const chartEl = (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mergeRef} style={{
        position: 'absolute', inset: 0,
        opacity: showAnimation ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showAnimation ? 'auto' : 'none',
      }}>
        <svg ref={mergeSvg} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{
        position: 'absolute', inset: 0,
        opacity: showScorecard ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showScorecard ? 'auto' : 'none',
      }}>
        <MergerScorecard scorecard={scorecard} visible={showScorecard} />
      </div>
    </div>
  );

  return (
    <ScrollSection
      id="act3"
      actLabel="ACT III — THE MERGER"
      onStep={setStep}
      steps={STEPS.map((s, i) => <StepText key={i} {...s} />)}
    >
      {chartEl}
    </ScrollSection>
  );
}
