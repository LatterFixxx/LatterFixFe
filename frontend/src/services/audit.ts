const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  'http://localhost:3000';

export interface AuditRecord {
  id: string;
  txHash: string;
  sourceAccount: string;
  createdAt: string;
  ledger: number;
  status: string;
  employee?: string;
  asset?: string;
  amount?: string;
  memo?: string;
}

export interface AuditPage {
  records: AuditRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditFilters {
  sourceAccount?: string;
  from?: string;
  to?: string;
  status?: string;
  employee?: string;
  asset?: string;
}

export async function fetchAuditRecords(
  page: number,
  limit: number,
  filters: AuditFilters = {}
): Promise<AuditPage> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (filters.sourceAccount) params.set('sourceAccount', filters.sourceAccount);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.status) params.set('status', filters.status);
  if (filters.employee) params.set('employee', filters.employee);
  if (filters.asset) params.set('asset', filters.asset);

  const token = localStorage.getItem('payd_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/api/audit?${params.toString()}`, {
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Audit fetch failed (${res.status})`);
  }

  const data = (await res.json()) as AuditPage & { data?: AuditRecord[] };
  // Support both { records } and { data } shapes
  const records = (data.records ?? data.data ?? []) as AuditRecord[];
  return {
    records,
    total: data.total ?? records.length,
    page: data.page ?? page,
    limit: data.limit ?? limit,
    totalPages: data.totalPages ?? (Math.ceil((data.total ?? records.length) / limit) || 1),
  };
}
