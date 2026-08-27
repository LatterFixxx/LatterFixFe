const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';

export interface PayrollRunRecord {
  id: number;
  batch_id: string;
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'failed';
  total_amount: string;
  asset_code: string;
  asset_issuer?: string;
  created_at: string;
}

export interface PayrollRecipientStatus {
  id: number;
  employee_id: number;
  employee_first_name?: string;
  employee_last_name?: string;
  employee_email?: string;
  wallet_address?: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  tx_hash?: string;
}

export interface PayrollRunSummary {
  payroll_run: PayrollRunRecord;
  items: PayrollRecipientStatus[];
  summary: {
    total_employees: number;
    total_amount: string;
  };
}

interface PayrollRunsListResponse {
  success: boolean;
  data: {
    data: PayrollRunRecord[];
    total: number;
  };
}

interface PayrollRunSummaryResponse {
  success: boolean;
  data: PayrollRunSummary;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function payrollAuthHeaders(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** organizationId is ignored; runs are scoped by the signed-in employer JWT. */
export async function fetchPayrollRuns(
  _organizationId: number,
  page = 1,
  limit = 20
): Promise<{ data: PayrollRunRecord[]; total: number }> {
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll-bonus/runs?page=${page}&limit=${limit}`,
    { headers: payrollAuthHeaders() }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch payroll runs (${response.status})`);
  }

  const payload = (await response.json()) as PayrollRunsListResponse;
  return payload.data;
}

export async function fetchPayrollRunSummary(runId: number): Promise<PayrollRunSummary> {
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll-bonus/runs/${runId}`,
    { headers: payrollAuthHeaders() }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch payroll run summary (${response.status})`);
  }

  const payload = (await response.json()) as PayrollRunSummaryResponse;
  return payload.data;
}

export function getTxExplorerUrl(
  txHash: string,
  network: 'testnet' | 'public' = 'testnet'
): string {
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

export async function executePayroll(
  runId: number | string,
  organizationId: number | string
): Promise<{ success: boolean; jobId: string }> {
  const response = await fetch(
    `${normalizeBaseUrl(API_BASE_URL)}/api/v1/payroll-bonus/runs/${runId}/execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId }),
    }
  );

  if (!response.ok) {
    const errorData = (await response.json()) as { error?: string };
    throw new Error(errorData.error || `Execution failed (${response.status})`);
  }

  const payload = (await response.json()) as { success: boolean; jobId: string };
  return payload;
}
