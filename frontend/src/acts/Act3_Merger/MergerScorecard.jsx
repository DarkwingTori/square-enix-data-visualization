export default function MergerScorecard({ scorecard, visible }) {
  if (!scorecard) return null;
  const { pre, post } = scorecard;

  const rows = [
    { label: 'Total Titles',     pre: pre.totalTitles,                 post: post.totalTitles,                 fmt: v => v },
    { label: 'Avg Critic Score', pre: pre.avgCritic,                   post: post.avgCritic,                   fmt: v => v?.toFixed(1) || '—' },
    { label: 'Titles / Year',    pre: pre.titlesPerYear,                post: post.titlesPerYear,               fmt: v => v?.toFixed(1) || '—' },
    { label: 'Platforms',        pre: pre.platformCount,                post: post.platformCount,               fmt: v => v },
    { label: 'Japan Only',       pre: (pre.japanOnlyPct * 100),         post: (post.japanOnlyPct * 100),        fmt: v => `${v?.toFixed(0)}%` },
  ];

  return (
    <div className="merger-scorecard" style={{
      display: 'grid', gridTemplateColumns: '1fr 2fr 1fr',
      width: '100%', height: '100%', padding: '24px',
      alignContent: 'center', gap: 0,
      opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease',
    }}>
      {/* Pre header */}
      <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(74,158,255,0.3)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.16em', color: 'var(--color-square)', marginBottom: 4 }}>PRE-2003</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Squaresoft + Enix separate</div>
      </div>

      <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(201,168,76,0.3)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--color-merged)' }}>THE MERGER — 2003</div>
      </div>

      <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '1px solid rgba(201,168,76,0.3)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.16em', color: 'var(--color-merged)', marginBottom: 4 }}>POST-2003</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Square Enix combined</div>
      </div>

      {rows.map((row, i) => {
        const preVal  = row.fmt(row.pre);
        const postVal = row.fmt(row.post);
        const isNumeric = typeof row.pre === 'number' && typeof row.post === 'number';
        const diff = isNumeric ? row.post - row.pre : null;
        const improved = diff !== null && diff >= 0;

        return [
          <div key={`pre-${i}`} style={{ textAlign: 'center', padding: '14px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)' }}>{preVal}</div>
          </div>,
          <div key={`lbl-${i}`} style={{ textAlign: 'center', padding: '14px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{row.label}</span>
            {diff !== null && <span style={{ fontSize: '11px', color: improved ? '#4a9eff' : '#e84545', fontWeight: 600 }}>{improved ? '▲' : '▼'} {Math.abs(isNaN(diff) ? 0 : diff).toFixed(1)}</span>}
          </div>,
          <div key={`post-${i}`} style={{ textAlign: 'center', padding: '14px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)' }}>{postVal}</div>
          </div>,
        ];
      })}
    </div>
  );
}
