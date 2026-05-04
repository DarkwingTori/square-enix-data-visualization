import * as d3 from 'd3';
import { MERGER_YEAR } from './constants';

// Deduplicate tidy rows → one row per title
export function rollupTitles(rows) {
  return d3.rollups(
    rows,
    group => {
      const g0 = group[0];
      const sales = d3.max(group, d => +d.sales || 0) || 0;
      return {
        title:        g0.title,
        series:       g0.series || 'Standalone',
        company_era:  g0.company_era,
        developer:    g0.developer,
        genre:        g0.genre,
        subgenre:     g0.subgenre,
        dimension:    g0.dimension,
        release_year: +g0.release_year,
        japan_only:   g0.japan_only === 'True' || g0.japan_only === true,
        platforms:    [...new Set(group.map(d => d.platform_family).filter(Boolean))],
        platform_count: new Set(group.map(d => d.platform_family).filter(Boolean)).size,
        total_sales:  sales,
        avg_critic:   d3.mean(group, d => +d.critic_score || null) || null,
        exclusivity:  g0.exclusivity_status,
        nin_era:      g0.nintendo_relationship_era,
        regions:      [...new Set(group.map(d => d.region).filter(Boolean))],
      };
    },
    d => d.title,
  ).map(([, v]) => v).filter(t => t.title && t.release_year);
}

// [{year, nintendo, playstation, pc, microsoft, ...}]
export function platformReleasesPerYear(rows, startYear = 1986, endYear = 2009) {
  const titles = rollupTitles(rows);
  return d3.range(startYear, endYear + 1).map(yr => {
    const forYear = titles.filter(t => t.release_year === yr);
    return {
      year:        yr,
      nintendo:    forYear.filter(t => t.platforms.includes('Nintendo')).length,
      playstation: forYear.filter(t => t.platforms.includes('PlayStation')).length,
      pc:          forYear.filter(t => t.platforms.includes('PC')).length,
      microsoft:   forYear.filter(t => t.platforms.includes('Microsoft')).length,
      mobile:      forYear.filter(t => t.platforms.includes('Mobile')).length,
      total:       forYear.length,
    };
  });
}

// Per-era stats for stat cards
export function companyStats(rows) {
  const titles = rollupTitles(rows);
  return ['Squaresoft', 'Enix', 'Square Enix'].map(era => {
    const g = titles.filter(t => t.company_era === era);
    const genreCounts = d3.rollups(g.filter(t => t.genre), gr => gr.length, d => d.genre)
      .sort((a, b) => b[1] - a[1]);
    const totalTitles = g.length;
    return {
      era,
      totalTitles,
      avgCritic:   d3.mean(g.filter(t => t.avg_critic), t => t.avg_critic) || 0,
      totalSales:  d3.sum(g, t => t.total_sales),
      japanOnlyPct: g.filter(t => t.japan_only).length / (totalTitles || 1),
      platformDiversity: d3.mean(g, t => t.platform_count) || 0,
      titlesPerYear: totalTitles / (era === 'Squaresoft' ? 16 : era === 'Enix' ? 17 : 21),
      topFranchise: genreCounts[0]?.[0] || '—',
      genreCounts,
    };
  });
}

// Genre counts per year for streamgraph
export function genreByYear(rows) {
  const titles = rollupTitles(rows).filter(t => t.release_year >= 1987 && t.release_year <= 2024 && t.genre);
  const genres = [...new Set(titles.map(t => t.genre))].filter(Boolean);
  const years  = d3.range(1987, 2025);
  const nested = d3.rollups(titles, g => g.length, d => d.release_year, d => d.genre);
  const yearMap = new Map(nested.map(([yr, gMap]) => [yr, new Map(gMap)]));
  return years.map(yr => {
    const row = { year: yr };
    for (const g of genres) row[g] = yearMap.get(yr)?.get(g) || 0;
    return row;
  });
}

export function getGenreKeys(rows) {
  const titles = rollupTitles(rows).filter(t => t.genre);
  return d3.rollups(titles, g => g.length, d => d.genre)
    .sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

// Exclusivity breakdown per era
export function exclusivityByEra(rows) {
  const titles = rollupTitles(rows);
  return ['Squaresoft', 'Enix', 'Square Enix'].map(era => {
    const g = titles.filter(t => t.company_era === era && t.exclusivity);
    const total = g.length || 1;
    const exclusive = g.filter(t => t.exclusivity === 'Exclusive').length;
    const multi     = g.filter(t => t.exclusivity === 'Multiplatform').length;
    return {
      era,
      total,
      exclusive,
      multi,
      exclusivePct: exclusive / total,
      multiPct:     multi / total,
    };
  });
}

// Pre vs Post merger scorecard
export function mergerScorecard(rows) {
  const titles = rollupTitles(rows);
  const pre  = titles.filter(t => t.release_year < MERGER_YEAR);
  const post = titles.filter(t => t.release_year >= MERGER_YEAR);

  const stats = group => ({
    totalTitles:   group.length,
    avgCritic:     d3.mean(group.filter(t => t.avg_critic), t => t.avg_critic) || 0,
    platformCount: new Set(group.flatMap(t => t.platforms)).size,
    titlesPerYear: group.length / (group.length > 0 ? d3.extent(group.map(t => t.release_year))[1] - d3.extent(group.map(t => t.release_year))[0] + 1 : 1),
    japanOnlyPct:  group.filter(t => t.japan_only).length / (group.length || 1),
  });

  return { pre: stats(pre), post: stats(post) };
}

// Platform dot data for Cold War timeline (one dot per game × platform)
export function coldWarDots(rows) {
  const titles = rollupTitles(rows).filter(t => t.release_year >= 1987 && t.release_year <= 2005);
  const dots = [];
  for (const t of titles) {
    for (const p of t.platforms) {
      dots.push({
        title:    t.title,
        year:     t.release_year,
        platform: p,
        series:   t.series,
        sales:    t.total_sales,
        critic:   t.avg_critic,
        era:      t.company_era,
      });
    }
  }
  return dots;
}

// Franchise platform history (for Gantt-style bars in Act 5)
export function franchisePlatformHistory(rows, franchiseName) {
  const titles = rollupTitles(rows).filter(t => t.series === franchiseName || t.series?.startsWith(franchiseName));
  return titles.sort((a, b) => a.release_year - b.release_year).map(t => ({
    title:    t.title,
    year:     t.release_year,
    platforms: t.platforms,
    sales:    t.total_sales,
    critic:   t.avg_critic,
  }));
}

// Avg critic score per year
export function avgScoreByYear(rows) {
  const titles = rollupTitles(rows).filter(t => t.avg_critic && t.release_year >= 1987 && t.release_year <= 2024);
  return d3.rollups(titles,
    g => ({ avg: d3.mean(g, t => t.avg_critic), count: g.length, era: g[0].company_era }),
    t => t.release_year
  ).map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year - b.year);
}

// Platform share pre vs post merger
export function platformShift(rows) {
  const titles = rollupTitles(rows);
  const pre  = titles.filter(t => t.release_year < MERGER_YEAR);
  const post = titles.filter(t => t.release_year >= MERGER_YEAR);
  const platforms = [...new Set(titles.flatMap(t => t.platforms))].filter(Boolean);
  const pct = (list, p) => list.filter(t => t.platforms.includes(p)).length / (list.length || 1);
  return platforms.map(p => ({
    platform:  p,
    prePct:    pct(pre,  p),
    postPct:   pct(post, p),
    preCount:  pre.filter(t => t.platforms.includes(p)).length,
    postCount: post.filter(t => t.platforms.includes(p)).length,
  })).filter(d => d.preCount + d.postCount > 3);
}

// 2D vs 3D per year (derived: pre-1997 assumed 2D, post-1997 assumed 3D, except handheld)
export function dimensionByYear(rows) {
  const titles = rollupTitles(rows).filter(t => t.release_year >= 1987 && t.release_year <= 2024);
  return d3.range(1987, 2025).map(yr => {
    const forYear = titles.filter(t => t.release_year === yr);
    const d2 = forYear.filter(t => t.release_year < 1997 || t.dimension === '2D').length;
    const d3c = forYear.filter(t => t.release_year >= 1997 && t.dimension !== '2D').length;
    return { year: yr, '2D': d2, '3D': d3c };
  });
}
