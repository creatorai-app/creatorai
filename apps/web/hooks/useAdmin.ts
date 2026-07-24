import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type {
  AdminDashboardStats,
  AdminFunnel,
  BlogPost,
  MailMessage,
  ActivityFeedItem,
  JobPost,
  JobApplication,
  AffiliateRequest,
  AffiliatePromoCode,
  AffiliateWithdrawal,
  LsAffiliate,
  PaginatedResponse,
} from '@repo/validation';

const AUTH = { requireAuth: true };

export function useAdminStats() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<AdminDashboardStats>('/api/v1/admin/stats', AUTH);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  return { stats, loading, refresh: fetchStats };
}

export function useAdminFunnel() {
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFunnel = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<AdminFunnel>('/api/v1/admin/funnel', AUTH);
      setFunnel(data);
    } catch (err) {
      console.error('Failed to fetch funnel:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);
  return { funnel, loading, refresh: fetchFunnel };
}

export function useAdminUsers(page = 1, search?: string, role?: string) {
  const [data, setData] = useState<PaginatedResponse<Record<string, unknown>> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      const res = await api.get<PaginatedResponse<Record<string, unknown>>>(`/api/v1/admin/users?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, role]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  return { ...data, loading, refresh: fetchUsers };
}

export function useAdminBlogs(page = 1, status?: string) {
  const [data, setData] = useState<PaginatedResponse<BlogPost> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBlogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api.get<PaginatedResponse<BlogPost>>(`/api/v1/admin/blogs?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch blogs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchBlogs(); }, [fetchBlogs]);
  return { ...data, loading, refresh: fetchBlogs };
}

export function useAdminActivities(page = 1, category?: string) {
  const [data, setData] = useState<PaginatedResponse<ActivityFeedItem> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (category) params.set('category', category);
      const res = await api.get<PaginatedResponse<ActivityFeedItem>>(`/api/v1/admin/activities?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { fetch(); }, [fetch]);
  return { ...data, loading, refresh: fetch };
}

export function useAdminMails(page = 1, status?: string) {
  const [data, setData] = useState<PaginatedResponse<MailMessage> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMails = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api.get<PaginatedResponse<MailMessage>>(`/api/v1/admin/mails?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch mails:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchMails(); }, [fetchMails]);
  return { ...data, loading, refresh: fetchMails };
}

export function useAdminJobs(page = 1, status?: string) {
  const [data, setData] = useState<PaginatedResponse<JobPost> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api.get<PaginatedResponse<JobPost>>(`/api/v1/admin/jobs?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  return { ...data, loading, refresh: fetchJobs };
}

export function useAdminApplications(page = 1, status?: string) {
  const [data, setData] = useState<PaginatedResponse<JobApplication> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api.get<PaginatedResponse<JobApplication>>(`/api/v1/admin/applications?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);
  return { ...data, loading, refresh: fetchApplications };
}

export function useAdminAffiliateRequests(page = 1, status?: string) {
  const [data, setData] = useState<PaginatedResponse<AffiliateRequest> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api.get<PaginatedResponse<AffiliateRequest>>(`/api/v1/affiliate/requests?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch affiliate requests:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  return { ...data, loading, refresh: fetchRequests };
}

export function useAdminPromoCodes(page = 1) {
  const [data, setData] = useState<PaginatedResponse<AffiliatePromoCode> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPromoCodes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<PaginatedResponse<AffiliatePromoCode>>(`/api/v1/affiliate/admin/promo-codes?page=${page}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch promo codes:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPromoCodes(); }, [fetchPromoCodes]);
  return { ...data, loading, refresh: fetchPromoCodes };
}

export function useAdminWithdrawals(page = 1, status?: string) {
  const [data, setData] = useState<PaginatedResponse<AffiliateWithdrawal> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      const res = await api.get<PaginatedResponse<AffiliateWithdrawal>>(`/api/v1/affiliate/admin/withdrawals?${params}`, AUTH);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);
  return { ...data, loading, refresh: fetchWithdrawals };
}

export function useAdminLsAffiliates() {
  const [affiliates, setAffiliates] = useState<LsAffiliate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAffiliates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<LsAffiliate[]>('/api/v1/affiliate/admin/ls-affiliates', AUTH);
      setAffiliates(data);
    } catch (err) {
      console.error('Failed to fetch LS affiliates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);
  return { affiliates, loading, refresh: fetchAffiliates };
}

export interface EmailTemplate {
  id: string;
  category: string;
  name: string;
  subject: string;
  html: string;
  default_segment: SegmentFilter | null;
  default_from_address: string | null;
  is_active: boolean;
}

export interface EmailFromAddress {
  id: string;
  email: string;
  display_name: string;
}

export interface SegmentFilter {
  channelConnected?: boolean;
  modelTrained?: boolean;
  planTier?: string;
  signupBeforeDays?: number;
}

export interface RecipientRecord {
  id: string;
  email: string;
  fullName: string | null;
  planTier: string | null;
  channelConnected: boolean;
  channelName: string | null;
  modelTrained: boolean;
}

export interface EmailSendHistoryItem {
  id: string;
  from_address: string;
  recipient_count: number;
  custom_html_used: boolean;
  status: string;
  sent_at: string;
  email_templates: { name: string; category: string } | null;
}

export interface EmailCampaignDetail {
  id: string;
  from_address: string;
  recipient_count: number;
  recipient_ids: string[];
  custom_html_used: boolean;
  custom_html: string | null;
  segment_filter: SegmentFilter | null;
  resend_batch_ids: string[] | null;
  status: string;
  error_details: unknown;
  sent_at: string;
  sent_by: string | null;
  email_templates: { name: string; category: string; subject: string } | null;
  recipients: { id: string; email: string; fullName: string | null }[];
}

export const adminApi = {
  updateUser: (userId: string, updates: Record<string, unknown>) =>
    api.put(`/api/v1/admin/users/${userId}`, updates, AUTH),
  deleteUser: (userId: string) =>
    api.delete(`/api/v1/admin/users/${userId}`, AUTH),
  getPlans: () =>
    api.get<Array<{ id: string; name: string; price_monthly: number; credits_monthly: number }>>('/api/v1/admin/plans', AUTH),
  getUser: (userId: string) =>
    api.get<Record<string, unknown>>(`/api/v1/admin/users/${userId}`, AUTH),
  setUserPlan: (userId: string, planId: string, validityMonths?: number) =>
    api.put(`/api/v1/admin/users/${userId}/plan`, { planId, validityMonths }, AUTH),
  createBlog: (data: Partial<BlogPost>) =>
    api.post<BlogPost>('/api/v1/admin/blogs', data, AUTH),
  updateBlog: (id: string, data: Partial<BlogPost>) =>
    api.put<BlogPost>(`/api/v1/admin/blogs/${id}`, data, AUTH),
  deleteBlog: (id: string) =>
    api.delete(`/api/v1/admin/blogs/${id}`, AUTH),
  getBlog: (id: string) =>
    api.get<BlogPost>(`/api/v1/admin/blogs/${id}`, AUTH),
  getMail: (id: string) =>
    api.get<MailMessage>(`/api/v1/admin/mails/${id}`, AUTH),
  updateMailStatus: (id: string, status: string) =>
    api.put(`/api/v1/admin/mails/${id}`, { status }, AUTH),
  replyToMail: (id: string, subject: string, html: string) =>
    api.post<{ success: boolean; mail: MailMessage }>(`/api/v1/admin/mails/${id}/reply`, { subject, html }, AUTH),
  updateAffiliateLink: (id: string, updates: Record<string, unknown>) =>
    api.put(`/api/v1/admin/affiliates/links/${id}`, updates, AUTH),
  updateSaleStatus: (id: string, status: string) =>
    api.put(`/api/v1/admin/affiliates/sales/${id}`, { status }, AUTH),
  getJob: (id: string) =>
    api.get<JobPost>(`/api/v1/admin/jobs/${id}`, AUTH),
  createJob: (data: Partial<JobPost>) =>
    api.post<JobPost>('/api/v1/admin/jobs', data, AUTH),
  updateJob: (id: string, data: Partial<JobPost>) =>
    api.put<JobPost>(`/api/v1/admin/jobs/${id}`, data, AUTH),
  deleteJob: (id: string) =>
    api.delete(`/api/v1/admin/jobs/${id}`, AUTH),
  getApplication: (id: string) =>
    api.get<JobApplication>(`/api/v1/admin/applications/${id}`, AUTH),
  updateApplicationStatus: (id: string, status: string, notes?: string) =>
    api.put(`/api/v1/admin/applications/${id}`, { status, notes }, AUTH),
  deleteApplication: (id: string) =>
    api.delete(`/api/v1/admin/applications/${id}`, AUTH),
  reviewAffiliateRequest: (id: string, status: 'approved' | 'denied' | 'pending', admin_notes?: string) =>
    api.put(`/api/v1/affiliate/requests/${id}`, { status, admin_notes }, AUTH),
  createAffiliateLinkForRep: (data: {
    owner_id?: string;
    sales_rep_id?: string;
    code: string;
    label?: string;
    target_url?: string;
    commission_rate?: number;
    ls_affiliate_id?: string;
  }) => api.post('/api/v1/affiliate/admin/create-link', data, AUTH),
  getLsSignupUrl: () =>
    api.get<string>('/api/v1/affiliate/admin/ls-signup-url', AUTH),
  createPromoCode: (data: {
    owner_id: string;
    code: string;
    amount: number;
    amount_type: 'percent' | 'fixed';
    commission_rate?: number;
    label?: string;
  }) => api.post('/api/v1/affiliate/admin/promo-codes', data, AUTH),
  updatePromoCode: (id: string, updates: { commission_rate?: number; label?: string; is_active?: boolean }) =>
    api.put(`/api/v1/affiliate/admin/promo-codes/${id}`, updates, AUTH),
  updateWithdrawal: (id: string, status: 'approved' | 'paid' | 'rejected', admin_notes?: string) =>
    api.put(`/api/v1/affiliate/admin/withdrawals/${id}`, { status, admin_notes }, AUTH),
  // ---- Bulk email ----
  getEmailTemplates: (category?: string) =>
    api.get<EmailTemplate[]>(`/api/v1/admin/email-templates${category ? `?category=${category}` : ''}`, AUTH),
  createEmailTemplate: (body: {
    category: string;
    name?: string;
    subject: string;
    html: string;
    defaultFromAddress?: string;
  }) => api.post<EmailTemplate>('/api/v1/admin/email-templates', body, AUTH),
  updateEmailTemplate: (id: string, body: { subject?: string; html?: string }) =>
    api.put<EmailTemplate>(`/api/v1/admin/email-templates/${id}`, body, AUTH),
  getEmailFromAddresses: () =>
    api.get<EmailFromAddress[]>('/api/v1/admin/email-from-addresses', AUTH),
  previewRecipients: (segmentFilter: SegmentFilter) =>
    api.post<RecipientRecord[]>('/api/v1/admin/email-campaigns/preview-recipients', { segmentFilter }, AUTH),
  sendCampaign: (body: {
    templateId: string;
    fromAddress: string;
    recipientIds: string[];
    subject?: string;
    html?: string;
    edited?: boolean;
    segmentFilter?: SegmentFilter;
  }) => api.post<{ jobId: string; recipientCount: number }>('/api/v1/admin/email-campaigns/send', body, AUTH),
  getEmailHistory: (page = 1) =>
    api.get<PaginatedResponse<EmailSendHistoryItem>>(`/api/v1/admin/email-campaigns/history?page=${page}`, AUTH),
  getEmailCampaign: (id: string) =>
    api.get<EmailCampaignDetail>(`/api/v1/admin/email-campaigns/${id}`, AUTH),
};
