import { useRef, useEffect } from 'react';
import { useDimensions } from '../hooks/useDimensions';
import { init, revealAll } from './EraTimeline.d3';

export default function Hero({ titles }) {
  const containerRef = useRef(null);
  const svgRef       = useRef(null);
  const refsRef      = useRef(null);
  const dims = useDimensions(containerRef);

  useEffect(() => {
    if (!svgRef.current || !titles?.length || !dims.width || !dims.height) return;
    refsRef.current = init(svgRef.current, titles, dims);
    // Stagger reveals by era
    setTimeout(() => {
      if (!refsRef.current) return;
      revealAll(refsRef.current);
    }, 400);
  }, [titles, dims.width, dims.height]); // eslint-disable-line

  return (
    <section id="hero" className="hero">
      <div className="hero__bg" />
      <p className="hero__eyebrow">1986 — 2024</p>
      <h1 className="hero__title">
        Squaresoft. Enix.<br />
        <span>Square Enix.</span>
      </h1>
      <p className="hero__subtitle">
        204 million Final Fantasy units. A five-year cold war with Nintendo.
        A merger that divided a fanbase. This is the data behind 40 years of JRPG history.
      </p>

      <div className="hero__timeline-wrap" ref={containerRef}>
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="hero__scroll-cue">
        <span>SCROLL TO EXPLORE</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3v10M3 9l5 5 5-5" />
        </svg>
      </div>
    </section>
  );
}
