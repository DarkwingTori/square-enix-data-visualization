import * as d3 from 'd3';

const M = { top: 72, right: 40, bottom: 48, left: 40 };
const YEAR_START = 1987;
const YEAR_END   = 2005;
const COLD_START = 1997;
const COLD_END   = 2002;

const N_COLOR  = '#e60012';
const PS_COLOR = '#4169e1';

const LANDMARKS = [
  { year: 1995, platform: 'Nintendo',     label: 'Chrono\nTrigger' },
  { year: 1997, platform: 'PlayStation',  label: 'FF VII' },
  { year: 1999, platform: 'PlayStation',  label: 'FF VIII' },
  { year: 2000, platform: 'PlayStation',  label: 'FF IX' },
  { year: 2001, platform: 'PlayStation',  label: 'FF X' },
  { year: 2003, platform: 'Nintendo',     label: 'Crystal\nChronicles' },
];

function buildCounts(dots) {
  const years = d3.range(YEAR_START, YEAR_END + 1);
  const map = {};
  years.forEach(y => { map[y] = { nintendo: 0, playstation: 0 }; });
  dots.forEach(d => {
    if (!map[d.year]) return;
    if (d.platform === 'Nintendo')     map[d.year].nintendo++;
    if (d.platform === 'PlayStation')  map[d.year].playstation++;
  });
  return years.map(y => ({ year: y, ...map[y] }));
}

export function init(svgEl, dots, dims) {
  const { width, height } = dims;
  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl).attr('width', width).attr('height', height);

  const W = width  - M.left - M.right;
  const H = height - M.top  - M.bottom;
  const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const counts = buildCounts(dots);
  const maxCount = d3.max(counts, d => Math.max(d.nintendo, d.playstation)) || 1;

  const xBand = d3.scaleBand()
    .domain(counts.map(d => d.year))
    .range([0, W])
    .padding(0.18);

  const barMax = H / 2 - 20;
  const barH = d3.scaleLinear().domain([0, maxCount]).range([0, barMax]);

  const centerY = H / 2;

  // Cold war zone background (rendered first so bars appear above)
  const cwX = xBand(COLD_START);
  const cwW = (xBand(COLD_END) + xBand.bandwidth()) - xBand(COLD_START);

  const coldZone = g.append('rect').attr('class', 'cold-zone')
    .attr('x', cwX).attr('y', 0)
    .attr('width', cwW).attr('height', H)
    .attr('fill', 'rgba(230,0,18,0.10)')
    .attr('opacity', 0);

  // Dividing midline
  g.append('line')
    .attr('x1', 0).attr('x2', W)
    .attr('y1', centerY).attr('y2', centerY)
    .attr('stroke', 'rgba(255,255,255,0.12)')
    .attr('stroke-width', 1);

  // Platform labels on left
  const nLabel = g.append('text')
    .attr('x', -8).attr('y', centerY - barMax / 2)
    .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
    .attr('fill', N_COLOR).attr('font-size', '10px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.08em')
    .text('NINTENDO')
    .attr('opacity', 0);

  const psLabel = g.append('text')
    .attr('x', -8).attr('y', centerY + barMax / 2)
    .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
    .attr('fill', PS_COLOR).attr('font-size', '10px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.08em')
    .text('PLAYSTATION')
    .attr('opacity', 0);

  // Nintendo bars (rise upward)
  const nintendoBars = g.selectAll('.bar-n')
    .data(counts)
    .join('rect')
    .attr('class', 'bar-n')
    .attr('x', d => xBand(d.year))
    .attr('width', xBand.bandwidth())
    .attr('y', centerY)
    .attr('height', 0)
    .attr('fill', N_COLOR)
    .attr('fill-opacity', 0.75)
    .attr('rx', 1)
    .attr('opacity', 0);

  // PlayStation bars (fall downward)
  const playstationBars = g.selectAll('.bar-ps')
    .data(counts)
    .join('rect')
    .attr('class', 'bar-ps')
    .attr('x', d => xBand(d.year))
    .attr('width', xBand.bandwidth())
    .attr('y', centerY)
    .attr('height', 0)
    .attr('fill', PS_COLOR)
    .attr('fill-opacity', 0.75)
    .attr('rx', 1)
    .attr('opacity', 0);

  // X-axis year labels
  const tickYears = d3.range(YEAR_START, YEAR_END + 1, 2);
  const xAxis = g.append('g').attr('transform', `translate(0,${centerY})`);
  tickYears.forEach(yr => {
    xAxis.append('text')
      .attr('x', xBand(yr) + xBand.bandwidth() / 2)
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5a5a7a')
      .attr('font-size', '9px')
      .attr('font-family', 'var(--font-body)')
      .text(yr);
  });

  // Cold war label above zone
  const coldLabel = g.append('text').attr('class', 'cold-label')
    .attr('x', cwX + cwW / 2).attr('y', -32)
    .attr('text-anchor', 'middle')
    .attr('fill', N_COLOR).attr('font-size', '10px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.14em')
    .text('THE COLD WAR')
    .attr('opacity', 0);

  const silenceLabel = g.append('text').attr('class', 'silence-label')
    .attr('x', cwX + cwW / 2).attr('y', -18)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(230,0,18,0.6)').attr('font-size', '8px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.1em')
    .text('5 YEARS OF SILENCE ON NINTENDO')
    .attr('opacity', 0);

  // Landmark annotations
  const landmarkGroup = g.append('g').attr('class', 'landmarks').attr('opacity', 0);

  LANDMARKS.forEach(lm => {
    const bw = xBand.bandwidth();
    const cx = xBand(lm.year) + bw / 2;
    const count = lm.platform === 'Nintendo'
      ? counts.find(d => d.year === lm.year)?.nintendo || 0
      : counts.find(d => d.year === lm.year)?.playstation || 0;
    const bHt = barH(count);
    const isNintendo = lm.platform === 'Nintendo';
    const tipY = isNintendo ? centerY - bHt - 6 : centerY + bHt + 6;
    const anchor = 'middle';
    const lines = lm.label.split('\n');

    lines.forEach((line, i) => {
      const yOff = isNintendo
        ? tipY - (lines.length - 1 - i) * 11
        : tipY + i * 11;
      landmarkGroup.append('text')
        .attr('x', cx).attr('y', yOff)
        .attr('text-anchor', anchor)
        .attr('fill', isNintendo ? N_COLOR : PS_COLOR)
        .attr('font-size', '8px')
        .attr('font-family', 'var(--font-display)')
        .attr('letter-spacing', '0.06em')
        .text(line);
    });

    // Tick line from bar tip
    landmarkGroup.append('line')
      .attr('x1', cx).attr('x2', cx)
      .attr('y1', isNintendo ? centerY - bHt : centerY + bHt)
      .attr('y2', isNintendo ? tipY + 2 : tipY - 2)
      .attr('stroke', isNintendo ? N_COLOR : PS_COLOR)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 0.75)
      .attr('stroke-dasharray', '2,2');
  });

  // Crystal Chronicles highlight (step 3)
  const crystalAnnotation = g.append('g').attr('class', 'crystal-annotation').attr('opacity', 0);
  const ccYear = 2003;
  const ccCount = counts.find(d => d.year === ccYear)?.nintendo || 0;
  const ccBHt = barH(ccCount);
  const ccX = xBand(ccYear) + xBand.bandwidth() / 2;

  crystalAnnotation.append('rect')
    .attr('x', xBand(ccYear) - 2)
    .attr('y', centerY - ccBHt - 4)
    .attr('width', xBand.bandwidth() + 4)
    .attr('height', ccBHt + 4)
    .attr('fill', 'none')
    .attr('stroke', N_COLOR)
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.8)
    .attr('rx', 2);

  crystalAnnotation.append('text')
    .attr('x', ccX).attr('y', centerY - ccBHt - 14)
    .attr('text-anchor', 'middle')
    .attr('fill', '#f0f0fa').attr('font-size', '9px')
    .attr('font-family', 'var(--font-display)').attr('letter-spacing', '0.08em')
    .text('NINTENDO RETURNS');

  // Chart title
  svg.append('text').attr('x', width / 2).attr('y', 22)
    .attr('text-anchor', 'middle').attr('fill', '#f0f0fa')
    .attr('font-family', 'var(--font-display)').attr('font-size', '11px')
    .attr('letter-spacing', '0.12em')
    .text('RELEASES PER YEAR — NINTENDO vs PLAYSTATION');

  svg.append('text').attr('x', width / 2).attr('y', 38)
    .attr('text-anchor', 'middle').attr('fill', '#5a5a7a')
    .attr('font-family', 'var(--font-body)').attr('font-size', '9px')
    .text('bars above center line = Nintendo  ·  bars below = PlayStation');

  return {
    nintendoBars, playstationBars, coldZone, coldLabel, silenceLabel,
    landmarkGroup, crystalAnnotation, nLabel, psLabel, counts, barH, centerY,
  };
}

export function update(refs, step) {
  const { nintendoBars, playstationBars, coldZone, coldLabel, silenceLabel,
          landmarkGroup, crystalAnnotation, nLabel, psLabel, counts, barH, centerY } = refs;
  const t = d3.transition().duration(700).ease(d3.easeCubicOut);

  if (step >= 0) {
    nLabel.transition(t).attr('opacity', 1);
    nintendoBars
      .transition(t)
      .delay((d, i) => i * 30)
      .attr('y', d => centerY - barH(d.nintendo))
      .attr('height', d => barH(d.nintendo))
      .attr('opacity', 1);
  }

  if (step >= 1) {
    psLabel.transition(t).attr('opacity', 1);
    playstationBars
      .transition(t)
      .delay((d, i) => i * 30)
      .attr('height', d => barH(d.playstation))
      .attr('opacity', 1);
  }

  if (step >= 2) {
    coldZone.transition(t).attr('opacity', 1);
    coldLabel.transition(t).attr('opacity', 1);
    silenceLabel.transition(t).attr('opacity', 1);
    landmarkGroup.transition(t).attr('opacity', 1);
  } else {
    coldZone.transition(t).attr('opacity', 0);
    coldLabel.transition(t).attr('opacity', 0);
    silenceLabel.transition(t).attr('opacity', 0);
    landmarkGroup.transition(t).attr('opacity', 0);
  }

  if (step >= 3) {
    crystalAnnotation.transition(t).attr('opacity', 1);
  } else {
    crystalAnnotation.transition(t).attr('opacity', 0);
  }
}
