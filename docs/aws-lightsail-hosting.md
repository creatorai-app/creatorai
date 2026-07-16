# Hosting CreatorAI on AWS Lightsail — Complete Guide

This guide walks you through deploying CreatorAI (Next.js frontend + NestJS API + BullMQ worker + Redis) on a single AWS Lightsail instance running Docker. Aimed at the **8GB RAM / 2 vCPU / 160GB SSD ($44/month)** tier in **US East (N. Virginia), us-east-1** — chosen to put you closest to a US user base.

> **Why US East (us-east-1)?** It's AWS's largest, lowest-latency region for the bulk of US users (and fine for Canada/EU too), and US regions get the **full data-transfer allowance** — unlike Mumbai, which effectively halves it. If your users skew to the West Coast, pick **US West (Oregon, us-west-2)** instead; everything in this guide is identical, just swap the region name when you create the instance. Lightsail bundle pricing is the same across US regions. Your Vertex AI location stays `global`, so the region change doesn't affect generation.

> **Prerequisites**: A domain name (e.g. tryscriptai.com), a Supabase project, your `.env` values ready, and a GCP service account JSON for Vertex AI.

---

## Part 0 — Why This Setup (Read This First)

Before touching AWS, understand *why* we picked this box, because the architecture matters more than the instance size.

### Sizing: it's concurrency, not total users

Total registered users barely affects sizing — what sizes the box is **concurrent active users at peak** and **request rate**. 50k total users where ~2% are active at peak is ~1,000 concurrent (real load); 50k trickling in across timezones is 50–100 concurrent (trivial). For a bursty creator tool, plan around peak concurrency, not headcount.

### Your heavy work runs *off-box*

Idea/script/thumbnail generation goes out to Vertex AI and other model APIs. So a generation request mostly makes your server **wait on a network call** — it doesn't burn local CPU. Consequences:

- **Good:** CPU is rarely the bottleneck.
- **Bad:** each in-flight generation holds a connection + some RAM for 5–30 seconds. You need enough RAM and worker concurrency to hold many simultaneous slow requests.

**The single biggest factor in whether the box feels smooth is that generation is queued, not inline.** The API endpoint must accept the request, drop a job on BullMQ, and return a job ID immediately; the client polls or uses SSE for the result. If generation runs inline on the Nest request thread, even 50 concurrent users will feel like a hang. Queued, the same box handles far more. This repo already has a `worker` service for exactly this — make sure generation routes through it.

### Why 8GB / 2 vCPU ($44/mo)

| Reason | Detail |
|--------|--------|
| RAM headroom | 8GB lets the worker run real concurrency (10–25 parallel jobs), Redis get a comfortable `maxmemory`, and Next + Nest run without OOM risk during bursts. The $24 4GB tier is too tight. |
| The real constraint | **2 vCPUs**, and Lightsail's are *burstable* (t-class) — sustained CPU above baseline gets throttled. For your I/O-wait-heavy workload that's usually fine, but it's the thing most likely to bite, not RAM. |
| Known next step | If peak concurrency climbs toward 1,000+ hammering SSR/API, move to **4 vCPU / 16GB (~$84/mo)** or split (app on one instance, Redis + worker on another). Don't over-buy now. |

### Four things that matter as much as the box

1. **Queue all generation** through BullMQ (above).
2. **Put a CDN in front of images/thumbnails.** US East ships with the full 4 TB transfer allowance, but serving every image off the instance still eats bandwidth that should go to app traffic and risks egress overages as you grow. Use Lightsail CDN or Supabase Storage + Cloudflare. (Part 14)
3. **Plan for Supabase Pro ($25/mo).** With thousands of active users you'll outgrow the free Postgres tier (connection limits + compute) — this is likely your *first* real ceiling, before the Lightsail box.
4. **Use connection pooling** (Supabase pooler / PgBouncer mode) so a burst of API requests doesn't exhaust Postgres connections.

> **Bottom line:** 8GB / $44 instance, generation fully queued, CDN on images, Supabase Pro as your planned first bottleneck. That serves 10k–50k total users smoothly for an early product, with 4 vCPU as the clear upgrade.

---

## Part 1 — Create Your AWS Account

1. Go to [https://aws.amazon.com](https://aws.amazon.com) and click **Create an AWS Account**.
2. Enter your email, set a root password, and fill in payment details (a credit/debit card is required — you won't be charged yet).
3. Choose the **Basic (Free)** support plan.
4. Once verified, sign in to the [AWS Console](https://console.aws.amazon.com).

> **Tip**: After launch, apply for [AWS Activate](https://aws.amazon.com/activate/) for up to $5,000 in credits for startups.

---

## Part 2 — Create a Lightsail Instance

1. In the AWS Console, search for **Lightsail** and open it, or go directly to [https://lightsail.aws.amazon.com](https://lightsail.aws.amazon.com).
2. Click **Create instance**.
3. Configure:
   - **Region**: **US East (N. Virginia), us-east-1** — best general latency for US users and full data-transfer allowance. (Use **US West (Oregon), us-west-2** if your users skew West Coast.)
   - **Platform**: Linux/Unix.
   - **Blueprint**: OS Only → **Ubuntu 22.04 LTS**.
   - **Plan**: **$44/month** (8 GB RAM, 2 vCPU, 160 GB SSD, 4 TB transfer).
   - **Instance name**: `creatorai-prod` (or whatever you like).
4. Click **Create instance**. It takes ~60 seconds to boot.

> **Docs**: [Create a Lightsail instance](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-amazon-lightsail-instance-virtual-private-server-vps.html)

---

## Part 3 — Assign a Static IP and Open Ports

### 3a. Static IP
1. In Lightsail, go to **Networking** tab → **Create static IP**.
2. Attach it to your `creatorai-prod` instance.
3. Note the IP address (e.g. `13.233.x.x`).

### 3b. Open Firewall Ports
On the instance's **Networking** tab, add these firewall rules:

| Type       | Protocol | Port  | Purpose           |
|------------|----------|-------|--------------------|
| HTTP       | TCP      | 80    | Caddy (redirect)   |
| HTTPS      | TCP      | 443   | Caddy (your app)   |
| SSH        | TCP      | 22    | Already open        |

Remove any other ports (you don't need 8000 or 3000 open — Caddy reverse-proxies internally).

> **Docs**: [Lightsail firewall](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html)

---

## Part 4 — Point Your Domain to the Instance

Go to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.) and add these DNS records:

| Type | Name | Value            |
|------|------|------------------|
| A    | @    | `<your-static-IP>` |
| A    | www  | `<your-static-IP>` |
| A    | api  | `<your-static-IP>` |

Wait for DNS propagation (usually 5–30 minutes, up to 48 hours).

- `tryscriptai.com` → your frontend (Next.js)
- `api.tryscriptai.com` → your backend (NestJS)

---

## Part 5 — SSH Into Your Instance and Install Docker

### 5a. Connect via SSH

**Option A — Browser SSH**: Click the terminal icon on your instance in the Lightsail dashboard.

**Option B — Your own terminal** (recommended for copy-pasting):
1. In Lightsail, go to **Account** → **SSH keys** → download the default key.
2. Connect:
   ```bash
   ssh -i ~/path/to/LightsailDefaultKey.pem ubuntu@<your-static-IP>
   ```

### 5b. Install Docker and Docker Compose

Run these commands one by one on the server:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (so you don't need sudo)
sudo usermod -aG docker ubuntu

# Log out and back in for group change to take effect
exit
```

SSH back in, then verify:

```bash
docker --version
docker compose version
```

Both should print version numbers. Docker Compose v2 is built into Docker now (the `docker compose` command, not the old `docker-compose`).

> **Docs**: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

### 5c. Install Git

```bash
sudo apt install git -y
```

---

## Part 6 — Clone Your Repo and Set Up Environment

Clone the **upstream** repo (the official one), not a fork:

```bash
git clone https://github.com/creatorai-app/creatorai.git
cd creatorai
```

> If the repo is private, the clone will prompt for credentials — use a GitHub **Personal Access Token** as the password (your account password won't work).

### How env works in this project

This is a monorepo with **three separate env files** — there is **no root `.env`**. Each service reads its own:

| File | Used by | Key contents |
|------|---------|--------------|
| `apps/web/.env`        | Next.js frontend | `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY` |
| `apps/api/.env`        | NestJS API       | `SUPABASE_*`, `REDIS_URL`, Vertex AI, Lemon Squeezy, CORS URLs |
| `packages/workers/.env`| BullMQ worker    | `SUPABASE_*`, `REDIS_URL`, Vertex AI, Google OAuth |

Create each from its example and fill in production values:

```bash
cp apps/web/.env.example apps/web/.env && nano apps/web/.env
cp apps/api/.env.example apps/api/.env && nano apps/api/.env
cp packages/workers/.env.example packages/workers/.env && nano packages/workers/.env
```

**Using nano** (the terminal text editor):
- Arrow keys to move, type to edit.
- Save: press **Ctrl+O**, then **Enter**.
- Exit: press **Ctrl+X**.

**Production values that differ from the examples — set these in every file that has them:**

```env
# Redis: use the Docker hostname `redis` + the password (NOT 127.0.0.1)
REDIS_URL=redis://:abcd1234@redis:6379

# Vertex AI: point at the mounted key path inside the container
GOOGLE_APPLICATION_CREDENTIALS=/app/vertex-sa.json

# Real domain (apps/web/.env)
NEXT_PUBLIC_BACKEND_URL=https://api.tryscriptai.com
NEXT_PUBLIC_BASE_URL=https://tryscriptai.com

# Real domain + prod mode (apps/api/.env)
FRONTEND_PROD_URL=https://tryscriptai.com
NODE_ENV=production
```

> ⚠️ **Build-time gotcha for the web app:** Next.js bakes `NEXT_PUBLIC_*` values into the build, so **`apps/web/.env` must exist and be correct *before* you run `docker compose build`** (Part 10). If you build first and create the env later, the frontend will call `localhost` instead of your API. Always create all three env files first.

### Upload your GCP service account key

The compose file mounts `gcp_service_acc.json` (in the repo root) into the api and worker containers at `/app/vertex-sa.json`. Easiest way to get it onto the server:

```bash
nano gcp_service_acc.json
```

Paste the **entire** JSON contents (copied from the file on your PC), then **Ctrl+O**, **Enter**, **Ctrl+X**.

---

## Parts 7–9 — Docker Compose, Web Dockerfile, Caddyfile (already in the repo)

> ✅ **You do not need to create these files.** `docker-compose.prod.yml`, `Dockerfile.web`, `Dockerfile.api`, `Dockerfile.worker`, and `Caddyfile` all ship in the repo. The sections below are kept for **reference only** so you know what each file does. Skip straight to **Part 10 — Build and Launch** unless you want to understand or customize them.
>
> Two things you *may* want to edit:
> - `Caddyfile` — change `tryscriptai.com` to your domain if different.
> - `docker-compose.prod.yml` — the Redis password defaults to `abcd1234`; change it for production (and match it in your `REDIS_URL`).

### Reference: `docker-compose.prod.yml`

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    command: redis-server --requirepass ${REDIS_PASSWORD:-abcd1234} --maxmemory 1gb --maxmemory-policy noeviction --appendonly yes
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-abcd1234}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: api
    env_file:
      - apps/api/.env
    volumes:
      - ./gcp_service_acc.json:/app/vertex-sa.json:ro
    ports:
      - "127.0.0.1:8000:8000"
    depends_on:
      redis:
        condition: service_healthy
    restart: always

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    container_name: worker
    env_file:
      - packages/workers/.env
    volumes:
      - ./gcp_service_acc.json:/app/vertex-sa.json:ro
    depends_on:
      redis:
        condition: service_healthy
    restart: always

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    container_name: web
    env_file:
      - apps/web/.env
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - api
    restart: always

  caddy:
    image: caddy:2-alpine
    container_name: caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
      - api
    restart: always

volumes:
  redis_data:
  caddy_data:
  caddy_config:
```

---

## Part 8 — Create the Web Dockerfile

Your repo has `Dockerfile.api` and `Dockerfile.worker` already. You need one for Next.js:

```bash
nano Dockerfile.web
```

Paste:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_BASE_URL

RUN pnpm exec turbo run build --filter=web

FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
```

> **Note**: This uses Next.js standalone output. You'll need `output: 'standalone'` in your `next.config.js`. If you don't have it, add it (see Step 8b below).

### 8b. Enable standalone output in Next.js

Check if you already have it:

```bash
grep -r "standalone" apps/web/next.config*
```

If not, add `output: 'standalone'` to your Next.js config. This makes the production build self-contained with no `node_modules` needed.

---

## Part 9 — Create the Caddyfile (Automatic HTTPS)

Caddy automatically gets SSL certificates from Let's Encrypt — no manual cert setup needed.

```bash
nano Caddyfile
```

Paste:

```caddyfile
tryscriptai.com, www.tryscriptai.com {
    reverse_proxy web:3000
}

api.tryscriptai.com {
    reverse_proxy api:8000
}
```

That's it. Caddy handles:
- Automatic HTTPS certificate from Let's Encrypt
- HTTP → HTTPS redirect
- Certificate renewal

> Replace `tryscriptai.com` with your actual domain if different.

---

## Part 10 — Build and Launch

```bash
# Build all images (first time takes 5-10 minutes)
docker compose -f docker-compose.prod.yml build

# Start everything
docker compose -f docker-compose.prod.yml up -d

# Check that all containers are running
docker compose -f docker-compose.prod.yml ps
```

You should see 5 containers running: `redis`, `api`, `worker`, `web`, `caddy`.

### Check logs if something goes wrong

```bash
# All logs
docker compose -f docker-compose.prod.yml logs

# Specific service
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs web
docker compose -f docker-compose.prod.yml logs caddy
```

### Test it

- Open `https://tryscriptai.com` — you should see your app with a valid SSL certificate.
- Open `https://api.tryscriptai.com` — should respond (or show a Nest welcome).

---

## Part 11 — Set Up Automatic Snapshots (Backups)

1. In the Lightsail console, click your instance.
2. Go to the **Snapshots** tab.
3. Enable **Automatic snapshots** — Lightsail takes daily snapshots and keeps the last 7.
4. Cost: ~$8/month for 160GB.

If anything goes wrong, you can restore your entire instance from a snapshot in minutes.

> **Docs**: [Lightsail snapshots](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-instance-snapshots-in-amazon-lightsail.html)

---

## Part 12 — Deploy Updates (After Code Changes)

When you push new code to your repo, SSH into the server and run:

```bash
cd ~/creatorai

# Pull latest code
git pull origin main

# Rebuild and restart (only rebuilds changed images)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose -f docker-compose.prod.yml ps
```

### Zero-downtime shortcut

To update one service without stopping others:

```bash
# Rebuild just the API
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api
```

Or just run the bundled deploy script, which does pull + build + restart + cleanup:

```bash
bash ~/creatorai/scripts/deploy.sh
```

---

## Part 12b — Automatic Deploys (CI/CD, like Vercel)

Instead of SSHing in manually, you can have **every push to `main` deploy itself**. The repo ships a GitHub Actions workflow at `.github/workflows/deploy.yml` that SSHes into your server and runs `scripts/deploy.sh`. You just need to give GitHub a key to log in with.

### Step 1 — Make a deploy SSH key (on your local machine)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/lightsail_deploy
```

Press Enter twice (no passphrase — CI can't type one). This creates:
- `~/.ssh/lightsail_deploy` — **private** key (goes into GitHub secrets)
- `~/.ssh/lightsail_deploy.pub` — **public** key (goes onto the server)

### Step 2 — Authorize the key on the server

SSH into the instance (browser SSH is fine) and run, pasting the **public** key contents where shown:

```bash
echo "PASTE_THE_CONTENTS_OF_lightsail_deploy.pub_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Step 3 — Add GitHub repository secrets

In the repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add three:

| Secret name | Value |
|-------------|-------|
| `LIGHTSAIL_HOST` | your static IP, e.g. `98.90.176.169` |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | the **entire** contents of the private key file `~/.ssh/lightsail_deploy` (including the `-----BEGIN...` / `-----END...` lines) |

### Step 4 — That's it

Push to `main` (or merge a PR into it) and watch the **Actions** tab — the deploy runs automatically. You can also trigger it by hand from **Actions → Deploy to Production → Run workflow**.

> **How it works:** the workflow connects over SSH and runs `git reset --hard origin/main` + `docker compose build` + `up -d` on the box. The first deploy takes 5–10 min (full build); later deploys only rebuild changed layers.

### Notes & gotchas

- **Env files are NOT in git** (they're gitignored), so the deploy never touches `apps/web/.env`, `apps/api/.env`, `packages/workers/.env`, or `gcp_service_acc.json`. Those live only on the server — set them once (Part 6) and they persist across deploys.
- **Changed an env var?** The Action won't know — SSH in and edit the file, then `docker compose -f docker-compose.prod.yml up -d` (or re-run the deploy).
- **Building on the box** uses CPU; on the burstable 2-vCPU tier a deploy may briefly slow the live app. Fine for now. When you outgrow it, the cleaner pattern is to build images in GitHub Actions, push to a registry (GHCR), and have the server only `pull` — but that's an optimization for later, not needed at launch.

---

## Part 13 — Monitoring and Maintenance

### Check resource usage

```bash
# Live container stats (CPU, RAM, network)
docker stats

# Disk usage
df -h
```

### Clean up Docker disk space

Docker images pile up. Run this monthly:

```bash
docker system prune -af --volumes
```

> **Warning**: This removes all unused images and volumes. Only run when your containers are running (running containers' images/volumes are protected).

### Set up swap (safety net for RAM spikes)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

This gives you 2GB of swap so a RAM spike doesn't OOM-kill your containers.

---

## Part 14 — Lightsail CDN for Images (Optional but Recommended)

To avoid your instance serving every image directly:

1. In Lightsail, go to **Networking** → **Create distribution**.
2. Set origin to your instance's static IP.
3. Set the default cache behavior to cache static files.
4. Attach your domain (or use the provided CloudFront URL).

Alternatively, serve generated images from **Supabase Storage** — they have a built-in CDN.

> **Docs**: [Lightsail CDN distributions](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-creating-content-delivery-network-distribution.html)

---

## Quick Reference — Common Commands

| Task | Command |
|------|---------|
| Start all services | `docker compose -f docker-compose.prod.yml up -d` |
| Stop all services | `docker compose -f docker-compose.prod.yml down` |
| View logs | `docker compose -f docker-compose.prod.yml logs -f` |
| Restart a service | `docker compose -f docker-compose.prod.yml restart api` |
| SSH into a container | `docker exec -it api sh` |
| Check Redis | `docker exec -it redis redis-cli -a abcd1234 ping` |
| Check disk space | `df -h` |
| Check container stats | `docker stats` |

---

## Cost Summary

| Item | Monthly Cost |
|------|-------------|
| Lightsail 8GB / 2 vCPU (US East) | $44 |
| Automatic snapshots | ~$8 |
| Supabase (free → Pro when needed) | $0 → $25 |
| Lightsail CDN (optional) | $0 (first 50 GB free) |
| **Total** | **~$52/month** |

---

## When to Upgrade

- **CPU throttling** (burstable baseline exceeded): Upgrade to 4 vCPU / 16GB ($84/month).
- **Supabase connection limits hit**: Upgrade to Supabase Pro ($25/month) and enable connection pooling (PgBouncer mode).
- **1,000+ concurrent users**: Consider splitting — app on one instance, Redis + worker on another.

---

## Troubleshooting

**Caddy not getting SSL cert?**
- Make sure ports 80 and 443 are open in Lightsail firewall.
- Make sure your DNS A records point to the correct static IP.
- Check: `docker compose -f docker-compose.prod.yml logs caddy`

**Container keeps restarting?**
- Check logs: `docker compose -f docker-compose.prod.yml logs <service-name>`
- Usually a missing env variable or wrong Redis URL.

**Out of disk space?**
- Run `docker system prune -af` to clean old images.
- Check with `df -h`.

**API can't reach Redis?**
- Inside Docker, use `redis` as the hostname (not `localhost`).
- `REDIS_URL=redis://:abcd1234@redis:6379`

**Worker not processing jobs?**
- Check worker logs: `docker compose -f docker-compose.prod.yml logs worker`
- Verify the worker `.env` has the same Redis URL as the API.
