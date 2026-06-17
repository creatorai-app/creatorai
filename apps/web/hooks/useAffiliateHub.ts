import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type {
  AffiliateHubStats,
  AffiliateLink,
  AffiliatePromoCode,
  AffiliateSale,
  AffiliatePayoutMethod,
  AffiliateWithdrawal,
  PaginatedResponse,
  PayoutMethodType,
} from '@repo/validation';

const AUTH = { requireAuth: true };

interface HubState {
  stats: AffiliateHubStats | null;
  links: AffiliateLink[];
  promoCodes: AffiliatePromoCode[];
  sales: AffiliateSale[];
  payoutMethod: AffiliatePayoutMethod | null;
  withdrawals: AffiliateWithdrawal[];
}

const EMPTY: HubState = {
  stats: null,
  links: [],
  promoCodes: [],
  sales: [],
  payoutMethod: null,
  withdrawals: [],
};

export function useAffiliateHub() {
  const [data, setData] = useState<HubState>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [stats, links, promoCodes, sales, payoutMethod, withdrawals] = await Promise.all([
        api.get<AffiliateHubStats>('/api/v1/affiliate/hub', AUTH),
        api.get<AffiliateLink[]>('/api/v1/affiliate/links', AUTH),
        api.get<AffiliatePromoCode[]>('/api/v1/affiliate/promo-codes', AUTH),
        api.get<PaginatedResponse<AffiliateSale>>('/api/v1/affiliate/sales?limit=8', AUTH),
        api.get<AffiliatePayoutMethod | null>('/api/v1/affiliate/payout-method', AUTH),
        api.get<PaginatedResponse<AffiliateWithdrawal>>('/api/v1/affiliate/withdrawals', AUTH),
      ]);
      setData({
        stats,
        links,
        promoCodes,
        sales: sales.data,
        payoutMethod,
        withdrawals: withdrawals.data,
      });
    } catch (err) {
      console.error('Failed to load affiliate hub:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...data, loading, refresh };
}

export const affiliateHubApi = {
  createLink: (data: { label?: string; target_url?: string }) =>
    api.post<AffiliateLink>('/api/v1/affiliate/links', data, AUTH),
  updateLink: (id: string, data: Record<string, unknown>) =>
    api.put<AffiliateLink>(`/api/v1/affiliate/links/${id}`, data, AUTH),
  deleteLink: (id: string) =>
    api.delete(`/api/v1/affiliate/links/${id}`, AUTH),
  savePayoutMethod: (data: { method: PayoutMethodType; details: Record<string, string> }) =>
    api.put<AffiliatePayoutMethod>('/api/v1/affiliate/payout-method', data, AUTH),
  requestWithdrawal: (amount: number) =>
    api.post<AffiliateWithdrawal>('/api/v1/affiliate/withdrawals', { amount }, AUTH),
};
