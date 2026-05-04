import * as d3 from 'd3';
import { PLATFORM_COLORS, FRANCHISE_COLORS } from '../../data/constants';

const M = { top: 36, right: 60, bottom: 28, left: 160 };

export function init(svgEl, historyData, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);
  const g   = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const W = width  - M.left - M.right;
  const H = height - M.top  - M.bottom;

  if (!historyData?.length) {
    g.append('text').attr('x', W / 2).attr('y', H / 2)
      .attr('text-anchor', 'middle').attr('fill', '#5a5a7a').attr('font-size', '12px')
      .text('No platform data available');
    return { bars: d3.select(null) };
  }

  const titles  = historyData.map(d => d.title);
  const allYears = historyData.flatMap(d => [d.year, d.year + 1]);
  const xScale  = d3.scaleLinear().domain(d3.extent(allYears)).range([0, W]).nice();
  const yBand   = d3.scaleBand().domain(titles).range([0, H]).padding(0.25);

  // One bar per platform per game
  const bars = g.append('g').attr('class', 'platform-bars');

  historyData.forEach(d => {
    d.platforms.forEach((p, i) => {
      const bw = Math.max(xScale(d.year + 1) - xScale(d.year), 8);
      const offset = i * (yBand.bandwidth() / d.platforms.length);
      bars.append('rect')
        .datum(d)
        .attr('x', xScale(d.year))
        .attr('y', yBand(d.title) + offset)
        .attr('width', 0)
        .attr('height', yBand.bandwidth() / d.platforms.length - 1)
        .attr('fill', PLATFORM_COLORS[p] || '#888')
        .attr('rx', 2)
        .attr('fill-opacity', 0.8)
        .attr('opacity', 0);
    });
  });

  // Y axis
  g.append('g')
    .call(d3.axisLeft(yBand).tickSize(0))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('text')
      .attr('fill', '#9898c0').attr('font-size', '9px').attr('dx', '-4px')
      .each(function(d) {
        const el = d3.select(this);
        if (d.length > 28) el.text(d.slice(0, 26) + '…');
      }));

  // X axis
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('d')).tickSize(0))
    .call(ax => ax.select('.domain').attr('stroke', '#2a2a44'))
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '9px'));

  // Platform legend
  const platforms = Object.keys(PLATFORM_COLORS).filter(p => p !== 'Other');
  const legG = svg.append('g').attr('transform', `translate(${M.left},${height - 10})`);
  platforms.slice(0, 5).forEach((p, i) => {
    legG.append('rect').attr('x', i * 90).attr('y', -8).attr('width', 10).attr('height', 10)
      .attr('fill', PLATFORM_COLORS[p]).attr('rx', 1);
    legG.append('text').attr('x', i * 90 + 13).attr('fill', '#7878a0').attr('font-size', '8px').text(p);
  });

  svg.append('text').attr('x', width / 2).attr('y', 18)
    .attr('text-anchor', 'middle').attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.1em')
    .text('PLATFORM HISTORY');

  return { bars: bars.selectAll('rect'), xScale, historyData };
}

export function update(refs, step) {
  if (!refs.bars || refs.bars.empty()) return;
  const t = d3.transition().duration(500).ease(d3.easeCubicOut);
  refs.bars.transition(t)
    .delay((d, i) => i * 20)
    .attr('width', (d) => {
      const w = refs.xScale ? Math.max(refs.xScale(d.year + 1) - refs.xScale(d.year), 8) : 12;
      return w;
    })
    .attr('opacity', 0.9);
}
