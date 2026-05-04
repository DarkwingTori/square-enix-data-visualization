import * as d3 from 'd3';
import { GENRE_COLORS, ERA_COLORS } from '../../data/constants';

// Genre label abbreviations so they fit in the ring
const GENRE_SHORT = {
  'Role-Playing': 'RPG',
  'Action-Adventure': 'Action-Adv',
  'Action RPG': 'Action RPG',
  'Turn-Based RPG': 'Turn-Based',
  'Puzzle': 'Puzzle',
  'Platformer': 'Platformer',
  'Strategy': 'Strategy',
  'Action': 'Action',
  'Simulation': 'Sim',
  'Sports': 'Sports',
  'Shooter': 'Shooter',
  'Fighting': 'Fighting',
  'Stealth': 'Stealth',
  'Racing': 'Racing',
};

function shortGenre(g) {
  return GENRE_SHORT[g] || g;
}

export function init(svgEl, statsData, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);

  const eras = statsData.filter(s => s.era !== 'Square Enix');
  const colW = width / 2;

  // Reserve top for title + bottom for stats
  const TITLE_H = 44;
  const STATS_H = 52;
  const chartH  = height - TITLE_H - STATS_H;
  const maxR    = Math.min(colW * 0.38, chartH * 0.44);
  const labelR  = maxR + 18;
  const centerY = TITLE_H + chartH / 2;

  // Chart title
  svg.append('text')
    .attr('x', width / 2).attr('y', 22)
    .attr('text-anchor', 'middle')
    .attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)')
    .attr('font-size', '11px')
    .attr('letter-spacing', '0.14em')
    .text('GENRE FINGERPRINTS');

  svg.append('text')
    .attr('x', width / 2).attr('y', 36)
    .attr('text-anchor', 'middle')
    .attr('fill', '#5a5a7a')
    .attr('font-family', 'var(--font-body)')
    .attr('font-size', '9px')
    .attr('letter-spacing', '0.06em')
    .text('each petal = a genre  ·  length = % of total catalog');

  // Vertical divider
  svg.append('line')
    .attr('x1', colW).attr('x2', colW)
    .attr('y1', TITLE_H).attr('y2', height - STATS_H + 8)
    .attr('stroke', 'rgba(255,255,255,0.06)')
    .attr('stroke-width', 1);

  const portraits = [];

  eras.forEach((stat, eraIdx) => {
    const cx       = colW * eraIdx + colW / 2;
    const eraColor = ERA_COLORS[stat.era] || '#aaa';
    const genres   = stat.genreCounts.slice(0, 8);
    const total    = d3.sum(genres, d => d[1]);
    const maxCount = genres[0]?.[1] || 1;
    const n        = genres.length;
    const anglePad = 0.18; // radians of padding between bars
    const sliceAngle = (2 * Math.PI) / n;

    const g = svg.append('g').attr('transform', `translate(${cx},${centerY})`);

    // --- Guide rings ---
    [0.25, 0.5, 0.75, 1.0].forEach((frac, ri) => {
      g.append('circle')
        .attr('r', frac * maxR)
        .attr('fill', 'none')
        .attr('stroke', ri === 3 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)')
        .attr('stroke-width', ri === 3 ? 1 : 0.75);
    });

    // --- Guide spokes ---
    genres.forEach((_, i) => {
      const angle = i * sliceAngle - Math.PI / 2;
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', Math.cos(angle) * maxR)
        .attr('y2', Math.sin(angle) * maxR)
        .attr('stroke', 'rgba(255,255,255,0.04)')
        .attr('stroke-width', 0.75);
    });

    // --- Arc data ---
    const arcData = genres.map((d, i) => {
      const midAngle   = i * sliceAngle - Math.PI / 2;
      const startAngle = midAngle - sliceAngle / 2 + anglePad;
      const endAngle   = midAngle + sliceAngle / 2 - anglePad;
      const outerR     = (d[1] / maxCount) * maxR;
      return { genre: d[0], count: d[1], pct: d[1] / total, startAngle, endAngle, outerR, midAngle };
    });

    // --- Bars (start at outerRadius=0) ---
    const bars = g.selectAll('.petal')
      .data(arcData)
      .join('path')
      .attr('class', 'petal')
      .attr('d', d =>
        d3.arc().innerRadius(0).outerRadius(0).startAngle(d.startAngle).endAngle(d.endAngle)()
      )
      .attr('fill', d => GENRE_COLORS[d.genre] || eraColor)
      .attr('fill-opacity', 0.82)
      .attr('stroke', '#060608')
      .attr('stroke-width', 1.2);

    // --- Inner glow ring (era color, at r=8) ---
    g.append('circle')
      .attr('r', 8)
      .attr('fill', eraColor)
      .attr('fill-opacity', 0.15)
      .attr('stroke', eraColor)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5);

    // --- Era name in center ---
    const eraLabel = g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -7)
      .attr('fill', eraColor)
      .attr('font-family', 'var(--font-display)')
      .attr('font-size', '11px')
      .attr('letter-spacing', '0.14em')
      .attr('opacity', 0)
      .text(stat.era === 'Squaresoft' ? 'SQUARESOFT' : 'ENIX');

    const countLabel = g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 7)
      .attr('dominant-baseline', 'hanging')
      .attr('fill', '#9898c0')
      .attr('font-family', 'var(--font-body)')
      .attr('font-size', '9px')
      .attr('opacity', 0)
      .text(`${stat.totalTitles} titles`);

    // --- Genre labels (positioned just outside labelR) ---
    const genreLabels = g.selectAll('.genre-tip')
      .data(arcData)
      .join('text')
      .attr('class', 'genre-tip')
      .attr('x', d => Math.cos(d.midAngle) * labelR)
      .attr('y', d => Math.sin(d.midAngle) * labelR)
      .attr('text-anchor', d => {
        const c = Math.cos(d.midAngle);
        return c > 0.15 ? 'start' : c < -0.15 ? 'end' : 'middle';
      })
      .attr('dominant-baseline', 'central')
      .attr('fill', d => GENRE_COLORS[d.genre] || '#9898c0')
      .attr('fill-opacity', 0.85)
      .attr('font-size', '8px')
      .attr('font-family', 'var(--font-body)')
      .text(d => `${shortGenre(d.genre)} ${(d.pct * 100).toFixed(0)}%`)
      .attr('opacity', 0);

    // --- Stats row below portrait ---
    const statsY = height - STATS_H + 12;
    const statItems = [
      { label: 'AVG SCORE', value: stat.avgCritic ? stat.avgCritic.toFixed(0) : '—' },
      { label: 'JAPAN ONLY', value: `${(stat.japanOnlyPct * 100).toFixed(0)}%` },
      { label: 'TOP GENRE',  value: shortGenre(genres[0]?.[0] || '—') },
    ];

    const statsGroup = svg.append('g').attr('opacity', 0);
    const statColW = (colW - 24) / statItems.length;

    statItems.forEach((item, i) => {
      const sx = colW * eraIdx + 12 + statColW * i + statColW / 2;

      statsGroup.append('text')
        .attr('x', sx).attr('y', statsY)
        .attr('text-anchor', 'middle')
        .attr('fill', eraColor)
        .attr('font-family', 'var(--font-display)')
        .attr('font-size', '15px')
        .attr('letter-spacing', '0.04em')
        .text(item.value);

      statsGroup.append('text')
        .attr('x', sx).attr('y', statsY + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', '#5a5a7a')
        .attr('font-family', 'var(--font-body)')
        .attr('font-size', '8px')
        .attr('letter-spacing', '0.08em')
        .text(item.label);
    });

    // Thin separator above stats row
    svg.append('line')
      .attr('x1', colW * eraIdx + 12).attr('x2', colW * (eraIdx + 1) - 12)
      .attr('y1', statsY - 10).attr('y2', statsY - 10)
      .attr('stroke', 'rgba(255,255,255,0.05)')
      .attr('stroke-width', 1);

    portraits.push({ bars, eraLabel, countLabel, genreLabels, statsGroup, arcData });
  });

  return { portraits };
}

export function update(refs, step) {
  const tFast = d3.transition().duration(700).ease(d3.easeCubicOut);
  const tSlow = d3.transition().duration(900).ease(d3.easeBackOut.overshoot(0.6));

  refs.portraits.forEach(({ bars, eraLabel, countLabel, genreLabels, statsGroup, arcData }) => {
    // Step 0+: Era name + count fade in
    eraLabel.transition(tFast).attr('opacity', 1);
    countLabel.transition(tFast).delay(200).attr('opacity', 0.7);

    if (step >= 1) {
      // Bars grow outward with a springy overshoot
      bars.transition(tSlow)
        .delay((d, i) => i * 60 + 80)
        .attr('d', d =>
          d3.arc()
            .innerRadius(0)
            .outerRadius(d.outerR)
            .startAngle(d.startAngle)
            .endAngle(d.endAngle)()
        );
    } else {
      bars.transition(tFast).attr('d', d =>
        d3.arc().innerRadius(0).outerRadius(0).startAngle(d.startAngle).endAngle(d.endAngle)()
      );
    }

    if (step >= 2) {
      genreLabels.transition(tFast).delay((d, i) => i * 35).attr('opacity', 0.85);
      statsGroup.transition(tFast).delay(300).attr('opacity', 1);
    } else {
      genreLabels.transition(tFast).attr('opacity', 0);
      statsGroup.transition(tFast).attr('opacity', 0);
    }
  });
}
