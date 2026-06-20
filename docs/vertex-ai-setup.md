# Vertex AI Setup — Beginner-Friendly Guide

This guide gets Creator AI talking to **Google Vertex AI** (where the Gemini models run in
production). No prior Google Cloud experience needed — just follow along top to bottom.

**Time needed:** ~15 minutes. **Cost:** covered by your $300 free trial credit.

---

## What you're setting up (in plain English)

- **GCP project** — a container for everything you do on Google Cloud (you already have one).
- **Vertex AI API** — the "switch" that lets your project call Gemini. It's off by default.
- **Service account** — a *robot user* for your app. Your code logs in as this robot instead of
  as you, so it can call Gemini on its own (e.g. on your server, at 3am, with no human around).
- **Role** — the permission you give that robot. We give it exactly one: "may use Vertex AI."
- **Credentials (ADC)** — the robot's "password." Two flavors:
  - On **your laptop**: you log in once with your own Google account (no password file).
  - On a **server**: a small JSON key file the robot uses to log in.

You'll do these in order: **① turn on the API → ② create the robot → ③ give it permission →
④ get its login → ⑤ fill in env vars → ⑥ test.**

> Throughout, replace `YOUR_PROJECT_ID` with your real project ID. Find it at the top of the
> [Google Cloud Console](https://console.cloud.google.com/) — click the project dropdown; the ID
> is the short string like `creator-ai-12345` (NOT the friendly name).

---

## ① Turn on the Vertex AI API

**Easiest (Console — clicking):**
1. Go to <https://console.cloud.google.com/>.
2. Make sure the correct project is selected in the dropdown at the top.
3. In the search bar at the top, type **Vertex AI API** and click the result.
4. Click the blue **Enable** button. Wait ~30 seconds. Done.

> If it says "Manage" instead of "Enable", it's already on. 

**If you have billing not yet linked:** the console will prompt you to attach a billing account.
Your free $300 credit lives in that billing account, so this is expected and safe.

---

## ② Create the service account (the robot user)

1. In the search bar, type **Service Accounts** and open it (under IAM & Admin).
2. Click **+ Create service account** at the top.
3. **Service account name:** `creator-ai-vertex` (the ID fills in automatically).
4. Click **Create and continue**.

---

## ③ Give the robot permission to use Vertex AI

Still on the "Create service account" screen, in the **Grant this service account access** step:
1. Click the **Select a role** dropdown.
2. Type **Vertex AI User** and pick it. (This is the only role it needs.)
3. Click **Continue**, then **Done**.

You'll land back on the service accounts list and see `creator-ai-vertex@YOUR_PROJECT_ID.iam.gserviceaccount.com`.

---

## ④ Get the robot's login (pick ONE path)

### Path A — Running on your own computer (local development)

The simplest option — no key file to manage. You log in once with **your own** Google account and
your code borrows that login.

1. Install the Google Cloud CLI (`gcloud`): <https://cloud.google.com/sdk/docs/install> — download,
   run the installer, accept the defaults.
2. Open a **new** terminal and run:
   ```bash
   gcloud auth application-default login
   ```
3. A browser opens — pick your Google account and click **Allow**.
4. That's it. Your machine now has the login saved. (You can skip the JSON key file entirely.)

### Path B — Running on a server / VPS (production)

A server has no human to click "Allow", so it needs the robot's own key file.

1. In the search bar, open **Service Accounts** again and click your `creator-ai-vertex` account.
2. Go to the **Keys** tab → **Add key** → **Create new key** → choose **JSON** → **Create**.
3. A `.json` file downloads. **This is a password — keep it secret:**
   - Never commit it to git (it's already covered by `.gitignore` patterns for `.json` secrets —
     double-check before pushing).
   - Upload it to your server (e.g. to `/etc/creator-ai/vertex-sa.json`).
4. You'll point `GOOGLE_APPLICATION_CREDENTIALS` at this file's path in the next step.

> **On Cloud Run / GKE / Cloud Functions?** Even simpler: attach the `creator-ai-vertex` service
> account to the service in its settings and **skip the key file** — Google injects the login
> automatically. Leave `GOOGLE_APPLICATION_CREDENTIALS` unset in that case.

---

## ⑤ Fill in your environment variables

Open your env file(s) and add these. The app's backend and the worker both need them, so put them
in the **root `.env`** (both inherit it), or in each of `apps/api/.env` and
`packages/train-ai-worker/.env`.

```bash
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
GOOGLE_CLOUD_LOCATION=global
# Only if you used Path B (server with a key file). Omit this line for Path A / Cloud Run:
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/vertex-sa.json
```

What each one means:
- `GOOGLE_GENAI_USE_VERTEXAI=true` — "use Vertex, not the old AI Studio key."
- `GOOGLE_CLOUD_PROJECT` — which project to bill and run in.
- `GOOGLE_CLOUD_LOCATION=global` — which region serves the model. `global` = best availability;
  if a model ever isn't offered there, switch to `us-central1`.
- `GOOGLE_APPLICATION_CREDENTIALS` — path to the robot's key file (Path B only).

> You do **not** need `GOOGLE_GENERATIVE_AI_API_KEY` anymore — that was the old AI Studio key.

---

## ⑥ Test that it works

From the `apps/api` folder, run the smoke test:

```bash
cd apps/api
node scripts/vertex-smoke-test.mjs
```

A successful run prints something like:
```
→ Vertex AI: project=YOUR_PROJECT_ID location=global
✅ gemini-3.5-flash: VERTEX_OK
✅ gemini-embedding-001: embedding length = 1536 (expected 1536)
🎉 Vertex AI is wired up correctly.
```

Then start the app as usual and try each feature: script generation, ideation, course modules,
story builder, AI training, thumbnails, subtitles, and dubbing.

---

## Troubleshooting (common first-time errors)

| Message contains… | What it means | Fix |
|---|---|---|
| `PERMISSION_DENIED` / `aiplatform.endpoints.predict` | The robot lacks permission | Re-check **③** — the role must be **Vertex AI User** on the right project |
| `has not been used in project` / `API ... disabled` | API not enabled | Redo **①** for the correct project |
| `Could not load the default credentials` | No login found | Path A: re-run `gcloud auth application-default login`. Path B: check `GOOGLE_APPLICATION_CREDENTIALS` points to a real file |
| `GOOGLE_CLOUD_PROJECT is not configured` | Env var missing | Double-check **⑤**; restart the app after editing `.env` |
| `model ... not found` / `not supported in region` | Model not served in your location | Set `GOOGLE_CLOUD_LOCATION=us-central1` and retry |
| `RESOURCE_EXHAUSTED` / quota | Hit a rate/quota limit | In Console → Vertex AI → Quotas, request an increase |

---

## Where the credits go

You're billed per token (text) and per image (thumbnails). The $300 trial credit covers a lot of
usage. You can watch spend in **Console → Billing → Reports** (filter by the Vertex AI service).
