# Eatofine API — Production Runbook

Quick-reference for deploying and operating the NestJS backend.

---

## 1. Generate secrets

```bash
# JWT_SECRET — 32 random bytes as hex
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or:
openssl rand -hex 32
```

Set the output as `JWT_SECRET` in your Render dashboard. **Rotate this any time it leaks.**

---

## 2. Render environment variables

| Variable | Value | Required |
|---|---|---|
| `NODE_ENV` | `production` | ✅ |
| `JWT_SECRET` | (32-byte hex from step 1) | ✅ |
| `MONGO_USER` | `aman_admin` | ✅ |
| `MONGO_PASSWORD` | (literal — encoder runs at boot) | ✅ |
| `MONGO_HOSTS` | `ac-...mongodb.net:27017,...` | ✅ |
| `MONGO_DATABASE` | `eatofine` | ✅ |
| `MONGO_REPLICA_SET` | `atlas-fv6e0i-shard-0` | ✅ |
| `MONGO_AUTH_SOURCE` | `admin` | ✅ |
| `CORS_ORIGINS` | `https://<vercel-app>.vercel.app` | ✅ (prod) |
| `STORAGE_BASE_URL` | `https://eatofine-backend.onrender.com/storage` | ✅ |
| `AUTH_THROTTLE_LIMIT` | `5` | optional |
| `AUTH_THROTTLE_TTL` | `900000` (15 min in ms) | optional |
| `PORT` | (auto-injected by Render) | — |

The app **refuses to boot** if any required var is missing or `JWT_SECRET` is a placeholder. See [src/common/env.validation.ts](src/common/env.validation.ts).

---

## 3. Rate limiting

| Bucket | Limit | Where |
|---|---|---|
| `auth` | 5 req / 15 min per IP | All `/api/v1/auth/*` routes (login, signup) |
| `default` | 120 req / min per IP | Everything else |

Tune via `AUTH_THROTTLE_LIMIT` + `AUTH_THROTTLE_TTL` env vars.

---

## 4. Health & uptime monitoring

### Endpoints

- `GET /` → friendly HTML status page (uptime, started-at).
- `GET /health` → JSON, **pings MongoDB**. Returns `503` if Mongo is down.

```json
{
  "ok": true,
  "service": "eatofine-api",
  "database": {
    "name": "MongoDB Atlas",
    "state": "connected",
    "ping_ok": true,
    "latency_ms": 12,
    "error": null
  },
  "uptime_seconds": 3421,
  "timestamp": "2026-06-01T..."
}
```

### Render free tier — keep-warm setup

Render free tier sleeps after 15 min of idle. Without a pinger, the first request after sleep takes 30–60s.

**Option A — UptimeRobot (recommended, free)**

1. Sign up at [uptimerobot.com](https://uptimerobot.com).
2. Add New Monitor:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Eatofine API
   - **URL:** `https://eatofine-backend.onrender.com/health`
   - **Interval:** 5 min (free) or 1 min (paid)
3. Alert contacts → email/SMS/Slack.

UptimeRobot will:
- Keep Render warm (no cold starts during business hours).
- Page you when `/health` returns 503 (MongoDB down).

**Option B — `cron-job.org`** (free, simpler) — same idea, 5 min interval.

**Option C — Render's built-in health checks**
Render dashboard → service → Settings → Health Check Path: `/health`. Render will restart the instance if `/health` 5xxs repeatedly.

---

## 5. CORS

`CORS_ORIGINS` is a comma-separated allowlist. In production, **wildcards are rejected by env validation** — list explicit origins:

```
CORS_ORIGINS=https://eatofine-admin.vercel.app,https://staging-eatofine.vercel.app
```

If empty / unset in **development**, CORS is open (`*`). In **production**, env validation refuses boot.

---

## 6. Deploy checklist

Before every prod deploy:

- [ ] `npm run build` passes locally.
- [ ] All required env vars set on Render (see table above).
- [ ] `JWT_SECRET` is unique per environment (never reuse dev secret).
- [ ] `CORS_ORIGINS` matches the Vercel URL that's actually deployed.
- [ ] UptimeRobot monitor is green.
- [ ] After deploy: `curl https://eatofine-backend.onrender.com/health` returns `ok: true`.

---

## 7. Common errors

| Symptom | Likely cause | Fix |
|---|---|---|
| Boot fails: `Environment validation failed` | Missing env var | Check Render dashboard against table above |
| `JWT_SECRET ... too short` | Placeholder secret | Regenerate (step 1) |
| `/health` → 503 with `database.error` | Mongo Atlas IP allowlist | Atlas → Network Access → add `0.0.0.0/0` (or Render IP range) |
| `429 Too Many Requests` on login | Rate limited (5/15min) | Wait, or bump `AUTH_THROTTLE_LIMIT` |
| Login works locally, fails in prod with CORS | `CORS_ORIGINS` not set on Render | Set it to your Vercel URL |
| File uploads vanish after deploy | Render disk is ephemeral | Move uploads to Cloudinary/S3 (see Task Sheet 1, item 1.8) |

---

## 8. Files touched in production hardening

| Concern | File |
|---|---|
| JWT secret enforcement | [src/auth/auth.module.ts](src/auth/auth.module.ts) |
| Env validation | [src/common/env.validation.ts](src/common/env.validation.ts) |
| Global exception filter | [src/common/all-exceptions.filter.ts](src/common/all-exceptions.filter.ts) |
| Throttler wiring | [src/app.module.ts](src/app.module.ts) |
| Auth throttle decorator | [src/auth/auth.controller.ts](src/auth/auth.controller.ts) |
| Mongo-pinging health | [src/app.controller.ts](src/app.controller.ts) |
| Boot-time validation + ValidationPipe + filter | [src/main.ts](src/main.ts) |
