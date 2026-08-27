import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchAuditRecords, type AuditFilters, type AuditRecord } from '../services/audit';
import type { SorobanContractEvent } from '../services/transactionHistory';
import { getContractId } from '../services/sorobanTaskContract';

export interface TimelineEntry {
  id: string;
  kind: 'audit' | 'contract-event';
  timestamp: string;
  ledger: number;
  record?: AuditRecord;
  event?: SorobanContractEvent;
}

const AUDIT_PAGE_SIZE = 20;

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  'http://localhost:3000';

async function fetchIndexedContractEvents(contractId: string): Promise<SorobanContractEvent[]> {
  const token = localStorage.getItem('payd_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let page = 1;
  const limit = 100;
  const all: SorobanContractEvent[] = [];
  while (true) {
    const res = await fetch(
      `${API_BASE_URL.replace(/\/+$/, '')}/api/events/${contractId}?limit=${limit}&page=${page}`,
      { headers }
    );
    if (!res.ok) throw new Error(`events fetch failed ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{
        event_id: string;
        contract_id: string;
        event_type: string;
        payload: string;
        ledger_sequence: number;
        tx_hash: string;
        created_at: string;
      }>;
      pagination?: { totalPages?: number };
    };
    const rows = data.data ?? [];
    const mapped = rows.map((r) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(r.payload) as Record<string, unknown>;
      } catch {
        // keep empty
      }
      const topic = (payload.topic as string[] | undefined) ?? [r.event_type];
      const value = payload.value != null ? String(payload.value) : JSON.stringify(payload);
      return {
        id: r.event_id,
        type: r.event_type,
        ledger: r.ledger_sequence,
        ledgerClosedAt: r.created_at,
        contractId: r.contract_id,
        topic: Array.isArray(topic) ? (topic as string[]) : [String(topic)],
        topics: Array.isArray(topic) ? (topic as string[]) : [String(topic)],
        value,
        txHash: r.tx_hash,
      } as SorobanContractEvent;
    });
    all.push(...mapped);
    const totalPages = data.pagination?.totalPages ?? (rows.length < limit ? page : page + 1);
    if (page >= totalPages || rows.length < limit) break;
    page += 1;
  }
  return all;
}

function toEndOfDayTs(dateStr: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T23:59:59.999Z`).getTime();
  }
  return new Date(dateStr).getTime();
}

export function useAuditHistory(filters: AuditFilters & { address?: string | null }) {
  return useInfiniteQuery({
    queryKey: ['audit-history', filters] as const,
    queryFn: async ({ pageParam = 1 }) => {
      const page = pageParam as number;
      const auditPage = await fetchAuditRecords(page, AUDIT_PAGE_SIZE, {
        sourceAccount: filters.address ?? filters.sourceAccount,
        from: filters.from,
        to: filters.to,
        status: filters.status,
        employee: filters.employee,
        asset: filters.asset,
      });

      let contractEvents: SorobanContractEvent[] = [];
      if (page === 1) {
        try {
          const contractId = getContractId();
          if (contractId) {
            const events = await fetchIndexedContractEvents(contractId);
            const fromTs = filters.from ? new Date(filters.from).getTime() : undefined;
            const toTs = filters.to ? toEndOfDayTs(filters.to) : undefined;
            contractEvents = events.filter((e) => {
              const ts = new Date(e.ledgerClosedAt).getTime();
              if (fromTs !== undefined && ts < fromTs) return false;
              if (toTs !== undefined && ts > toTs) return false;
              return true;
            });
          }
        } catch {
          // indexer may be empty or not yet deployed — timeline still shows audit records
        }
      }

      const timeline: TimelineEntry[] = [
        ...auditPage.records.map((r) => ({
          id: `audit-${r.id}`,
          kind: 'audit' as const,
          timestamp: r.createdAt,
          ledger: r.ledger,
          record: r,
        })),
        ...contractEvents.map((e) => ({
          id: `evt-${e.id}`,
          kind: 'contract-event' as const,
          timestamp: e.ledgerClosedAt,
          ledger: e.ledger,
          event: e,
        })),
      ];

      return {
        timeline,
        auditPage,
        nextPage: auditPage.page < auditPage.totalPages ? auditPage.page + 1 : undefined,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30_000,
  });
}
