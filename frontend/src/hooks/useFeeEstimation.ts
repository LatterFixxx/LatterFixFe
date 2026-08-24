/**
 * useFeeEstimation Hook
 *
 * React Query hook that polls Horizon fee statistics every 10 seconds and
 * exposes a processed fee recommendation plus a batch estimator helper. Also
 * exposes a comprehensive preflight balance check for a payroll batch,
 * ahead of submission.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import {
  getFeeRecommendation,
  estimateBatchPaymentBudget,
  runPreflightCheck,
  type FeeRecommendation,
  type BatchBudgetEstimate,
  type PreflightBatchItem,
  type PreflightCheckResult,
} from '../services/feeEstimation';

/** Query key used by React Query for cache management */
const FEE_ESTIMATION_QUERY_KEY = ['fee-estimation'] as const;

/** Polling interval — refresh fee stats every 10 seconds */
const POLL_INTERVAL_MS = 10_000;

export function useFeeEstimation() {
  const {
    data: feeRecommendation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<FeeRecommendation, Error>({
    queryKey: FEE_ESTIMATION_QUERY_KEY,
    queryFn: getFeeRecommendation,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  /**
   * Convenience wrapper that estimates the total fee budget for a batch
   * of `count` payroll transactions.
   */
  const estimateBatch = useCallback(async (count: number): Promise<BatchBudgetEstimate> => {
    return estimateBatchPaymentBudget(count);
  }, []);

  // ---- Preflight balance check ----
  const [preflightResult, setPreflightResult] = useState<PreflightCheckResult | null>(null);
  const [isPreflightRunning, setIsPreflightRunning] = useState(false);
  const [preflightError, setPreflightError] = useState<Error | null>(null);
  const lastPreflightArgs = useRef<{ orgWallet: string; batch: PreflightBatchItem[] } | null>(
    null
  );

  const runPreflight = useCallback(
    async (orgWallet: string, batch: PreflightBatchItem[]): Promise<PreflightCheckResult> => {
      lastPreflightArgs.current = { orgWallet, batch };
      setIsPreflightRunning(true);
      setPreflightError(null);
      try {
        const result = await runPreflightCheck(orgWallet, batch);
        setPreflightResult(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Preflight check failed');
        setPreflightError(error);
        throw error;
      } finally {
        setIsPreflightRunning(false);
      }
    },
    []
  );

  /** Re-runs the preflight check against the same batch — no page reload needed. */
  const rerunPreflight = useCallback((): Promise<PreflightCheckResult> | null => {
    if (!lastPreflightArgs.current) return null;
    const { orgWallet, batch } = lastPreflightArgs.current;
    return runPreflight(orgWallet, batch);
  }, [runPreflight]);

  return {
    feeRecommendation,
    isLoading,
    isError,
    error,
    refetch,
    estimateBatch,
    preflightResult,
    isPreflightRunning,
    preflightError,
    runPreflight,
    rerunPreflight,
  };
}
