import * as d3 from 'd3';
import { FRANCHISE_COLORS } from '../../data/constants';
import { TOP_GAMES } from '../../data/franchiseSales';

const M = { top: 40, right: 60, bottom: 44, left: 52 };

export function init(svgEl, { franchise, topGamesKey, titles }, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);
  const g   = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const W = width  - M.left - M.right;
  const H = height - M.top  - M.bottom;

  // Get sales data from TOP_GAMES — use topGamesKey so compound pill labels resolve correctly
  const salesGames = TOP_GAMES.filter(g => g.franchise === (topGamesKey || franchise)).sort((a, b) => a.year - b.year);

  // titles are already pre-filtered by csvSeries in Act5's index.jsx
  const criticData = (titles || [])
    .filter(t => t.avg_critic && t.release_year)
    .sort((a, b) => a.release_year - b.release_year);

  if (!salesGames.length && !criticData.length) {
    g.append('text').attr('x', W / 2).attr('y', H / 2)
      .attr('text-anchor', 'middle').attr('fill', '#5a5a7a').attr('font-size', '12px')
      .text('No data available for this franchise');
    return { paths: [] };
  }

  const allYears = [
    ...salesGames.map(d => d.year),
    ...criticData.map(d => d.release_year),
  ];
  const xScale = d3.scaleLinear().domain(d3.extent(allYears)).range([0, W]).nice();

  const maxSales = d3.max(salesGames, d => d.sales) || 1;
  const ySales   = d3.scaleLinear().domain([0, maxSales]).range([H, 0]).nice();

  const maxCritic = d3.max(criticData, d => d.avg_critic) || 100;
  const yCritic   = d3.scaleLinear().domain([0, Math.min(100, maxCritic + 10)]).range([H, 0]);

  const color = FRANCHISE_COLORS[franchise] || '#c9a84c';

  // Sales line
  let salesPath = null;
  if (salesGames.length > 1) {
    const line = d3.line().x(d => xScale(d.year)).y(d => ySales(d.sales)).curve(d3.curveCatmullRom);
    salesPath = g.append('path')
      .datum(salesGames).attr('fill', 'none')
      .attr('stroke', color).attr('stroke-width', 2.5)
      .attr('d', line).attr('opacity', 0);

    g.selectAll('.sales-dot')
      .data(salesGames).join('circle')
      .attr('class', 'sales-dot')
      .attr('cx', d => xScale(d.year)).attr('cy', d => ySales(d.sales))
      .attr('r', 4).attr('fill', color).attr('stroke', '#060608').attr('stroke-width', 1)
      .attr('opacity', 0);

    // Value labels on dots
    g.selectAll('.sales-val')
      .data(salesGames).join('text')
      .attr('class', 'sales-val')
      .attr('x', d => xScale(d.year)).attr('y', d => ySales(d.sales) - 9)
      .attr('text-anchor', 'middle').attr('fill', '#c8c8e0').attr('font-size', '8px')
      .text(d => `${d.sales.toFixed(1)}M`).attr('opacity', 0);
  }

  // Critic score line
  let criticPath = null;
  if (criticData.length > 1) {
    const criticLine = d3.line().x(d => xScale(d.release_year)).y(d => yCritic(d.avg_critic)).curve(d3.curveCatmullRom);
    criticPath = g.append('path')
      .datum(criticData).attr('fill', 'none')
      .attr('stroke', '#9898c0').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3')
      .attr('d', criticLine).attr('opacity', 0);

    // Right y-axis for critic score
    g.append('g').attr('transform', `translate(${W},0)`)
      .call(d3.axisRight(yCritic).ticks(4).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '8px').attr('dx', '4px'));
  }

  // Left y-axis (sales)
  g.append('g')
    .call(d3.axisLeft(ySales).ticks(5).tickFormat(d => `${d}M`).tickSize(-W))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').attr('stroke', '#1a1a2a'))
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '8px'));

  // X-axis
  g.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('d')).tickSize(0))
    .call(ax => ax.select('.domain').attr('stroke', '#2a2a44'))
    .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '9px'));

  svg.append('text').attr('x', width / 2).attr('y', 18)
    .attr('text-anchor', 'middle').attr('fill', color)
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.1em')
    .text(`${franchise.toUpperCase()} — SALES TRAJECTORY`);

  // Legend
  const leg = svg.append('g').attr('transform', `translate(${M.left},${height - 10})`);
  leg.append('line').attr('x1', 0).attr('x2', 16).attr('y1', -4).attr('y2', -4).attr('stroke', color).attr('stroke-width', 2.5);
  leg.append('text').attr('x', 20).attr('fill', '#9898c0').attr('font-size', '9px').text('Global Sales (M)');
  if (criticPath) {
    leg.append('line').attr('x1', 130).attr('x2', 146).attr('y1', -4).attr('y2', -4).attr('stroke', '#9898c0').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3');
    leg.append('text').attr('x', 150).attr('fill', '#9898c0').attr('font-size', '9px').text('Critic Score');
  }

  return { salesPath, criticPath };
}

export function update(refs, step) {
  const t = d3.transition().duration(600).ease(d3.easeCubicOut);
  if (refs.salesPath) refs.salesPath.transition(t).attr('opacity', 1);
  d3.selectAll('.sales-dot').transition(t).delay((d, i) => i * 40).attr('opacity', 1);
  d3.selectAll('.sales-val').transition(d3.transition().duration(400).delay(500)).attr('opacity', 0.8);
  if (refs.criticPath && step >= 1) refs.criticPath.transition(t).attr('opacity', 0.8);
}
