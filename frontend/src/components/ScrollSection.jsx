import { useEffect, useRef, useCallback } from 'react';
import scrollama from 'scrollama';

export default function ScrollSection({ id, actLabel, children, onStep, steps }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const scroller = scrollama();
    scroller
      .setup({ step: `#${id} .scroll-step`, offset: 0.5 })
      .onStepEnter(({ index }) => onStep?.(index));

    window.addEventListener('resize', scroller.resize);
    return () => {
      window.removeEventListener('resize', scroller.resize);
      scroller.destroy();
    };
  }, [id]); // eslint-disable-line

  const [stickyEl, stepsEl] = Array.isArray(children) ? children : [children, null];

  return (
    <section id={id} ref={containerRef} className="act-container">
      <div className="act-sticky">
        {actLabel && <div className="act-sticky__header">{actLabel}</div>}
        <div className="act-sticky__chart">
          {stickyEl}
        </div>
      </div>
      <div className="act-steps">
        {(steps || []).map((s, i) => (
          <div key={i} className="scroll-step">
            {s}
          </div>
        ))}
        {stepsEl}
      </div>
    </section>
  );
}
