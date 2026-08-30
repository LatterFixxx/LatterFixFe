/**
 * Fee Estimation Service
 *
 * Fetches current network fee statistics from the Stellar Horizon API and
 * provides accurate fee recommendations for payroll transactions.
 * Supports fee bumping indicators for high-congestion periods, and a
 * comprehensive preflight balance check before a payroll batch is submitted.
 */

import { isValidPublicKey, loadAccount, type StellarAccountInfo } from './stellar';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 1 XLM = 10,000,000 stroops */
const STROOPS_PER_XLM = 10_000_000;

/** Safety‑margin multiplier per congestion level */
const SAFETY_MARGIN: Record<CongestionLevel, number> = {
  low: 1.0,
  moderate: 1.2,
  high: 1.5,
};

/** Stellar's base reserve per account + per subentry (trustline, offer, etc). */
const BASE_RESERVE_XLM = 0.5;

/** Max concurrent Horizon account lookups when checking a payroll batch. */
const PREFLIGHT_CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw percentile bucket returned by Horizon for both accepted fees & max fee bids */
export interface FeeStatsPercentiles {
  min: string;
  mode: string;
  p10: string;
  p20: string;
  p30: string;
  p40: string;
  p50: string;
  p60: string;
  p70: string;
  p80: string;
  p90: string;
  p95: string;
  p99: string;
  max: string;
}

/** Shape of the JSON body from `GET /fee_stats` */
export interface HorizonFeeStats {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: FeeStatsPercentiles;
  max_fee: FeeStatsPercentiles;
}

/** High‑level congestion classification */
export type CongestionLevel = 'low' | 'moderate' | 'high';

/** Processed fee recommendation for consumers */
export interface FeeRecommendation {
  /** Base fee in stroops defined in the last ledger */
  baseFee: number;
  /** Recommended fee in stroops – smart pick based on congestion */
  recommendedFee: number;
  /** Maximum fee ceiling in stroops (p99) */
  maxFee: number;
  /** Current network congestion classification */
  congestionLevel: CongestionLevel;
  /** Indicates that the user should bump the fee due to high congestion */
  shouldBumpFee: boolean;
  /** Raw ledger capacity usage (0–1) */
  ledgerCapacityUsage: number;
  /** Sequence number of the most recent ledger */
  lastLedger: number;
  /** Recommended fee converted to XLM */
  recommendedFeeXLM: string;
  /** Max fee converted to XLM */
  maxFeeXLM: string;
  /** Base fee converted to XLM */
  baseFeeXLM: string;
}

/** Batch payment budget estimate */
export interface BatchBudgetEstimate {
  /** Number of transactions in the batch */
  transactionCount: number;
  /** Fee per transaction in stroops */
  feePerTransaction: number;
  /** Total budget in stroops (with safety margin) */
  totalBudget: number;
  /** Total budget in XLM */
  totalBudgetXLM: string;
  /** Cost per transaction in XLM */
  feePerTransactionXLM: string;
  /** Safety margin multiplier applied */
  safetyMargin: number;
  /** Congestion level used for calculation */
  congestionLevel: CongestionLevel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts stroops to XLM with 7‑decimal precision.
 */
export function stroopsToXLM(stroops: number): string {
  return (stroops / STROOPS_PER_XLM).toFixed(7);
}

/**
 * Derives a congestion level from the ledger capacity usage ratio.
 *
 * - < 0.25  → low
 * - < 0.75  → moderate
 * - ≥ 0.75  → high
 */
function deriveCongestionLevel(usage: number): CongestionLevel {
  if (usage < 0.25) return 'low';
  if (usage < 0.75) return 'moderate';
  return 'high';
}

/**
 * Resolves the Horizon base URL from the `PUBLIC_STELLAR_HORIZON_URL` env var.
 * Falls back to the public Stellar testnet if the variable is not set.
 */
function getHorizonUrl(): string {
  const envUrl = import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined;
  return envUrl?.replace(/\/+$/, '') || 'https://horizon-testnet.stellar.org';
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Fetches the raw fee statistics from the Horizon `/fee_stats` endpoint.
 */
export async function fetchFeeStats(): Promise<HorizonFeeStats> {
  const url = `${getHorizonUrl()}/fee_stats`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Horizon fee_stats request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<HorizonFeeStats>;
}

/**
 * Fetches fee stats and returns a processed `FeeRecommendation`.
 */
export async function getFeeRecommendation(): Promise<FeeRecommendation> {
  const stats = await fetchFeeStats();

  const baseFee = Number(stats.last_ledger_base_fee);
  const ledgerCapacityUsage = parseFloat(stats.ledger_capacity_usage);
  const congestionLevel = deriveCongestionLevel(ledgerCapacityUsage);

  // Pick recommended fee based on congestion
  let recommendedFee: number;
  switch (congestionLevel) {
    case 'low':
      recommendedFee = Number(stats.fee_charged.p50);
      break;
    case 'moderate':
      recommendedFee = Number(stats.fee_charged.p70);
      break;
    case 'high':
      recommendedFee = Number(stats.fee_charged.p95);
      break;
  }

  // Ensure recommended fee is never below the base fee
  recommendedFee = Math.max(recommendedFee, baseFee);

  const maxFee = Math.max(Number(stats.fee_charged.p99), recommendedFee);

  return {
    baseFee,
    recommendedFee,
    maxFee,
    congestionLevel,
    shouldBumpFee: congestionLevel === 'high',
    ledgerCapacityUsage,
    lastLedger: Number(stats.last_ledger),
    recommendedFeeXLM: stroopsToXLM(recommendedFee),
    maxFeeXLM: stroopsToXLM(maxFee),
    baseFeeXLM: stroopsToXLM(baseFee),
  };
}

/**
 * Estimates the total fee budget for a batch of payroll transactions.
 *
 * Applies a safety margin multiplier:
 * - Low congestion   → 1.0×
 * - Moderate          → 1.2×
 * - High              → 1.5×
 */
export async function estimateBatchPaymentBudget(
  transactionCount: number
): Promise<BatchBudgetEstimate> {
  const recommendation = await getFeeRecommendation();
  const margin = SAFETY_MARGIN[recommendation.congestionLevel];
  const feePerTransaction = Math.ceil(recommendation.recommendedFee * margin);
  const totalBudget = feePerTransaction * transactionCount;

  return {
    transactionCount,
    feePerTransaction,
    totalBudget,
    totalBudgetXLM: stroopsToXLM(totalBudget),
    feePerTransactionXLM: stroopsToXLM(feePerTransaction),
    safetyMargin: margin,
    congestionLevel: recommendation.congestionLevel,
  };
}

// ---------------------------------------------------------------------------
// Preflight Balance Check
// ---------------------------------------------------------------------------

/** One recipient in a payroll batch, as fed into the preflight check. */
export interface PreflightBatchItem {
  employeeId: string;
  employeeName: string;
  /** Employee's Stellar destination account. */
  destination: string;
  assetCode: string;
  /** Null for native XLM. */
  assetIssuer: string | null;
  /** Amount in asset units (e.g. "150.0000000"). */
  amount: string;
}

export type PreflightFailureReason =
  | 'invalid-address'
  | 'no-account'
  | 'no-trustline'
  | 'insufficient-balance';

export const PREFLIGHT_FAILURE_LABELS: Record<PreflightFailureReason, string> = {
  'invalid-address': 'Invalid destination address',
  'no-account': 'Destination account does not exist on-chain',
  'no-trustline': 'Destination has no trustline for this asset',
  'insufficient-balance': 'Organization balance is insufficient for this asset',
};

/** Preflight result for a single employee row in the batch. */
export interface PreflightEmployeeResult {
  employeeId: string;
  employeeName: string;
  destination: string;
  assetCode: string;
  amount: string;
  ok: boolean;
  failureReasons: PreflightFailureReason[];
}

/** Aggregate requirement/availability for one asset across the whole batch. */
export interface PreflightAssetRequirement {
  assetCode: string;
  assetIssuer: string | null;
  totalRequired: string;
  orgBalance: string;
  orgHasTrustline: boolean;
  sufficient: boolean;
}

export interface PreflightXLMCheck {
  requiredFeesXLM: string;
  minReserveXLM: string;
  totalRequiredXLM: string;
  availableXLM: string;
  sufficient: boolean;
}

export interface PreflightCheckResult {
  orgWallet: string;
  /** False if the org wallet itself doesn't exist on-chain yet. */
  orgAccountExists: boolean;
  readyToSubmit: boolean;
  checkedAt: string;
  xlm: PreflightXLMCheck;
  assets: PreflightAssetRequirement[];
  employees: PreflightEmployeeResult[];
}

/** Runs `mapFn` over `items` with at most `limit` calls in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapFn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapFn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function assetKey(assetCode: string, assetIssuer: string | null): string {
  return `${assetCode}:${assetIssuer ?? ''}`;
}

/**
 * Runs a comprehensive preflight check for a payroll batch before it is
 * submitted for signing:
 *
 *  - the org wallet holds enough XLM to cover network fees + its minimum
 *    reserve,
 *  - the org wallet has an active trustline (and sufficient balance) for
 *    every non-XLM asset used in the batch,
 *  - every employee destination account exists on-chain, and holds a
 *    trustline for the asset it's being paid in.
 */
export async function runPreflightCheck(
  orgWallet: string,
  batch: PreflightBatchItem[]
): Promise<PreflightCheckResult> {
  const [budget, orgAccount] = await Promise.all([
    estimateBatchPaymentBudget(Math.max(batch.length, 1)),
    isValidPublicKey(orgWallet)
      ? loadAccount(orgWallet).catch((): StellarAccountInfo | null => null)
      : Promise.resolve<StellarAccountInfo | null>(null),
  ]);

  const requiredFeesXLM = budget.totalBudgetXLM;
  const subentryCount = orgAccount?.subentryCount ?? 0;
  const minReserveXLM = (BASE_RESERVE_XLM * (2 + subentryCount)).toFixed(7);
  const totalRequiredXLM = (Number(requiredFeesXLM) + Number(minReserveXLM)).toFixed(7);
  const availableXLM = orgAccount?.balances.find((b) => b.isNative)?.balance ?? '0';
  const xlmSufficient = orgAccount !== null && Number(availableXLM) >= Number(totalRequiredXLM);

  // Aggregate the batch by asset so we only need one balance check per asset.
  const totalsByAsset = new Map<string, { assetCode: string; assetIssuer: string | null; total: number }>();
  for (const item of batch) {
    const key = assetKey(item.assetCode, item.assetIssuer);
    const entry = totalsByAsset.get(key);
    const amount = Number(item.amount) || 0;
    if (entry) {
      entry.total += amount;
    } else {
      totalsByAsset.set(key, { assetCode: item.assetCode, assetIssuer: item.assetIssuer, total: amount });
    }
  }

  const assets: PreflightAssetRequirement[] = Array.from(totalsByAsset.values()).map(
    ({ assetCode, assetIssuer, total }) => {
      if (assetCode === 'XLM') {
        return {
          assetCode,
          assetIssuer: null,
          totalRequired: total.toFixed(7),
          orgBalance: availableXLM,
          orgHasTrustline: true,
          sufficient: orgAccount !== null && Number(availableXLM) >= total,
        };
      }

      const balanceLine = orgAccount?.balances.find(
        (b) => b.assetCode === assetCode && b.assetIssuer === assetIssuer
      );
      const orgBalance = balanceLine?.balance ?? '0';
      const orgHasTrustline = !!balanceLine;

      return {
        assetCode,
        assetIssuer,
        totalRequired: total.toFixed(7),
        orgBalance,
        orgHasTrustline,
        sufficient: orgHasTrustline && Number(orgBalance) >= total,
      };
    }
  );

  const assetRequirementByKey = new Map(
    assets.map((a) => [assetKey(a.assetCode, a.assetIssuer), a])
  );

  const employees = await mapWithConcurrency(batch, PREFLIGHT_CONCURRENCY, async (item) => {
    const failureReasons: PreflightFailureReason[] = [];

    if (!isValidPublicKey(item.destination)) {
      failureReasons.push('invalid-address');
    } else {
      const destAccount = await loadAccount(item.destination).catch(
        (): StellarAccountInfo | null => null
      );
      if (!destAccount) {
        failureReasons.push('no-account');
      } else if (item.assetCode !== 'XLM') {
        const hasTrustline = destAccount.balances.some(
          (b) => b.assetCode === item.assetCode && b.assetIssuer === item.assetIssuer
        );
        if (!hasTrustline) failureReasons.push('no-trustline');
      }
    }

    const assetRequirement = assetRequirementByKey.get(assetKey(item.assetCode, item.assetIssuer));
    if (assetRequirement && !assetRequirement.sufficient) {
      failureReasons.push('insufficient-balance');
    }

    return {
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      destination: item.destination,
      assetCode: item.assetCode,
      amount: item.amount,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });

  const readyToSubmit =
    orgAccount !== null &&
    xlmSufficient &&
    assets.every((a) => a.sufficient) &&
    employees.every((e) => e.ok);

  return {
    orgWallet,
    orgAccountExists: orgAccount !== null,
    readyToSubmit,
    checkedAt: new Date().toISOString(),
    xlm: {
      requiredFeesXLM,
      minReserveXLM,
      totalRequiredXLM,
      availableXLM,
      sufficient: xlmSufficient,
    },
    assets,
    employees,
  };
}
