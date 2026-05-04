import { useMemo } from 'react';
import { useGameData } from './data/useGameData';
import {
  rollupTitles,
  companyStats,
  exclusivityByEra,
  coldWarDots,
  mergerScorecard,
  genreByYear,
  getGenreKeys,
  dimensionByYear,
} from './data/transforms';

import Nav     from './components/Nav';
import Tooltip from './components/Tooltip';
import Hero    from './hero/Hero';

import Act1 from './acts/Act1_TwoKingdoms';
import Act2 from './acts/Act2_ColdWar';
import Act3 from './acts/Act3_Merger';
import Act4 from './acts/Act4_Genres';
import Act5 from './acts/Act5_Franchises';
import Act6 from './acts/Act6_Explorer';

export default function App() {
  const { data: rawRows, loading, error } = useGameData();

  const ds = useMemo(() => {
    if (!rawRows) return null;
    const titles    = rollupTitles(rawRows);
    const yearData  = genreByYear(rawRows);
    const genreKeys = getGenreKeys(rawRows);
    return {
      titles,
      rawRows,
      stats:        companyStats(rawRows),
      exclusivity:  exclusivityByEra(rawRows),
      coldWar:      coldWarDots(rawRows),
      scorecard:    mergerScorecard(rawRows),
      genreData:    { yearData, genreKeys },
      dimData:      dimensionByYear(rawRows),
    };
  }, [rawRows]);

  if (loading) {
    return (
      <div className="loading-screen">
        <span>LOADING DATA</span>
        <div className="loading-bar"><div className="loading-bar-fill" /></div>
      </div>
    );
  }

  if (error || !ds) {
    return (
      <div className="loading-screen">
        <span>Failed to load data — check console.</span>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <Hero titles={ds.titles} />
      <Act1 statsData={ds.stats} />
      <Act2 coldWarDots={ds.coldWar} exclusivityData={ds.exclusivity} />
      <Act3 scorecard={ds.scorecard} />
      <Act4 genreData={ds.genreData} dimensionData={ds.dimData} />
      <Act5 rawTitles={ds.titles} rawRows={ds.rawRows} />
      <Act6 titles={ds.titles} />
    </>
  );
}
