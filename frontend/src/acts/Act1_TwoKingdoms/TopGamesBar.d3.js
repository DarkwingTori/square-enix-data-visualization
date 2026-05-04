import * as d3 from 'd3';
import { FRANCHISE_COLORS, ERA_COLORS } from '../../data/constants';
import { TOP_GAMES } from '../../data/franchiseSales';

const M = { top: 36, right: 56, bottom: 16, left: 148 };

// Shows top N games per era side-by-side using TOP_GAMES data
export function init(svgEl, statsData, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);

  // Map eras to their franchise sets (hardcoded from TOP_GAMES)
  const SQUARESOFT_FRANCHISES = new Set(['Final Fantasy', 'Chrono', 'Mana', 'SaGa', 'Xenogears', 'Parasite Eve', 'Star Ocean']);
  const ENIX_FRANCHISES = new Set(['Dragon Quest', 'Star Ocean', 'Valkyrie Profile', 'Ogre', 'Soul Blazer']);

  const topSquare = TOP_GAMES.filter(g => SQUARESOFT_FRANCHISES.has(g.franchise)).slice(0, 8);
  const topEnix   = TOP_GAMES.filter(g => ENIX_FRANCHISES.has(g.franchise)).slice(0, 8);

  const halfH  = (height - M.top - M.bottom) / 2 - 8;
  const W      = width - M.left - M.right;

  function drawHalf(parent, games, topOffset, eraName, eraColor) {
    const g = parent.append('g').attr('transform', `translate(${M.left},${topOffset})`);
    const maxVal = d3.max(games, d => d.sales) || 1;
    const xScale = d3.scaleLinear().domain([0, maxVal]).range([0, W]).nice();
    const yBand  = d3.scaleBand().domain(games.map(d => d.title)).range([0, halfH]).padding(0.22);

    // Era label
    g.append('text')
      .attr('x', -M.left + 4).attr('y', -12)
      .attr('fill', eraColor).attr('font-size', '10px')
      .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.1em')
      .text(eraName.toUpperCase());

    // Bars
    const bars = g.selectAll('.hbar')
      .data(games)
      .join('rect')
      .attr('class', 'hbar')
      .attr('x', 0).attr('y', d => yBand(d.title))
      .attr('width', 0).attr('height', yBand.bandwidth())
      .attr('fill', d => FRANCHISE_COLORS[d.franchise] || eraColor)
      .attr('rx', 2).attr('opacity', 0);

    // Labels at end of bar
    const valLabels = g.selectAll('.hval')
      .data(games)
      .join('text')
      .attr('class', 'hval')
      .attr('x', d => xScale(d.sales) + 4)
      .attr('y', d => yBand(d.title) + yBand.bandwidth() / 2)
      .attr('dominant-baseline', 'central')
      .attr('fill', '#b0b0d0').attr('font-size', '9px')
      .text(d => `${d.sales.toFixed(1)}M`)
      .attr('opacity', 0);

    // Y-axis titles
    g.append('g')
      .call(d3.axisLeft(yBand).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text')
        .attr('fill', '#9898c0').attr('font-size', '9px').attr('dx', '-4px')
        .each(function(d) {
          const el = d3.select(this);
          if (d.length > 28) el.text(d.slice(0, 26) + '…');
        }));

    // X-axis
    g.append('g').attr('transform', `translate(0,${halfH})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d}M`).tickSize(-halfH))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('line').attr('stroke', '#1a1a2a'))
      .call(ax => ax.selectAll('text').attr('fill', '#7878a0').attr('font-size', '8px'));

    return { bars, valLabels, xScale };
  }

  const sqGroup = drawHalf(svg, topSquare, M.top, 'Squaresoft', ERA_COLORS.Squaresoft);
  const enGroup = drawHalf(svg, topEnix, M.top + halfH + 24, 'Enix', ERA_COLORS.Enix);

  svg.append('text').attr('x', width / 2).attr('y', 18)
    .attr('text-anchor', 'middle').attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.1em')
    .text('TOP TITLES BY GLOBAL SALES (M)');

  return { sqGroup, enGroup };
}

export function update(refs, step) {
  const t = d3.transition().duration(600).ease(d3.easeCubicOut);

  if (step >= 3) {
    const { sqGroup, enGroup } = refs;
    [sqGroup, enGroup].forEach(grp => {
      grp.bars.transition(t).delay((d, i) => i * 50)
        .attr('width', d => grp.xScale(d.sales))
        .attr('opacity', 0.9);
      grp.valLabels.transition(d3.transition().duration(400).delay(600))
        .attr('opacity', 0.9);
    });
  }
}
