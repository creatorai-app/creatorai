export type UserRole = 'user' | 'admin';

export interface UserProfile {
  avatar_url: string
  email: string
  full_name: string
  credits: number
  ai_trained: boolean
  /** One-way: true once the free first training has landed. Survives disconnect. */
  free_training_used?: boolean
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
  /** Users who hit the API within `onlineWindowMinutes`. */
  onlineUsers: number
  onlineWindowMinutes: number
  activeUsers24h: number
  errors24h: number
}

export interface ErrorLogProfile {
  user_id: string
  full_name: string | null
  name: string | null
  email: string | null
  avatar_url: string | null
}

export interface ErrorLog {
  id: string
  /** Stable hash grouping every occurrence of the same bug. */
  fingerprint: string
  source: 'api' | 'worker'
  feature: string | null
  user_id: string | null
  name: string | null
  message: string
  stack: string | null
  route: string | null
  method: string | null
  status_code: number | null
  context: Record<string, unknown>
  alerted_at: string | null
  created_at: string
  profiles: ErrorLogProfile | null
}

export interface ErrorLogDetail extends ErrorLog {
  occurrences: { last24h: number; allTime: number }
  recent: Array<{ id: string; user_id: string | null; created_at: string; status_code: number | null }>
  affectedUsers: number
}

export interface ErrorGroup {
  fingerprint: string
  name: string
  message: string
  feature: string | null
  source: string
  status_code: number | null
  count: number
  affectedUsers: number
  lastSeen: string
}

export interface RevenueByTier {
  tier: string
  revenue: number
  payments: number
  sales: number
  failedPayments: number
  churned: number
}

export interface FunnelTierBreakdown {
  tier: string
  clicked: number
  checkoutStarted: number
  completed: number
  abandoned: number
  /** Completed / clicked, as a percentage rounded to one decimal. */
  conversionRate: number
}

export interface AdminFunnel {
  pricingViewed: number
  planClicked: number
  checkoutStarted: number
  completed: number
  byTier: FunnelTierBreakdown[]
}

export type FunnelEventName = 'pricing_viewed' | 'plan_clicked' | 'checkout_started'

/** One raw purchase-intent event, with the owning profile when the visitor was signed in. */
export interface AdminFunnelEvent {
  id: string
  event: FunnelEventName
  /** Null for pricing_viewed — that step is not tied to a plan. */
  tier: string | null
  user_id: string | null
  /** Anonymous per-tab id for logged-out visitors, `user:<id>` for checkout_started. */
  session_id: string
  referrer: string | null
  created_at: string
  profile: {
    user_id: string
    full_name: string | null
    name: string | null
    email: string | null
    avatar_url: string | null
    credits: number | null
  } | null
}

export interface BlogFaq {
  question: string
  answer: string
}

export interface BlogVideo {
  youtubeId: string
  name: string
  description: string
  /** ISO date the video was published on YouTube. */
  uploadDate: string
  /** ISO 8601 duration, e.g. "PT3M20S". */
  duration?: string
}

/** The sign-up card rendered halfway down a post. */
export interface BlogBrandedCta {
  title: string
  description: string
  buttonLabel: string
  /** Site-relative path; defaults to /signup when omitted. */
  buttonHref?: string
}

export interface BlogPost {
  id: string
  /** Null for posts seeded before the CMS existed, or when the author's account is deleted. */
  author_id?: string | null
  /** Display byline, matched against apps/web/lib/authors.ts. */
  author_name?: string | null
  title: string
  slug: string
  excerpt?: string | null
  content: string
  category: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  featured: boolean
  read_time?: string | null
  /** Required to publish. */
  seo_title?: string | null
  /** Required to publish; 155 chars max, enforced by a DB constraint. */
  seo_description?: string | null
  /** Required to publish; unique across non-archived posts. */
  focus_keyword?: string | null
  keywords: string[]
  /** Rendered as the FAQ block and emitted as FAQPage JSON-LD. */
  faqs: BlogFaq[]
  /** Emitted as VideoObject JSON-LD. A video belongs to exactly one post. */
  videos: BlogVideo[]
  /** Mid-article sign-up card. Null hides it. */
  branded_cta?: BlogBrandedCta | null
  published_at?: string | null
  created_at: string
  updated_at: string
}

/** Columns an admin may write. Anything else (id, timestamps) is server-owned. */
export const BLOG_POST_WRITABLE_FIELDS = [
  'title',
  'slug',
  'excerpt',
  'content',
  'category',
  'tags',
  'status',
  'featured',
  'author_name',
  'read_time',
  'seo_title',
  'seo_description',
  'focus_keyword',
  'keywords',
  'faqs',
  'videos',
  'branded_cta',
  'published_at',
] as const

export type BlogPostWritableField = (typeof BLOG_POST_WRITABLE_FIELDS)[number]

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
  promotion_channel?: string | null
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
  stats?: { conversions: number; revenue: number; commission: number }
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
  category: 'feature' | 'error' | 'subscription' | 'affiliate' | 'unsubscribe'
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