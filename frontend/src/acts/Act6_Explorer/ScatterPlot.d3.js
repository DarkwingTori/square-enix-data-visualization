import * as d3 from 'd3';
import { FRANCHISE_COLORS, GENRE_COLORS } from '../../data/constants';

const M = { top: 40, right: 32, bottom: 48, left: 56 };

export function init(svgEl, titles, dims, { onHover, onLeave }) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);
  const g   = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const W = width  - M.left - M.right;
  const H = height - M.top  - M.bottom;

  const hasScore = titles.filter(t => t.avg_critic && t.release_year);

  const xScale = d3.scaleLinear()
    .domain(d3.extent(hasScore, d => d.release_year)).range([0, W]).nice();
  const yScale = d3.scaleLinear()
    .domain([0, 100]).range([H, 0]);
  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(hasScore, d => d.total_sales) || 1]).range([3, 16]);

  // Axes
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('d')).tickSize(-H))
    .call(ax => ax.select('.domain').attr('stroke', '#2a2a44'))
    .call(ax => ax.selectAll('line').attr('stroke', '#1a1a2a'))
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '9px'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-W))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').attr('stroke', '#1a1a2a'))
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '9px'));

  // Y label
  g.append('text')
    .attr('transform', 'rotate(-90)').attr('x', -H / 2).attr('y', -42)
    .attr('text-anchor', 'middle').attr('fill', '#5a5a7a').attr('font-size', '9px')
    .text('CRITIC SCORE');

  // Dots
  const dots = g.selectAll('.scatter-dot')
    .data(hasScore)
    .join('circle')
    .attr('class', 'scatter-dot')
    .attr('cx', d => xScale(d.release_year))
    .attr('cy', d => yScale(d.avg_critic))
    .attr('r', d => rScale(d.total_sales))
    .attr('fill', d => GENRE_COLORS[d.genre] || '#888')
    .attr('fill-opacity', 0.65)
    .attr('stroke', '#060608')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer');

  dots.on('mousemove', function(event, d) {
    d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
    const [px, py] = d3.pointer(event, document.body);
    onHover?.(px, py, d);
  }).on('mouseleave', function() {
    d3.select(this).attr('stroke', '#060608').attr('stroke-width', 0.5);
    onLeave?.();
  });

  svg.append('text').attr('x', width / 2).attr('y', 18)
    .attr('text-anchor', 'middle').attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.1em')
    .text('RELEASE YEAR vs CRITIC SCORE — bubble size = sales');

  return { dots, xScale, yScale };
}

export function highlightFranchise(refs, franchise) {
  refs.dots
    .attr('fill-opacity', d => d.series === franchise ? 0.9 : 0.15)
    .attr('r', d => {
      const base = d.total_sales > 0 ? Math.sqrt(d.total_sales) * 2 + 3 : 3;
      return d.series === franchise ? base * 1.4 : base;
    });
}

export function resetHighlight(refs) {
  refs.dots.attr('fill-opacity', 0.65).attr('r', d => {
    return d.total_sales > 0 ? Math.sqrt(d.total_sales) * 2 + 3 : 3;
  });
}
