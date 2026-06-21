# 🚀 Development Setup Guide

This guide will help you set up the Creator AI development environment on your local machine.

## 📋 Prerequisites

Before you begin, make sure you have the following installed:

### Required Software

- **Node.js** 18.x or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`

- **pnpm** package manager
  - Install: `npm install -g pnpm`
  - Verify installation: `pnpm --version`

- **Git** for version control
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify installation: `git --version`

### Recommended Tools

- **VS Code** with extensions:
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - Prettier - Code formatter
  - ESLint
  - GitLens
  - Auto Rename Tag

- **Postman** or **Insomnia** for API testing
- **Docker** (optional, for local database)

## 🔧 Environment Setup

### 1. Clone the Repository

```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/scriptai.git
cd scriptai

# Add upstream remote
git remote add upstream https://github.com/scriptaiapp/scriptai.git
```

### 2. Install Dependencies

```bash
# Install all dependencies
pnpm install
```

### 3. Environment Configuration

#### Frontend Environment

```bash
# Copy the example environment file
cp apps/web/env.example apps/web/.env

# Edit the file with your actual values
nano apps/web/.env
```

#### Backend Environment

```bash
# Copy the example environment file
cp apps/api/env.example apps/api/.env

# Edit the file with your actual values
nano apps/api/.env
```

### 4. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note down your project URL and API keys

2. **Database Schema**
   - The database schema will be set up automatically when you first run the application
   - Or you can run the migration scripts manually

3. **API Keys**
   - **Anon Key**: Used by the frontend for public operations
   - **Service Key**: Used by the backend for admin operations

### 5. AI Services Setup

#### Google Vertex AI (Gemini)
Gemini runs on **Vertex AI** (production), authenticated via Application Default Credentials (ADC) — no API key.
1. In your GCP project, enable the **Vertex AI API**: `gcloud services enable aiplatform.googleapis.com`
2. Create a service account and grant it **Vertex AI User** (`roles/aiplatform.user`).
3. Authenticate:
   - **Local dev:** `gcloud auth application-default login`
   - **Server/VPS:** create a JSON key and set `GOOGLE_APPLICATION_CREDENTIALS` to its path
   - **Cloud Run/GKE:** attach the service account (no key file needed)
4. Set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` (e.g. `global`) in your backend + worker env.

#### Optional Services
- **OpenAI**: For additional AI features
- **Murf.ai**: For video/audio dubbing (requires MURF_API_KEY)
- **Stripe**: For payment processing

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start all services
pnpm run dev

# Or start individual services
pnpm run dev --filter=web
pnpm run dev --filter=api
```

### Access Points

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Documentation**: [http://localhost:8000/api](http://localhost:8000/api)

### Production Build

```bash
# Build all packages
pnpm run build

# Start production servers
pnpm run start
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run E2E tests
pnpm run test:e2e

# Run tests for specific package
pnpm run test --filter=web
```

### Test Coverage

```bash
# Generate coverage report
pnpm run test:coverage
```

## 🔍 Development Tools

### Code Quality

```bash
# Lint code
pnpm run lint

# Type checking
pnpm run type-check

# Format code
pnpm run format
```

### Database Management

```bash
# Access Supabase dashboard
# Go to your project dashboard for database management

# Or use Supabase CLI (if installed)
supabase db reset
supabase db push
```

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different ports
pnpm run dev:new  # Uses port 4000
```

#### Dependency Issues
```bash
# Clear cache and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

#### Environment Variables
- Make sure all required environment variables are set
- Check that file names are correct (`.env.local` for web, `.env` for api)
- Restart development servers after changing environment variables

#### TypeScript Errors
```bash
# Run type checking
pnpm run type-check

# Check for missing types
pnpm install @types/node @types/react
```

### Getting Help

1. **Check existing issues** on GitHub
2. **Search the documentation**
3. **Ask in Discord**: [https://discord.gg/f6AG7kt7](https://discord.gg/f6AG7kt7)
4. **Create an issue** with the "Question" template

## 📚 Next Steps

Once your environment is set up:

1. **Read the Contributing Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
2. **Check for Good First Issues**: Look for issues labeled `good first issue`
3. **Join the Community**: Connect with other contributors on Discord
4. **Start Contributing**: Pick an issue and create a pull request

## 🔄 Keeping Up to Date

```bash
# Update your fork with upstream changes
git checkout main
git pull upstream main
git push origin main
```

---

**Happy coding! 🎬**

If you encounter any issues during setup, please don't hesitate to ask for help in our Discord community.
