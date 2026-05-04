import { useRef, useEffect } from 'react';

export function useD3(initFn, updateFn, { data, dims, step }) {
  const svgRef  = useRef(null);
  const refsRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !data || !dims.width || !dims.height) return;
    refsRef.current = initFn(svgRef.current, data, dims);
    updateFn(refsRef.current, step);
  }, [data, dims.width, dims.height]); // eslint-disable-line

  useEffect(() => {
    if (!refsRef.current) return;
    updateFn(refsRef.current, step);
  }, [step]); // eslint-disable-line

  return { svgRef };
}
