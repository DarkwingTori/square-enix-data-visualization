import * as d3 from 'd3';
import { ERA_COLORS } from '../../data/constants';

export function init(svgEl, scorecard, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);

  const cx    = width / 2;
  const topY  = height * 0.22;
  const midY  = height * 0.5;
  const botY  = height * 0.78;
  const merge = width * 0.5;

  // Stream paths: Square (top-left → merge), Enix (bottom-left → merge), merged (merge → right)
  const squarePath = `M ${width * 0.05},${topY} C ${merge * 0.6},${topY} ${merge * 0.9},${midY} ${merge},${midY}`;
  const enixPath   = `M ${width * 0.05},${botY} C ${merge * 0.6},${botY} ${merge * 0.9},${midY} ${merge},${midY}`;
  const mergedPath = `M ${merge},${midY} C ${merge * 1.1},${midY} ${width * 0.7},${midY} ${width * 0.95},${midY}`;

  const squareLine = svg.append('path').attr('d', squarePath)
    .attr('fill', 'none').attr('stroke', ERA_COLORS.Squaresoft).attr('stroke-width', 4)
    .attr('stroke-opacity', 0);

  const enixLine = svg.append('path').attr('d', enixPath)
    .attr('fill', 'none').attr('stroke', ERA_COLORS.Enix).attr('stroke-width', 4)
    .attr('stroke-opacity', 0);

  const mergedLine = svg.append('path').attr('d', mergedPath)
    .attr('fill', 'none').attr('stroke', ERA_COLORS['Square Enix']).attr('stroke-width', 6)
    .attr('stroke-opacity', 0);

  // Labels on streams
  svg.append('text').attr('x', width * 0.08).attr('y', topY - 16)
    .attr('fill', ERA_COLORS.Squaresoft).attr('font-size', '11px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.1em')
    .text('SQUARESOFT').attr('opacity', 0).attr('class', 'sq-lbl');

  svg.append('text').attr('x', width * 0.08).attr('y', botY + 24)
    .attr('fill', ERA_COLORS.Enix).attr('font-size', '11px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.1em')
    .text('ENIX').attr('opacity', 0).attr('class', 'en-lbl');

  svg.append('text').attr('x', merge + 20).attr('y', midY - 16)
    .attr('fill', ERA_COLORS['Square Enix']).attr('font-size', '12px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.1em')
    .text('SQUARE ENIX').attr('opacity', 0).attr('class', 'se-lbl');

  // Merge dot
  const mergeCircle = svg.append('circle')
    .attr('cx', merge).attr('cy', midY).attr('r', 0)
    .attr('fill', ERA_COLORS['Square Enix']).attr('fill-opacity', 0.7);

  // Stats annotation
  const statsGroup = svg.append('g').attr('class', 'merger-stats').attr('opacity', 0);

  const stats = [
    `${scorecard?.pre?.totalTitles || '?'}  +  ${scorecard?.post?.totalTitles || '?'} Titles`,
    `2 Companies → 1`,
    `7 Platforms`,
  ];
  stats.forEach((s, i) => {
    statsGroup.append('text')
      .attr('x', merge).attr('y', midY + 40 + i * 20)
      .attr('text-anchor', 'middle')
      .attr('fill', i === 1 ? ERA_COLORS['Square Enix'] : '#b0b0d0')
      .attr('font-size', i === 1 ? '13px' : '11px')
      .attr('font-family', i === 1 ? 'var(--font-display)' : 'var(--font-body)')
      .attr('letter-spacing', '0.05em')
      .text(s);
  });

  return { squareLine, enixLine, mergedLine, mergeCircle, statsGroup, svg };
}

export function update(refs, step) {
  const { squareLine, enixLine, mergedLine, mergeCircle, statsGroup, svg } = refs;
  const t = d3.transition().duration(800).ease(d3.easeCubicOut);

  switch (step) {
    case 0:
      svg.selectAll('.sq-lbl').transition(t).attr('opacity', 0.9);
      svg.selectAll('.en-lbl').transition(t).attr('opacity', 0.9);
      squareLine.transition(t).attr('stroke-opacity', 0.7);
      enixLine.transition(t).attr('stroke-opacity', 0.7);
      break;
    case 1:
      squareLine.transition(t).attr('stroke-opacity', 0.7);
      enixLine.transition(t).attr('stroke-opacity', 0.7);
      svg.selectAll('.sq-lbl, .en-lbl').attr('opacity', 0.9);
      mergeCircle.transition(t).attr('r', 14);
      mergedLine.transition(t).attr('stroke-opacity', 0.9);
      svg.selectAll('.se-lbl').transition(t).attr('opacity', 1);
      break;
    case 2:
    case 3:
      squareLine.attr('stroke-opacity', 0.5);
      enixLine.attr('stroke-opacity', 0.5);
      mergeCircle.attr('r', 14);
      mergedLine.attr('stroke-opacity', 0.9);
      svg.selectAll('.sq-lbl, .en-lbl').attr('opacity', 0.6);
      svg.selectAll('.se-lbl').attr('opacity', 1);
      statsGroup.transition(t).attr('opacity', 1);
      break;
  }
}
