import * as d3 from 'd3';
import { ERA_COLORS, FRANCHISE_COLORS } from '../data/constants';
import { TOP_GAMES } from '../data/franchiseSales';

const YEAR_START = 1986;
const YEAR_END   = 2024;
const YEAR_MERGE = 2003;

// Radius scale by sales (millions)
const rScale = d3.scaleSqrt().domain([0, 24]).range([4.5, 15]);

// Build sales lookup from hardcoded data
const SALES_MAP = new Map(TOP_GAMES.map(g => [g.title.toLowerCase(), g.sales]));

function getRadius(title) {
  const s = SALES_MAP.get(title.toLowerCase());
  return s ? rScale(s) : 4.5;
}

// Exact title matches only — one label per entry, first-come-first-served
// Keep this list SHORT so the chart stays clean
const LANDMARK_MAP = new Map([
  ['chrono trigger',       { short: 'Chrono Trigger', side: 'above' }],
  ['final fantasy vii',    { short: 'FF VII',         side: 'above' }],
  ['final fantasy x',      { short: 'FF X',           side: 'below' }],
  ['dragon quest iii',     { short: 'DQ III',         side: 'below' }],
  ['final fantasy xiv',    { short: 'FF XIV',         side: 'above' }],
  ['nier: automata',       { short: 'NieR:Automata',  side: 'below' }],
]);

function makeLandmarkFinder() {
  const used = new Set();
  return function findLandmark(title) {
    const key = title.toLowerCase().trim();
    if (used.has(key)) return null;
    const lm = LANDMARK_MAP.get(key);
    if (lm) used.add(key);
    return lm || null;
  };
}

const ERA_ORDER = ['Squaresoft', 'Enix', 'Square Enix'];

export function init(svgEl, titles, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);

  const PAD_L = 104;
  const PAD_R = 24;
  const W     = width - PAD_L - PAD_R;

  const xScale = d3.scaleLinear().domain([YEAR_START, YEAR_END]).range([0, W]);
  const mergeX = xScale(YEAR_MERGE);

  const ROW_Y = {
    'Squaresoft':   height * 0.22,
    'Enix':         height * 0.50,
    'Square Enix':  height * 0.78,
  };
  const BAND_H = height * 0.22;

  const g = svg.append('g').attr('transform', `translate(${PAD_L},0)`);

  // ── Defs: clip + per-era gradient bands ───────────────────────────────────
  const defs = svg.append('defs');

  defs.append('clipPath').attr('id', 'era-chart-clip')
    .append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', height);
  ERA_ORDER.forEach(era => {
    const col = ERA_COLORS[era] || '#888';
    const gid = `band-${era.replace(/\s/g, '-')}`;
    const grad = defs.append('linearGradient')
      .attr('id', gid)
      .attr('x1', '0%').attr('x2', '0%')
      .attr('y1', '0%').attr('y2', '100%');
    grad.append('stop').attr('offset', '0%')  .attr('stop-color', col).attr('stop-opacity', 0);
    grad.append('stop').attr('offset', '45%') .attr('stop-color', col).attr('stop-opacity', 0.08);
    grad.append('stop').attr('offset', '55%') .attr('stop-color', col).attr('stop-opacity', 0.08);
    grad.append('stop').attr('offset', '100%').attr('stop-color', col).attr('stop-opacity', 0);
  });

  // ── Era bands ──────────────────────────────────────────────────────────────
  ERA_ORDER.forEach(era => {
    const gid = `band-${era.replace(/\s/g, '-')}`;
    g.append('rect')
      .attr('x', 0).attr('y', ROW_Y[era] - BAND_H / 2)
      .attr('width', W).attr('height', BAND_H)
      .attr('fill', `url(#${gid})`);
  });

  // ── Year ticks ─────────────────────────────────────────────────────────────
  d3.range(1988, 2025, 4).forEach(yr => {
    g.append('line')
      .attr('x1', xScale(yr)).attr('x2', xScale(yr))
      .attr('y1', 8).attr('y2', height - 18)
      .attr('stroke', '#12122a').attr('stroke-width', 0.75);
    g.append('text')
      .attr('x', xScale(yr)).attr('y', height - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#2e2e50').attr('font-size', '8px')
      .attr('font-family', 'var(--font-body)')
      .text(yr);
  });

  // ── Era labels (left) ──────────────────────────────────────────────────────
  const ERA_RANGES = { 'Squaresoft': '1987–2002', 'Enix': '1986–2002', 'Square Enix': '2003–2024' };
  ERA_ORDER.forEach(era => {
    const col = ERA_COLORS[era] || '#aaa';
    const ry  = ROW_Y[era];
    g.append('text')
      .attr('x', -8).attr('y', ry - 5)
      .attr('text-anchor', 'end')
      .attr('fill', col)
      .attr('font-size', '9.5px')
      .attr('font-family', 'var(--font-display)')
      .attr('letter-spacing', '0.1em')
      .text(era.toUpperCase());
    g.append('text')
      .attr('x', -8).attr('y', ry + 8)
      .attr('text-anchor', 'end')
      .attr('fill', col)
      .attr('fill-opacity', 0.4)
      .attr('font-size', '7.5px')
      .attr('font-family', 'var(--font-body)')
      .text(ERA_RANGES[era]);
  });

  // ── Merger line ────────────────────────────────────────────────────────────
  g.append('line')
    .attr('x1', mergeX).attr('x2', mergeX)
    .attr('y1', 10).attr('y2', height - 20)
    .attr('stroke', ERA_COLORS['Square Enix'])
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3')
    .attr('opacity', 0.5);

  g.append('text')
    .attr('x', mergeX + 5).attr('y', 16)
    .attr('fill', ERA_COLORS['Square Enix'])
    .attr('font-size', '8px')
    .attr('font-family', 'var(--font-display)')
    .attr('letter-spacing', '0.07em')
    .text('MERGER 2003');

  // ── Merger convergence curves ──────────────────────────────────────────────
  // Squaresoft + Enix arcs converge into Square Enix row at merger point
  const sqenixY = ROW_Y['Square Enix'];
  const curveEndX = mergeX + W * 0.035;

  const mergePaths = ['Squaresoft', 'Enix'].map(era => {
    const startY = ROW_Y[era];
    const col    = ERA_COLORS[era];
    const pathD  = `M ${mergeX} ${startY} C ${mergeX + 28} ${startY}, ${mergeX + 28} ${sqenixY}, ${curveEndX} ${sqenixY}`;
    const el = g.append('path')
      .attr('d', pathD)
      .attr('fill', 'none')
      .attr('stroke', col)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.45);

    const totalLength = el.node().getTotalLength();
    el.attr('stroke-dasharray', totalLength)
      .attr('stroke-dashoffset', totalLength);

    return { el, length: totalLength };
  });

  // ── Node groups ────────────────────────────────────────────────────────────
  const nodeGroups = {};
  ERA_ORDER.forEach(era => { nodeGroups[era] = g.append('g').attr('clip-path', 'url(#era-chart-clip)'); });

  const findLandmark = makeLandmarkFinder();

  const eraTitles = {
    'Squaresoft':   titles.filter(t => t.company_era === 'Squaresoft'),
    'Enix':         titles.filter(t => t.company_era === 'Enix'),
    // Guard against misclassified rows that predate the merger
    'Square Enix':  titles.filter(t => t.company_era === 'Square Enix' && t.release_year >= 2003),
  };

  const landmarkNodes = [];

  ERA_ORDER.forEach(era => {
    const ry   = ROW_Y[era];
    const ng   = nodeGroups[era];
    const col  = ERA_COLORS[era];
    const list = eraTitles[era];

    list.forEach((t, i) => {
      const x  = xScale(t.release_year);
      const jy = ((t.title.charCodeAt(0) * 31 + t.release_year * 17 + i * 11) % 100) / 100;
      const y  = ry + (jy - 0.5) * BAND_H * 0.52;
      const r  = getRadius(t.title);
      const fc = FRANCHISE_COLORS[t.series] || col;
      const lm = findLandmark(t.title);

      ng.append('circle')
        .datum({ ...t, _x: x, _y: y, _r: r, _era: era })
        .attr('cx', x).attr('cy', y)
        .attr('r', r)
        .attr('fill', fc)
        .attr('fill-opacity', lm ? 0.9 : 0.65)
        .attr('stroke', lm ? fc : 'none')
        .attr('stroke-width', lm ? 1.5 : 0)
        .attr('stroke-opacity', 0.7)
        .attr('opacity', 0);

      if (lm) {
        landmarkNodes.push({ t, x, y, r, fc, lm });
      }
    });
  });

  // ── Landmark labels ────────────────────────────────────────────────────────
  const labelGroup = g.append('g').attr('class', 'landmarks').attr('clip-path', 'url(#era-chart-clip)');

  landmarkNodes.forEach(({ t, x, y, r, fc, lm }) => {
    const above   = lm.side === 'above';
    const lineY1  = above ? y - r - 2  : y + r + 2;
    const lineY2  = above ? y - r - 10 : y + r + 10;
    const textY   = above ? y - r - 17 : y + r + 22;

    labelGroup.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', lineY1).attr('y2', lineY2)
      .attr('stroke', fc).attr('stroke-opacity', 0.45)
      .attr('stroke-width', 1)
      .attr('opacity', 0);

    labelGroup.append('text')
      .attr('x', x).attr('y', textY)
      .attr('text-anchor', 'middle')
      .attr('fill', fc)
      .attr('fill-opacity', 0.9)
      .attr('font-size', '8.5px')
      .attr('font-family', 'var(--font-display)')
      .attr('letter-spacing', '0.05em')
      .text(lm.short)
      .attr('opacity', 0);
  });

  return { g, nodeGroups, labelGroup, mergePaths };
}

export function revealAll(refs) {
  const { nodeGroups, labelGroup, mergePaths } = refs;
  const t = d3.transition;

  ERA_ORDER.forEach(era => {
    nodeGroups[era].selectAll('circle')
      .transition()
      .duration(380)
      .delay(d => {
        const base = (d.release_year - YEAR_START) * 16;
        return era === 'Square Enix' ? base + 300 : base;
      })
      .attr('opacity', 1);
  });

  // Labels appear after the main dot wave
  labelGroup.selectAll('text, line')
    .transition()
    .duration(400)
    .delay(1300)
    .attr('opacity', function() {
      return this.tagName === 'text' ? 0.9 : 0.45;
    });

  // Merger curves draw in after dots
  mergePaths.forEach(({ el, length }, i) => {
    el.transition()
      .duration(700)
      .delay(1400 + i * 100)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);
  });
}

// Kept for backwards compat — Hero.jsx doesn't use it but avoids import errors
export function reveal(refs, era) {
  if (!refs?.nodeGroups?.[era]) return;
  refs.nodeGroups[era].selectAll('circle')
    .transition().duration(380)
    .delay((d, i) => i * 14)
    .attr('opacity', 1);
}
