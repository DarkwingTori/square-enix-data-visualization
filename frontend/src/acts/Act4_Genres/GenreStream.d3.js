import * as d3 from 'd3';
import { GENRE_COLORS } from '../../data/constants';

const M = { top: 28, right: 24, bottom: 72, left: 24 };

export function init(svgEl, { yearData, genreKeys }, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);
  const g   = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const W = width  - M.left - M.right;
  const H = height - M.top  - M.bottom;

  const topGenres = genreKeys.slice(0, 9);
  const stack = d3.stack().keys(topGenres)
    .offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
  const stacked = stack(yearData);

  const xScale = d3.scaleLinear()
    .domain(d3.extent(yearData, d => d.year)).range([0, W]);

  const yScale = d3.scaleLinear()
    .domain([
      d3.min(stacked, layer => d3.min(layer, d => d[0])),
      d3.max(stacked, layer => d3.max(layer, d => d[1])),
    ]).range([H, 0]);

  const area = d3.area()
    .x(d => xScale(d.data.year))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCatmullRom);

  const streams = g.selectAll('.stream')
    .data(stacked)
    .join('path')
    .attr('class', 'stream')
    .attr('d', area)
    .attr('fill', d => GENRE_COLORS[d.key] || '#4a9eff')
    .attr('fill-opacity', 0.2)
    .attr('stroke', 'none');

  // Merger line
  const mx = xScale(2003);
  g.append('line')
    .attr('x1', mx).attr('x2', mx).attr('y1', 0).attr('y2', H)
    .attr('stroke', '#c9a84c').attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3');
  g.append('text')
    .attr('x', mx + 5).attr('y', 14)
    .attr('fill', '#c9a84c').attr('font-size', '9px')
    .attr('font-family', 'var(--font-display)')
    .text('2003');

  // Stream labels — appear on wide streams at their peak year
  const labelGroup = g.append('g').attr('class', 'stream-labels').attr('opacity', 0);
  stacked.forEach(layer => {
    // Find the year where the band is widest
    let bestIdx = 0, bestH = 0;
    layer.forEach((d, i) => {
      const bh = Math.abs(yScale(d[0]) - yScale(d[1]));
      if (bh > bestH) { bestH = bh; bestIdx = i; }
    });
    if (bestH < 18) return;
    const d = layer[bestIdx];
    const cx = xScale(d.data.year);
    const cy = yScale((d[0] + d[1]) / 2);
    const col = GENRE_COLORS[layer.key] || '#4a9eff';

    // White outline for readability against any stream color
    labelGroup.append('text')
      .attr('x', cx).attr('y', cy)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', '#060608').attr('font-size', '9.5px').attr('font-weight', '700')
      .attr('stroke', '#060608').attr('stroke-width', 3).attr('stroke-linejoin', 'round')
      .attr('paint-order', 'stroke')
      .attr('pointer-events', 'none')
      .text(layer.key);

    labelGroup.append('text')
      .attr('x', cx).attr('y', cy)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', col).attr('font-size', '9.5px').attr('font-weight', '700')
      .attr('pointer-events', 'none')
      .text(layer.key);
  });

  // X axis
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('d')).tickSize(0))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '9px'));

  // ── Legend ─────────────────────────────────────────────────────────────────
  const COLS     = 5;
  const ITEM_W   = Math.floor(W / COLS);
  const ITEM_H   = 18;
  const legendY  = H + 44;
  const legendG  = g.append('g').attr('class', 'genre-legend').attr('transform', `translate(0,${legendY})`);

  topGenres.forEach((genre, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const lx  = col * ITEM_W;
    const ly  = row * ITEM_H;
    const color = GENRE_COLORS[genre] || '#4a9eff';

    legendG.append('rect')
      .attr('x', lx).attr('y', ly - 7)
      .attr('width', 9).attr('height', 9).attr('rx', 2)
      .attr('fill', color).attr('fill-opacity', 0.85);

    legendG.append('text')
      .attr('x', lx + 13).attr('y', ly)
      .attr('dominant-baseline', 'central')
      .attr('fill', '#9898c0').attr('font-size', '9px')
      .attr('font-family', 'var(--font-body)')
      .text(genre);
  });

  svg.append('text').attr('x', width / 2).attr('y', 16)
    .attr('text-anchor', 'middle').attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.1em')
    .text('GENRE EVOLUTION — 1987 TO 2024');

  return { streams, labelGroup };
}

export function update(refs, step) {
  const t = d3.transition().duration(800).ease(d3.easeCubicOut);
  if (step >= 0) refs.streams.transition(t).attr('fill-opacity', step >= 1 ? 0.78 : 0.4);
  if (step >= 2) refs.labelGroup.transition(t).attr('opacity', 1);
}
