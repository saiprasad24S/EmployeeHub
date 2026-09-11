import { authedFetch } from '../lib/api';
import { LeaveRequest, LeaveSummary } from '../types/employee';

export interface ApplyLeavePayload {
  leave_type: 'CASUAL' | 'SICK' | 'MATERNITY_PATERNITY' | 'BEREAVEMENT' | 'UNPAID';
  start_date: string;
  end_date: string;
  reason: string;
}

export async function getMyLeaves(token: string): Promise<LeaveRequest[]> {
  const res = await authedFetch('/api/leaves/my/', token);
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function getLeaveSummary(token: string): Promise<LeaveSummary> {
  const res = await authedFetch('/api/leaves/my/summary/', token);
  return res.json();
}

export async function applyLeave(payload: ApplyLeavePayload, token: string): Promise<LeaveRequest> {
  const res = await authedFetch('/api/leaves/', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}
