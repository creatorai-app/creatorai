# Creator AI - Supabase Schema Documentation

**Application:** Creator AI - Personalized YouTube Creator Tool  
**Database:** PostgreSQL (Supabase)  
**Last Updated:** 2026-02-12

---

## Table of Contents

- [Overview](#overview)
- [Database Extensions](#database-extensions)
- [Core Tables](#core-tables)
- [Functions](#functions)
- [Triggers](#triggers)
- [Row Level Security](#row-level-security)
- [Storage Buckets](#storage-buckets)

---

## Overview

This schema supports Creator AI's features:
- User profiles with referral system
- AI script generation with style learning
- Video dubbing with voice cloning
- Subtitle generation and translation
- Documentation generation
- YouTube channel integration
- Credit-based usage tracking

---

## Database Extensions

```sql
pgjwt    -- JWT token handling
vector   -- Vector embeddings for AI style matching
```

---

## Core Tables

### User Management

#### `profiles`
User profile data and credits system.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key, references auth.users |
| `user_id` | uuid | Foreign key to auth.users |
| `full_name` | text | User's full name |
| `email` | text | User's email |
| `bio` | text | User biography |
| `credits` | integer | Available credits (default: 200) |
| `referral_code` | varchar(10) | Unique referral code |
| `referred_by` | varchar(10) | Referral code of referrer |
| `total_referrals` | integer | Count of successful referrals |
| `referral_credits` | integer | Credits earned from referrals |
| `ai_trained` | boolean | Whether AI has learned user's style |
| `youtube_connected` | boolean | YouTube OAuth status |
| `avatar_url` | text | Profile picture URL |
| `language` | text | Preferred language (default: 'en') |
| `password_reset_otp` | text | OTP for password reset |
| `password_reset_otp_expires_at` | timestamptz | OTP expiration |
| `password_reset_otp_attempts` | integer | Failed OTP attempts |
| `password_reset_otp_verified` | boolean | OTP verification status |

**Indexes:**
- `idx_profiles_referral_code` on `referral_code`
- `idx_profiles_password_reset_otp` on `email, password_reset_otp`
- `idx_profiles_password_reset_otp_expires_at` on expiration time

---

#### `referrals`
Tracks referral relationships and rewards.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `referrer_id` | uuid | User who referred (FK to profiles) |
| `referred_user_id` | uuid | User who was referred (FK to profiles) |
| `referral_code` | varchar(10) | Code used for referral |
| `referred_email` | text | Email of referred user |
| `status` | varchar(20) | pending/completed/expired |
| `credits_awarded` | integer | Credits given (default: 5) |
| `created_at` | timestamptz | When referral was created |
| `completed_at` | timestamptz | When referral completed |

**Indexes:**
- `idx_referrals_referrer_id`, `idx_referrals_referred_user_id`
- `idx_referrals_referral_code`, `idx_referrals_referred_email`
- `idx_referrals_status`

**View:** `referrals_with_profiles` - Joins referrals with profile data

---

### Content Creation

#### `scripts`
AI-generated video scripts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `title` | text | Script title |
| `content` | text | Script content |
| `prompt` | text | User's generation prompt |
| `context` | text | Additional context |
| `tone` | text | Desired tone |
| `language` | text | Target language (default: 'english') |
| `duration` | text | Target video duration |
| `include_storytelling` | boolean | Story elements flag |
| `include_timestamps` | boolean | Include timestamps |
| `reference_links` | text | Reference materials |

---

#### `user_style`
AI-learned style profile from user's videos.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users (UNIQUE) |
| `tone` | text | Speaking tone |
| `vocabulary_level` | text | Language complexity |
| `pacing` | text | Content pacing |
| `themes` | text | Content themes |
| `humor_style` | text | Type of humor used |
| `structure` | text | Video structure |
| `visual_style` | text | Visual preferences |
| `audience_engagement` | text[] | Engagement techniques |
| `narrative_structure` | text | Story structure |
| `video_urls` | text[] | Training video URLs |
| `transcripts` | jsonb | Video transcripts |
| `thumbnails` | jsonb | Thumbnail data |
| `style_analysis` | text | AI analysis |
| `recommendations` | jsonb | AI recommendations |
| `content` | text | Processed content |
| `embedding` | vector(1536) | Style embedding for similarity |
| `credits_consumed` | integer | Credits used for training |
| `gemini_total_tokens` | integer | AI tokens used |

**Index:** `user_style_embedding_idx` (HNSW for vector similarity)

---

#### `research_topics`
Research data for content ideas.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `topic` | text | Research topic |
| `context` | text | Additional context |
| `research_data` | jsonb | Gathered research data |
| `sources` | text[] | Source URLs |

**Indexes:**
- `idx_research_topics_user_id`
- `idx_research_topics_created_at`

---

### Video Processing

#### `subtitle_jobs`
Subtitle generation jobs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `video_path` | text | Video file path |
| `video_url` | text | Public video URL |
| `filename` | text | Original filename |
| `subtitles_json` | jsonb | Generated subtitles |
| `status` | text | queued/processing/done/failed/error |
| `language` | text | Source language (default: 'en') |
| `detected_language` | text | Auto-detected language |
| `target_language` | text | Translation target |
| `duration` | numeric | Video duration |
| `credits_consumed` | integer | Credits used |
| `error_message` | text | Error details |

**Indexes:**
- `idx_subtitle_jobs_user_id`
- `idx_subtitle_jobs_status`
- `idx_subtitle_jobs_created_at` (DESC)

---

#### `subtitles`
Generated subtitle files.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `job_id` | uuid | FK to subtitle_jobs |
| `subtitle_path` | text | File path |
| `format` | text | srt/vtt/json |
| `language` | text | Subtitle language |

**Index:** `idx_subtitles_job_id`

---

#### `dubbing_jobs`
Video/audio dubbing with voice cloning.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `voice_id` | uuid | FK to user_voices (nullable) |
| `original_file_url` | text | Source media URL |
| `file_type` | text | audio/video |
| `original_language` | text | Source language |
| `target_language` | text | Target language |
| `transcript` | jsonb | Original transcript |
| `translated_transcript` | jsonb | Translated transcript |
| `status` | text | pending/processing/completed/failed |
| `dubbed_audio_url` | text | Output audio URL |
| `dubbed_video_url` | text | Output video URL |
| `processing_duration` | integer | Time in seconds |
| `elevenlabs_characters_generated` | integer | ElevenLabs API usage |
| `credits_consumed` | integer | Credits used |

**Indexes:**
- `idx_dubbing_jobs_user_id`
- `idx_dubbing_jobs_voice_id`
- `idx_dubbing_jobs_status`

---

#### `dubbing_projects`
Legacy dubbing project tracking.

**Enum:** `dubbing_status` - dubbed/dubbing/failed/cloning

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `project_id` | text | External project ID |
| `original_audio_name` | text | Original filename |
| `media_name` | text | Display name |
| `target_language` | text | Target language |
| `original_media_url` | text | Source URL |
| `dubbed_url` | text | Output URL |
| `status` | dubbing_status | Current status |
| `is_video` | boolean | Video vs audio |
| `credits_consumed` | integer | Credits used |

**Index:** `idx_dubbing_projects_status`

---

### Voice Cloning

#### `user_voices`
Cloned voices for dubbing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `voice_id` | text | ElevenLabs voice ID |
| `name` | text | Voice name |
| `description` | text | Voice description |
| `sample_url` | text | Sample audio URL |
| `gemini_input_tokens` | integer | AI tokens (input) |
| `gemini_output_tokens` | integer | AI tokens (output) |
| `elevenlabs_voice_clones_created` | integer | Clone count |
| `credits_consumed` | integer | Credits used |

**Index:** `idx_user_voices_user_id`

---

### Documentation

#### `documentation_generations`
AI-generated documentation from code.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `project_name` | text | Project name |
| `files_processed` | integer | Number of files |
| `status` | text | pending/processing/completed/failed |
| `output_format` | text | markdown/html/pdf |
| `generation_time` | integer | Time in seconds |
| `credits_consumed` | integer | Credits used |
| `error_message` | text | Error details |

---

### Subscriptions

#### `plans`
Available subscription tiers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Plan name (UNIQUE) |
| `price_monthly` | numeric | Monthly price (≥0) |
| `credits_monthly` | integer | Monthly credits (≥0) |
| `features` | jsonb | Feature list |
| `is_active` | boolean | Available for purchase |

---

#### `subscriptions`
User subscription status.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `plan_id` | uuid | FK to plans |
| `stripe_subscription_id` | text | Stripe ID (UNIQUE) |
| `status` | text | active/cancelled/past_due |
| `current_period_start` | timestamptz | Period start |
| `current_period_end` | timestamptz | Period end |

---

#### `usage_credits`
Credit usage tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `credits_used` | integer | Credits consumed |
| `credits_remaining` | integer | Available credits |
| `period_start` | timestamptz | Tracking period start |
| `period_end` | timestamptz | Tracking period end (default: +1 month) |

---

### YouTube Integration

#### `youtube_channels`
Connected YouTube channels.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `channel_id` | text | YouTube channel ID |
| `channel_name` | text | Channel name |
| `channel_description` | text | Description |
| `custom_url` | text | Custom URL |
| `country` | text | Country |
| `default_language` | text | Default language |
| `view_count` | bigint | Total views |
| `subscriber_count` | bigint | Subscriber count |
| `video_count` | bigint | Total videos |
| `topic_details` | jsonb | Channel topics |
| `provider_token` | text | OAuth access token |
| `refresh_token` | text | OAuth refresh token |
| `published_at` | timestamptz | Channel creation date |
| `thumbnail` | text | Channel thumbnail |
| `is_linked` | boolean | Active connection |
| `text_color` | text | Branding color |
| `background_color` | text | Branding color |

**Constraint:** `unique_user_channel` (user_id, channel_id)

---

### Settings

#### `user_settings`
User preferences.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users (UNIQUE) |
| `email_notifications` | jsonb | Notification preferences |
| `default_output_format` | text | Default format (default: 'markdown') |
| `api_key_encrypted` | text | Encrypted API key |

**Default notifications:**
```json
{
  "usage_alerts": true,
  "product_updates": false,
  "documentation_updates": true
}
```

---

## Functions

### User Management

#### `handle_new_user()`
**Trigger:** AFTER INSERT on `auth.users`  
**Purpose:** Auto-create profile for new users  
**Actions:**
- Creates profile with user metadata
- Sets `ai_trained = false`

---

#### `generate_referral_code()`
**Returns:** varchar(10)  
**Purpose:** Generate unique 8-character referral code  
**Logic:** MD5 hash loop until unique code found

---

#### `award_referral_credits()`
**Trigger:** AFTER UPDATE on `referrals`  
**Purpose:** Award credits when referral completes  
**Actions:**
- Awards 5 credits to both `credits` and `referral_credits`
- Increments `total_referrals`
- Only processes on status change to 'completed'

---

#### `validate_referral_completion()`
**Trigger:** BEFORE UPDATE on `referrals`  
**Purpose:** Validate and set defaults on completion  
**Actions:**
- Sets `completed_at` if NULL
- Sets `credits_awarded` to 5 if NULL
- Logs completion

---

#### `complete_referral(referral_id uuid)`
**Purpose:** Manually complete a referral  
**Actions:**
- Updates referral status to 'completed'
- Awards credits to referrer

---

#### `sync_existing_referral_credits()`
**Purpose:** One-time sync for existing referrals  
**Actions:**
- Processes all completed referrals with 0 credits_awarded
- Awards 5 credits per referral
- Updates total_referrals

---

#### `check_expired_referrals()`
**Purpose:** Mark expired pending referrals  
**Actions:** Updates status to 'expired' for old pending referrals

---

### Password Reset

#### `increment_otp_attempts(p_email text)`
**Purpose:** Track failed OTP attempts

---

#### `cleanup_expired_password_reset_otps()`
**Purpose:** Clean up OTPs older than 24 hours  
**Actions:**
- Clears OTP fields
- Resets attempt counter

---

### Credits

#### `update_user_credits(user_uuid uuid, credit_change integer)`
**Purpose:** Modify user credit balance  
**Security:** SECURITY DEFINER  
**Actions:**
- Updates credits (+/- credit_change)
- Updates timestamp

---

### Utility

#### `handle_updated_at()`
**Trigger:** BEFORE UPDATE on multiple tables  
**Purpose:** Auto-update `updated_at` timestamp

---

#### `update_updated_at_column()`
**Trigger:** BEFORE UPDATE on multiple tables  
**Purpose:** Alternative updated_at handler

---

## Triggers

### Active Triggers

| Table | Trigger | Function | Timing |
|-------|---------|----------|--------|
| `auth.users` | `on_auth_user_created` | `handle_new_user()` | AFTER INSERT |
| `referrals` | `trigger_award_referral_credits` | `award_referral_credits()` | AFTER UPDATE |
| `referrals` | `trigger_validate_referral_completion` | `validate_referral_completion()` | BEFORE UPDATE |
| `documentation_generations` | `handle_documentation_generations_updated_at` | `handle_updated_at()` | BEFORE UPDATE |
| `dubbing_jobs` | `update_dubbing_jobs_updated_at` | `update_updated_at_column()` | BEFORE UPDATE |
| `subscriptions` | `handle_subscriptions_updated_at` | `handle_updated_at()` | BEFORE UPDATE |
| `subtitle_jobs` | `update_subtitle_jobs_updated_at` | `update_updated_at_column()` | BEFORE UPDATE |
| `usage_credits` | `handle_usage_credits_updated_at` | `handle_updated_at()` | BEFORE UPDATE |
| `user_settings` | `handle_user_settings_updated_at` | `handle_updated_at()` | BEFORE UPDATE |
| `user_style` | `update_user_style_updated_at` | `update_updated_at_column()` | BEFORE UPDATE |

---

## Row Level Security

RLS is **enabled** on all tables. Policies follow these patterns:

### User-Owned Resources
Users can CRUD their own data:
- `profiles`: View/update own profile
- `scripts`: Full CRUD on own scripts
- `user_style`: Full CRUD on own style
- `user_voices`: Full CRUD on own voices
- `subtitle_jobs`: Full CRUD on own jobs
- `dubbing_jobs`: Full CRUD on own jobs
- `research_topics`: Full CRUD on own topics
- `youtube_channels`: Full CRUD on own channels
- `user_settings`: Full CRUD on own settings

### Special Policies

#### `profiles`
- `"Allow referral code lookups"`: Public SELECT where referral_code IS NOT NULL
- `"Allow authenticator to update profiles"`: Admin updates (authenticator role)

#### `referrals`
- `"Allow all referral operations"`: Public access (for referral system)

#### `subtitles`
- View/insert only if user owns parent `subtitle_jobs` record

---

## Storage Buckets

### `dubbing_media` (public)
**Purpose:** Store dubbing audio/video files  
**Policies:**
- Authenticated users: INSERT, SELECT, UPDATE, DELETE

---

### `user_avatar` (public)
**Purpose:** Profile pictures  
**Policies:**
- Authenticated users: Full CRUD
- INSERT: Only image formats (jpg, jpeg, png, gif, bmp, webp)

---

### `video_subtitles` (public)
**Purpose:** Subtitle generation videos  
**Policies:**
- Public: Full CRUD (for subtitle processing)

---

### `assets` (public)
**Purpose:** General application assets

---

### `training-audio` (private)
**Purpose:** Voice training audio files

---

## Key Relationships

```
auth.users
├── profiles (1:1)
│   ├── referrals (as referrer)
│   ├── referrals (as referred_user)
│   ├── scripts (1:n)
│   ├── user_style (1:1)
│   ├── user_voices (1:n)
│   ├── subtitle_jobs (1:n)
│   ├── dubbing_jobs (1:n)
│   ├── dubbing_projects (1:n)
│   ├── research_topics (1:n)
│   ├── youtube_channels (1:n)
│   ├── user_settings (1:1)
│   ├── subscriptions (1:n)
│   └── usage_credits (1:n)
├── subtitle_jobs
│   └── subtitles (1:n)
└── user_voices
    └── dubbing_jobs (1:n)
```

---

## Development Notes

### Credit System
- New users start with 200 credits
- Referrals award 5 credits (to both `credits` and `referral_credits`)
- Credits consumed tracked per feature in respective tables

### Vector Embeddings
- `user_style.embedding`: 1536-dimension vector for style similarity
- Uses HNSW index for fast similarity search
- Requires `pgvector` extension

### Security
- All tables use RLS
- SECURITY DEFINER functions for privileged operations
- Sensitive data (tokens, API keys) should be encrypted

### Constraints
- Unique: user_id combinations for 1:1 relationships
- Check constraints on status enums
- Foreign keys with CASCADE delete for user data

---

## Common Queries

### Get user with credits and referral stats
```sql
SELECT 
  p.*,
  COUNT(r.id) FILTER (WHERE r.status = 'completed') as completed_referrals
FROM profiles p
LEFT JOIN referrals r ON r.referrer_id = p.id
WHERE p.user_id = :user_id
GROUP BY p.id;
```

### Check subscription status
```sql
SELECT s.*, pl.name as plan_name, pl.credits_monthly
FROM subscriptions s
JOIN plans pl ON pl.id = s.plan_id
WHERE s.user_id = :user_id
  AND s.status = 'active'
  AND s.current_period_end > NOW();
```

### Get user's style embeddings
```sql
SELECT embedding <=> :query_embedding as distance
FROM user_style
WHERE user_id = :user_id;
```

---

## Migration Notes

- **Extensions Required:** `pgjwt`, `vector`
- **Auth Schema:** Uses Supabase Auth (`auth.users`)
- **Storage:** Requires storage buckets setup
- **Functions:** All set to `set check_function_bodies = off` for deployment

---

**End of Documentation**