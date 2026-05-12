import { useEffect, useRef, useState } from 'react';
import { fetchLowestEver } from '../api';
import type { Filters, Sailing } from '../types';

export function useLowestEver(filters: Filters) {
  const [sailings, setSailings] = useState<Sailing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresCabinFilter, setRequiresCabinFilter] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLowestEver(filters);
        setSailings(data.sailings);
        setTotal(data.total);
        setRequiresCabinFilter(data.requiresCabinFilter);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  return { sailings, total, loading, error, requiresCabinFilter };
}
