import { useState, useEffect } from 'react';
import * as d3 from 'd3';

export function useGameData() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    d3.csv('/data/squareenix_games.csv')
      .then(rows => {
        setData(rows);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
