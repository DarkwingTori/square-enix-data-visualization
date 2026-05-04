import { useRef, useState, useCallback } from 'react';
import { useDimensions } from '../../hooks/useDimensions';
import { useD3 } from '../../hooks/useD3';
import Tooltip, { useTooltip, GameTooltipContent } from '../../components/Tooltip';
import GameTable from './GameTable';
import { init as scatterInit } from './ScatterPlot.d3';

function dummyUpdate() {}

export default function Act6({ titles }) {
  const [activeTab, setActiveTab] = useState('scatter');
  const { tooltip, show: showTip, hide: hideTip } = useTooltip();

  const scatterRef = useRef(null);
  const scatterDims = useDimensions(scatterRef);

  const onHover = useCallback((x, y, d) => {
    showTip(x, y,
      <GameTooltipContent
        title={d.title}
        year={d.release_year}
        platform={d.platforms?.join(', ')}
        sales={d.total_sales}
        critic={d.avg_critic}
      />
    );
  }, [showTip]);

  const { svgRef: scatterSvg } = useD3(
    (svgEl, data, dims) => scatterInit(svgEl, data, dims, { onHover, onLeave: hideTip }),
    dummyUpdate,
    { data: titles, dims: scatterDims, step: 0 }
  );

  return (
    <section id="act6" style={{
      minHeight: '100vh',
      padding: 'calc(var(--nav-height) + 32px) 32px 64px',
      background: 'var(--bg-void)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 8 }}>
            ACT VI — EXPLORER
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', marginBottom: 8 }}>
            Sandbox Mode
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 600 }}>
            The full dataset: 608 titles, 40 years. Browse by franchise, filter by era or platform, and explore the scatter plot. Every dot is a real release.
          </p>
        </div>

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[['scatter', 'Scatter Plot'], ['table', 'Game Table']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: '8px 18px', borderRadius: 6, fontSize: 11,
                letterSpacing: '0.08em', fontFamily: 'var(--font-display)',
                border: `1px solid ${activeTab === id ? 'var(--color-merged)' : 'var(--border-subtle)'}`,
                color: activeTab === id ? 'var(--color-merged)' : 'var(--text-muted)',
                background: activeTab === id ? 'rgba(201,168,76,0.08)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'scatter' && (
          <div ref={scatterRef} style={{
            height: 560,
            background: 'radial-gradient(ellipse at center, #0f0f1e 0%, var(--bg-void) 100%)',
            borderRadius: 8, border: '1px solid var(--border-subtle)',
          }}>
            <svg ref={scatterSvg} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {activeTab === 'table' && <GameTable titles={titles} />}
      </div>

      <Tooltip tooltip={tooltip} />
    </section>
  );
}
