import * as d3 from 'd3';
import { ERA_COLORS } from '../../data/constants';

const M = { top: 40, right: 32, bottom: 32, left: 100 };

export function init(svgEl, exclusivityData, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const W = width  - M.left - M.right;
  const H = height - M.top  - M.bottom;

  const eras = exclusivityData.map(d => d.era);
  const yBand = d3.scaleBand().domain(eras).range([0, H]).padding(0.3);
  const xScale = d3.scaleLinear().domain([0, 1]).range([0, W]);

  // Stacked segments: exclusive, multi
  exclusivityData.forEach(d => {
    const exW = xScale(d.exclusivePct);
    const muW = xScale(d.multiPct);
    const y   = yBand(d.era);
    const bh  = yBand.bandwidth();
    const col = ERA_COLORS[d.era] || '#888';

    // Exclusive segment
    const exRect = g.append('rect')
      .attr('x', 0).attr('y', y).attr('width', 0).attr('height', bh)
      .attr('fill', col).attr('fill-opacity', 0.85).attr('rx', 2)
      .attr('opacity', 0);

    // Multi segment
    const muRect = g.append('rect')
      .attr('x', exW).attr('y', y).attr('width', 0).attr('height', bh)
      .attr('fill', col).attr('fill-opacity', 0.35).attr('rx', 2)
      .attr('opacity', 0);

    // Exclusive pct label
    g.append('text').datum({ rect: exRect, val: exW, pct: d.exclusivePct })
      .attr('class', 'ex-label')
      .attr('x', exW / 2).attr('y', y + bh / 2)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', '#f0f0fa').attr('font-size', '10px').attr('font-weight', '600')
      .text(`${(d.exclusivePct * 100).toFixed(0)}% Excl.`)
      .attr('opacity', 0);

    // Multi pct label
    if (d.multiPct > 0.1) {
      g.append('text')
        .attr('class', 'mu-label')
        .attr('x', exW + muW / 2).attr('y', y + bh / 2)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('fill', '#b0b0d0').attr('font-size', '9px')
        .text(`${(d.multiPct * 100).toFixed(0)}% Multi`)
        .attr('opacity', 0);
    }

    d._exRect = exRect;
    d._muRect = muRect;
    d._exW = exW;
    d._muW = muW;
  });

  // Y axis
  g.append('g')
    .call(d3.axisLeft(yBand).tickSize(0))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('text').attr('fill', d => ERA_COLORS[d] || '#aaa').attr('font-size', '10px').attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.06em').attr('dx', '-4px'));

  svg.append('text').attr('x', width / 2).attr('y', 20)
    .attr('text-anchor', 'middle').attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.1em')
    .text('EXCLUSIVITY BY ERA');

  // Legend
  const leg = svg.append('g').attr('transform', `translate(${M.left},${height - 12})`);
  [['Exclusive', 0.85], ['Multiplatform', 0.35]].forEach(([label, op], i) => {
    leg.append('rect').attr('x', i * 140).attr('width', 10).attr('height', 10).attr('y', -8)
      .attr('fill', '#c9a84c').attr('fill-opacity', op).attr('rx', 2);
    leg.append('text').attr('x', i * 140 + 14).attr('fill', '#9898c0').attr('font-size', '9px').text(label);
  });

  return { exclusivityData };
}

export function update(refs, step) {
  if (step < 0) return;
  const t = d3.transition().duration(600).ease(d3.easeCubicOut);
  refs.exclusivityData.forEach((d, i) => {
    d._exRect?.transition(t).delay(i * 80).attr('width', d._exW).attr('opacity', 1);
    d._muRect?.transition(t).delay(i * 80 + 200).attr('width', d._muW).attr('opacity', 1);
  });
  if (step >= 1) {
    d3.selectAll('.ex-label, .mu-label').transition(t).attr('opacity', 0.9);
  }
}
