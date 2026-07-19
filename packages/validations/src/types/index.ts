export type UserRole = 'user' | 'admin';

export interface UserProfile {
  avatar_url: string
  email: string
  full_name: string
  credits: number
  ai_trained: boolean
  youtube_connected: boolean
  language: string
  referral_code: string | null
  role?: UserRole
}

export interface AdminDashboardStats {
  totalUsers: number
  newUsers30d: number
  activeSubscriptions: number
  publishedBlogs: number
  totalSales: number
  totalRevenue: number
  unreadMails: number
  pendingApplications: number
  pendingAffiliateRequests: number
}

export interface BlogPost {
  id: string
  author_id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  cover_image_url?: string
  category: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  featured: boolean
  published_at?: string
  created_at: string
  updated_at: string
}

export interface AffiliateLink {
  id: string
  sales_rep_id: string
  code: string
  label?: string
  target_url: string
  commission_rate: number
  click_count: number
  is_active: boolean
  ls_affiliate_id?: string
  created_at: string
  updated_at: string
}

export interface AffiliateRequest {
  id: string
  user_id: string
  full_name: string
  email: string
  website?: string
  social_media?: string
  audience_size?: string
  promotion_method?: string
  reason: string
  status: 'pending' | 'approved' | 'denied'
  reviewed_by?: string
  reviewed_at?: string
  admin_notes?: string
  created_at: string
  updated_at: string
  profiles?: { full_name: string; email: string }
}

export interface LsAffiliate {
  id: string
  user_name: string
  user_email: string
  share_domain: string
  status: 'active' | 'pending' | 'disabled'
  total_earnings: number
  unpaid_earnings: number
  created_at: string
  updated_at: string
}

export interface AffiliateSale {
  id: string
  affiliate_link_id: string
  sales_rep_id: string
  customer_id?: string
  customer_email?: string
  amount: number
  commission: number
  status: 'pending' | 'confirmed' | 'paid' | 'refunded'
  source: 'link' | 'promo'
  promo_code_id?: string
  mature_at?: string
  created_at: string
  updated_at: string
  affiliate_links?: { code: string; label: string }
}

export type AffiliateAmountType = 'percent' | 'fixed'

export interface AffiliatePromoCode {
  id: string
  owner_id: string
  code: string
  ls_discount_id?: string
  amount: number
  amount_type: AffiliateAmountType
  commission_rate: number
  label?: string
  is_active: boolean
  created_at: string
  updated_at: string
  profiles?: { full_name: string; email: string } | null
}

export type PayoutMethodType = 'paypal' | 'wise' | 'bank'

export interface AffiliatePayoutMethod {
  user_id: string
  method: PayoutMethodType
  details: Record<string, string>
  created_at: string
  updated_at: string
}

export type WithdrawalStatus = 'requested' | 'approved' | 'paid' | 'rejected'

export interface AffiliateWithdrawal {
  id: string
  affiliate_id: string
  amount: number
  method: PayoutMethodType
  details: Record<string, string>
  status: WithdrawalStatus
  admin_notes?: string
  processed_by?: string
  processed_at?: string
  created_at: string
  updated_at: string
  profiles?: { full_name: string; email: string } | null
}

export interface AffiliateEarningPoint {
  date: string
  commission: number
}

export interface AffiliateHubStats {
  availableBalance: number
  pendingEarnings: number
  lifetimeEarnings: number
  totalWithdrawn: number
  reservedBalance: number
  totalClicks: number
  totalConversions: number
  totalLinks: number
  minWithdrawal: number
  earnings: AffiliateEarningPoint[]
}

export interface MailMessage {
  id: string
  from_email: string
  from_name?: string
  subject: string
  body: string
  status: 'unread' | 'read' | 'replied' | 'archived'
  replied_at?: string
  replied_by?: string
  created_at: string
}

export interface ActivityFeedItem {
  id: string
  user_id: string
  category: 'feature' | 'error' | 'subscription' | 'affiliate'
  label: string
  action: string
  status: string | null
  error_message: string | null
  credits_consumed: number
  created_at: string
  profiles: { user_id: string; full_name: string | null; name: string | null; email: string | null; avatar_url: string | null } | null
}

export interface Activity {
  id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  profiles?: { full_name: string; email: string; avatar_url?: string }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export type JobTeam = 'Engineering' | 'AI' | 'Design' | 'Marketing' | 'Business' | string

export const DEV_TEAMS: string[] = ['Engineering', 'AI']

export type JobCategory = 'engineering' | 'ai' | 'design' | 'marketing' | 'business' | 'other'

export interface JobPost {
  id: string
  title: string
  team: JobTeam
  location: string
  type: string
  category: JobCategory
  description: string
  requirements?: string
  status: 'active' | 'inactive' | 'closed'
  created_at: string
  updated_at: string
}

export interface JobApplication {
  id: string
  job_post_id?: string
  position: string
  full_name: string
  email: string
  phone?: string
  linkedin_url: string
  github_url?: string
  portfolio_url?: string
  resume_file_path?: string
  cover_letter_file_path?: string
  experience: string
  problem_solving: string
  status: 'pending' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired'
  notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
  job_posts?: { title: string; team: string }
}

export interface Script {
  id: string
  title: string
  content?: string
  tone?: string
  language?: string
  status?: string
  credits_consumed?: number
  created_at: string
  updated_at?: string
  user_id?: string
}

export * from "./SubtitleTypes";
export * from "./dubbing";