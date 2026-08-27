import { loadAccount, hasTrustline } from './stellar';
import { estimateBatchPaymentBudget } from './feeEstimation';
import type { PayrollRecipientStatus } from './bulkPaymentStatus';
import BigNumber from 'bignumber.js';

export interface PreflightIssue {
  employee_id: number;
  reason: string;
}

export interface PreflightResult {
  isReady: boolean;
  orgIssues: string[];
  recipientIssues: PreflightIssue[];
}

export async function runPreflightCheck(
  orgPublicKey: string,
  assetCode: string,
  assetIssuer: string | null,
  totalAmount: string,
  recipients: PayrollRecipientStatus[]
): Promise<PreflightResult> {
  const orgIssues: string[] = [];
  const recipientIssues: PreflightIssue[] = [];

  try {
    // 1. Check Org Wallet balances
    const orgAccount = await loadAccount(orgPublicKey);
    const xlmBalance = orgAccount.balances.find((b) => b.isNative)?.balance || '0';

    // Estimate fees for the batch
    const budget = await estimateBatchPaymentBudget(recipients.length);

    let requiredXlm = new BigNumber(budget.totalBudgetXLM);

    if (assetCode === 'XLM') {
      requiredXlm = requiredXlm.plus(totalAmount);
    } else {
      const assetBalance =
        orgAccount.balances.find((b) => b.assetCode === assetCode && b.assetIssuer === assetIssuer)
          ?.balance || '0';
      if (new BigNumber(assetBalance).lt(totalAmount)) {
        orgIssues.push(
          `Insufficient ${assetCode} balance. Required: ${totalAmount}, Available: ${assetBalance}`
        );
      }
    }

    if (new BigNumber(xlmBalance).lt(requiredXlm)) {
      orgIssues.push(
        `Insufficient XLM balance for fees and reserves. Required: ${requiredXlm.toString()}, Available: ${xlmBalance}`
      );
    }

    // 2. Check each recipient
    const checks = recipients.map(async (recipient) => {
      const dest = recipient.wallet_address;
      if (!dest) {
        recipientIssues.push({
          employee_id: recipient.employee_id,
          reason: 'No wallet address on file.',
        });
        return;
      }

      try {
        await loadAccount(dest);

        // If it's not XLM, check trustline
        if (assetCode !== 'XLM') {
          const hasTrust = await hasTrustline(dest, assetCode, assetIssuer || '');
          if (!hasTrust) {
            recipientIssues.push({
              employee_id: recipient.employee_id,
              reason: `Missing trustline for ${assetCode}.`,
            });
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          recipientIssues.push({
            employee_id: recipient.employee_id,
            reason: 'Account not found on-chain (unfunded).',
          });
        } else {
          recipientIssues.push({
            employee_id: recipient.employee_id,
            reason: `Error validating account: ${err.message}`,
          });
        }
      }
    });

    await Promise.all(checks);
  } catch (error: any) {
    orgIssues.push(`Failed to load org account: ${error.message}`);
  }

  return {
    isReady: orgIssues.length === 0 && recipientIssues.length === 0,
    orgIssues,
    recipientIssues,
  };
}
