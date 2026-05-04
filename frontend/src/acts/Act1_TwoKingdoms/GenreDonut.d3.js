import * as d3 from 'd3';
import { GENRE_COLORS, ERA_COLORS } from '../../data/constants';

export function init(svgEl, statsData, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);

  const eras = statsData.filter(s => s.era !== 'Square Enix');
  const colW = width / eras.length;
  const R    = Math.min(colW, height) * 0.34;
  const innerR = R * 0.42;

  const arc     = d3.arc().innerRadius(innerR).outerRadius(R);
  const arcHover= d3.arc().innerRadius(innerR).outerRadius(R * 1.06);
  const pie     = d3.pie().value(d => d[1]).sort((a, b) => b[1] - a[1]);

  const groups = [];

  eras.forEach((stat, eraIdx) => {
    const cx = colW * eraIdx + colW / 2;
    const cy = height / 2 - 20;
    const g  = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    const slices = stat.genreCounts.slice(0, 8);
    const total  = d3.sum(slices, d => d[1]);

    const paths = g.selectAll('.arc-path')
      .data(pie(slices))
      .join('path')
      .attr('class', 'arc-path')
      .attr('fill', d => GENRE_COLORS[d.data[0]] || '#666')
      .attr('stroke', '#060608')
      .attr('stroke-width', 1.5)
      .attr('d', arc)
      .attr('opacity', 0)
      .style('cursor', 'pointer');

    // Center label
    g.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', ERA_COLORS[stat.era] || '#aaa')
      .attr('font-family', 'var(--font-display)')
      .attr('font-size', '11px')
      .attr('letter-spacing', '0.1em')
      .text(stat.era === 'Squaresoft' ? 'SQUARE' : stat.era.toUpperCase());

    // Legend below donut
    const legendG = svg.append('g').attr('class', 'donut-legend').attr('opacity', 0);
    slices.forEach(([genre, count], i) => {
      const col = Math.floor(i / 4);
      const row = i % 4;
      const lx  = cx - colW * 0.38 + col * (colW * 0.42);
      const ly  = cy + R + 20 + row * 16;
      const pct = ((count / total) * 100).toFixed(0);

      legendG.append('rect')
        .attr('x', lx).attr('y', ly - 5).attr('width', 8).attr('height', 8)
        .attr('fill', GENRE_COLORS[genre] || '#666').attr('rx', 1);
      legendG.append('text')
        .attr('x', lx + 11).attr('y', ly + 1)
        .attr('fill', '#9898c0').attr('font-size', '9px')
        .attr('dominant-baseline', 'central')
        .text(`${genre} ${pct}%`);
    });

    groups.push({ paths, legendG, era: stat.era });
  });

  return { groups };
}

export function update(refs, step) {
  const t = d3.transition().duration(700).ease(d3.easeCubicOut);
  refs.groups.forEach(({ paths, legendG }) => {
    if (step >= 1) {
      paths.transition(t).delay((d, i) => i * 60).attr('opacity', 0.85);
    }
    if (step >= 2) {
      legendG.transition(t).attr('opacity', 1);
    }
  });
}
