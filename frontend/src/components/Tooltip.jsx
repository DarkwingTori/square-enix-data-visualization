import { useState, useCallback } from 'react';

export function useTooltip() {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });

  const show = useCallback((x, y, content) => {
    setTooltip({ visible: true, x, y, content });
  }, []);

  const hide = useCallback(() => {
    setTooltip(t => ({ ...t, visible: false }));
  }, []);

  return { tooltip, show, hide };
}

export default function Tooltip({ tooltip }) {
  const { visible, x, y, content } = tooltip;
  if (!content) return null;

  return (
    <div
      className={`tooltip${visible ? '' : ' tooltip--hidden'}`}
      style={{
        left: x + 12,
        top:  y - 8,
        transform: x > window.innerWidth - 240 ? 'translateX(-110%)' : 'none',
      }}
    >
      {typeof content === 'string' ? content : content}
    </div>
  );
}

// Helper: render standard game tooltip content
export function GameTooltipContent({ title, year, platform, sales, critic }) {
  return (
    <>
      <div className="tooltip__title">{title}</div>
      {year     && <div className="tooltip__row"><span>Year</span><span className="tooltip__val">{year}</span></div>}
      {platform && <div className="tooltip__row"><span>Platform</span><span className="tooltip__val">{platform}</span></div>}
      {sales    > 0 && <div className="tooltip__row"><span>Sales</span><span className="tooltip__val">{sales.toFixed(2)}M</span></div>}
      {critic   && <div className="tooltip__row"><span>Critic Score</span><span className="tooltip__val">{Math.round(critic)}</span></div>}
    </>
  );
}
