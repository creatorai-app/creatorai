# Creator AI — Requirements

## What is Creator AI?

A personalized AI tool for YouTube creators. It learns your unique style from your existing videos and helps you create content faster — scripts, subtitles, research, dubbing, and more.

---

## Implemented Features

### 1. AI Style Training

- Connect your YouTube channel
- Provide 3–5 video links for the AI to study
- AI analyzes your tone, vocabulary, pacing, humor, and structure
- Real-time training progress shown via live updates
- One-time setup; retrain anytime with new videos

### 2. Script Generation

- Generate video scripts personalized to your style
- Provide a topic, context, tone, and duration
- Optionally attach reference files (PDFs, docs)
- Toggle storytelling mode and timestamps
- Choose output language
- Save, edit, and export scripts as PDF

### 3. Ideation

- Enter an idea to get AI-generated research
- Returns summary, key points, trends, content angles, and sources
- Uses live web search for up-to-date information
- Personalized to your channel's niche when AI is trained
- Save, view, and export research as PDF

### 4. Subtitle Generation

- Upload a video (up to 200 MB, 10 min)
- AI generates timed subtitles automatically
- Translate subtitles to another language
- Edit subtitle text and timing in-app
- Export as SRT or VTT
- Burn subtitles directly into the video

### 5. Audio/Video Dubbing

- Submit a media URL for dubbing into another language
- Supports 24+ target languages
- Real-time dubbing progress via live updates
- View, list, and delete dubbing projects
- Backend fully implemented; frontend marked as coming soon

### 6. User Authentication

- Sign up with email/password or Google
- Email verification required
- Password reset via 6-digit OTP (email)
- OTP expires in 10 minutes, max 5 attempts
- Session-based auth using secure tokens

### 7. Credit System

- Every user starts with 10 free credits
- Credits are consumed per AI operation (scripts, subtitles, research, dubbing, training)
- Credit usage is tracked and deducted automatically
- Credit balance visible in user profile

### 8. Referral Program

- Each user gets a unique referral code
- Share via link; referred users sign up with code
- Track pending and completed referrals
- Earn bonus credits for successful referrals

### 9. User Profile & Settings

- Edit profile name and avatar
- Upload/delete avatar image
- Notification preferences
- Billing information section

### 10. YouTube Channel Integration

- OAuth-based YouTube channel connection
- Fetches channel metadata (name, subscribers, videos, topics)
- Token auto-refresh for uninterrupted access
- Used for AI training and personalized content

---

## Coming Soon (UI present, not yet functional)

### Thumbnail Generator

- Enter video title, description, and style
- AI generates a thumbnail description
- Backend route exists; frontend marked as coming soon

### AI Video Generator

- Page placeholder exists (`/dashboard/video-gen`)
- No implementation yet

---

## Platform Highlights

- Works on desktop and mobile browsers
- Dark mode and light mode supported
- Real-time feedback during long operations (training, dubbing)
- PDF export for scripts and research
- Multi-language support (14+ languages for subtitles, 24+ for dubbing)
- Issue reporting via email from the app

---

## External Services Used


| Service          | Purpose                                                 |
| ---------------- | ------------------------------------------------------- |
| Supabase         | User accounts, database, file storage                   |
| Google Gemini AI | Script writing, research, transcription, style analysis |
| OpenAI GPT-4o    | Subtitle generation, thumbnail descriptions             |
| Murf.ai          | Audio/video dubbing                                     |
| YouTube Data API | Channel data, video metadata                            |
| Resend           | Transactional emails (OTP, welcome, admin)              |
| Redis + BullMQ   | Background job queue for AI training                    |
| FFmpeg           | Video processing and subtitle burning                   |


