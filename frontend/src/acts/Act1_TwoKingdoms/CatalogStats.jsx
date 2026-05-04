export default function CatalogStats({ stats, visible }) {
  const ERA_STYLE = {
    Squaresoft:   { color: 'var(--color-square)', label: 'SQUARESOFT' },
    Enix:         { color: 'var(--color-enix)',   label: 'ENIX' },
    'Square Enix':{ color: 'var(--color-merged)', label: 'SQUARE ENIX' },
  };

  const filtered = (stats || []).filter(s => s.era !== 'Square Enix');

  return (
    <div className="stat-grid">
      {filtered.map((s, i) => {
        const style = ERA_STYLE[s.era] || { color: '#aaa', label: s.era };
        return (
          <div
            key={s.era}
            className={`stat-panel${visible ? ' stat-panel--visible' : ''}`}
            style={{ '--card-color': style.color, borderColor: `${style.color}44`, transitionDelay: `${i * 0.12}s` }}
          >
            <div className="stat-panel__header" style={{ color: style.color }}>
              {style.label}
            </div>
            <div className="stat-panel__items">
              <div className="stat-item">
                <span className="stat-item__value">{s.totalTitles}</span>
                <span className="stat-item__label">Total Titles</span>
              </div>
              <div className="stat-item">
                <span className="stat-item__value">
                  {s.avgCritic ? s.avgCritic.toFixed(1) : '—'}
                </span>
                <span className="stat-item__label">Avg Critic Score</span>
              </div>
              <div className="stat-item">
                <span className="stat-item__value">{(s.japanOnlyPct * 100).toFixed(0)}%</span>
                <span className="stat-item__label">Japan Only</span>
              </div>
              <div className="stat-item">
                <span className="stat-item__value stat-item__value--sm">{s.topFranchise || '—'}</span>
                <span className="stat-item__label">Top Genre</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
