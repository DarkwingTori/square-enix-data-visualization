import { useRef, useState } from 'react';
import { useDimensions } from '../../hooks/useDimensions';
import { useD3 } from '../../hooks/useD3';
import ScrollSection from '../../components/ScrollSection';
import StepText from '../../components/StepText';
import { init as streamInit, update as streamUpdate } from './GenreStream.d3';
import { init as dimInit, update as dimUpdate } from './DimensionArea.d3';

const STEPS = [
  { eyebrow: 'ACT IV', headline: 'Genre Evolution', body: 'Square Enix\'s catalog didn\'t just grow — it transformed. The streamgraph shows every genre from 1987 to 2024. Watch for the shift: Turn-Based RPG was once dominant. Then came 3D, then Action RPG, then Shooter acquisitions.' },
  { eyebrow: 'THE STREAMS', headline: 'Rise & Fall of Genres', body: 'Each colored band is a genre. Width = number of releases that year. The Role-Playing stream dominated through the 90s. Post-merger acquisitions of Eidos brought Shooter and Action-Adventure into the mix.' },
  { eyebrow: 'AFTER 2003', headline: 'Diversification', body: 'Post-merger, the genre palette exploded. Eidos added Tomb Raider (Action-Adventure), Hitman (Stealth/Action), and Just Cause (Shooter). The RPG monoculture of the Squaresoft years gave way to a broader portfolio.' },
  { eyebrow: '2D vs 3D', headline: 'The Dimension Transition', body: 'The PlayStation 1 era in 1997 triggered a shift from 2D to 3D. FF VII was one of the defining 3D transitions in gaming history. The area chart shows exactly when the industry crossed over.' },
];

export default function Act4({ genreData, dimensionData }) {
  const [step, setStep] = useState(0);

  const streamRef = useRef(null);
  const streamDims = useDimensions(streamRef);
  const { svgRef: streamSvg } = useD3(streamInit, streamUpdate, {
    data: genreData,
    dims: streamDims,
    step,
  });

  const dimRef = useRef(null);
  const dimDims = useDimensions(dimRef);
  const { svgRef: dimSvg } = useD3(dimInit, dimUpdate, {
    data: dimensionData,
    dims: dimDims,
    step: step - 3,
  });

  const showStream = step <= 2;
  const showDim    = step >= 3;

  const chartEl = (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={streamRef} style={{
        position: 'absolute', inset: 0,
        opacity: showStream ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showStream ? 'auto' : 'none',
      }}>
        <svg ref={streamSvg} style={{ width: '100%', height: '100%' }} />
      </div>

      <div ref={dimRef} style={{
        position: 'absolute', inset: 0,
        opacity: showDim ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showDim ? 'auto' : 'none',
      }}>
        <svg ref={dimSvg} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );

  return (
    <ScrollSection
      id="act4"
      actLabel="ACT IV — GENRE EVOLUTION"
      onStep={setStep}
      steps={STEPS.map((s, i) => <StepText key={i} {...s} />)}
    >
      {chartEl}
    </ScrollSection>
  );
}
