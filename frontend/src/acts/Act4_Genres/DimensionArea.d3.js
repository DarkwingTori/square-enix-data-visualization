import * as d3 from 'd3';

const M = { top: 32, right: 40, bottom: 40, left: 50 };

export function init(svgEl, dimensionData, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);
  const g   = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const W = width  - M.left - M.right;
  const H = height - M.top  - M.bottom;

  const years = dimensionData.map(d => d.year);
  const xScale = d3.scaleLinear().domain(d3.extent(years)).range([0, W]);

  // Normalize to proportions
  const normalized = dimensionData.map(d => {
    const total = d['2D'] + d['3D'] || 1;
    return { year: d.year, '2D': d['2D'] / total, '3D': d['3D'] / total };
  });

  const stack = d3.stack().keys(['2D', '3D']);
  const stacked = stack(normalized);

  const yScale = d3.scaleLinear().domain([0, 1]).range([H, 0]);

  const area = d3.area()
    .x(d => xScale(d.data.year))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCatmullRom);

  const COLORS = { '2D': '#4a9eff', '3D': '#e84545' };

  const paths = g.selectAll('.dim-area')
    .data(stacked)
    .join('path')
    .attr('class', 'dim-area')
    .attr('d', area)
    .attr('fill', d => COLORS[d.key] || '#888')
    .attr('fill-opacity', 0.7)
    .attr('stroke', 'none')
    .attr('opacity', 0);

  // Transition marker at 1997
  const tx = xScale(1997);
  const transitionLine = g.append('line')
    .attr('x1', tx).attr('x2', tx).attr('y1', 0).attr('y2', H)
    .attr('stroke', '#c9a84c').attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3').attr('opacity', 0);

  g.append('text')
    .attr('x', tx + 4).attr('y', 12)
    .attr('fill', '#c9a84c').attr('font-size', '9px')
    .attr('font-family', 'var(--font-display)')
    .text('PS1 Era');

  // Axes
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('d')).tickSize(0))
    .call(ax => ax.select('.domain').attr('stroke', '#2a2a44'))
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '9px'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format('.0%')).tickSize(-W))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').attr('stroke', '#1a1a2a'))
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '9px'));

  // Legend
  [['2D', COLORS['2D']], ['3D', COLORS['3D']]].forEach(([label, col], i) => {
    svg.append('rect').attr('x', M.left + i * 60).attr('y', 4).attr('width', 10).attr('height', 10).attr('fill', col).attr('rx', 1);
    svg.append('text').attr('x', M.left + i * 60 + 13).attr('y', 12).attr('fill', '#9898c0').attr('font-size', '9px').text(label);
  });

  svg.append('text').attr('x', width / 2).attr('y', 16)
    .attr('text-anchor', 'middle').attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.1em')
    .text('2D vs 3D RELEASES BY YEAR');

  return { paths, transitionLine };
}

export function update(refs, step) {
  const t = d3.transition().duration(700).ease(d3.easeCubicOut);
  if (step >= 0) refs.paths.transition(t).attr('opacity', 1);
  if (step >= 1) refs.transitionLine.transition(t).attr('opacity', 1);
}
