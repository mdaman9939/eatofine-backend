import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class AppController {
  /** Friendly landing page so visiting the deployed base URL doesn't 404. */
  @Get('/')
  @Header('content-type', 'text/html; charset=utf-8')
  root(): string {
    const uptime = process.uptime();
    const startedAt = new Date(Date.now() - uptime * 1000).toISOString();
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Eatofine API · Running</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      *,*::before,*::after { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: linear-gradient(180deg, #047857 0%, #10b981 45%, #6ee7b7 100%);
        color: #fff; display: flex; align-items: center; justify-content: center; padding: 24px;
      }
      .card {
        max-width: 640px; width: 100%; background: rgba(255,255,255,0.08);
        backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.18);
        border-radius: 24px; padding: 40px 36px; box-shadow: 0 20px 60px rgba(4,120,87,0.35);
      }
      .eyebrow {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.85);
      }
      .pulse {
        width: 8px; height: 8px; border-radius: 50%; background: #4ade80;
        box-shadow: 0 0 0 0 rgba(74,222,128,0.7); animation: pulse 2s infinite;
      }
      @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); } 70% { box-shadow: 0 0 0 12px rgba(74,222,128,0); } 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); } }
      h1 { font-size: 32px; font-weight: 800; margin: 16px 0 4px; letter-spacing: -0.02em; }
      p.lead { font-size: 15px; color: rgba(255,255,255,0.85); margin: 0 0 24px; line-height: 1.55; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 22px; }
      .stat { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px 16px; }
      .stat .label { font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.7); }
      .stat .value { font-size: 16px; font-weight: 700; margin-top: 4px; word-break: break-all; }
      .footer { font-size: 12px; color: rgba(255,255,255,0.7); border-top: 1px solid rgba(255,255,255,0.12); padding-top: 18px; }
      code { background: rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 6px; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="eyebrow"><span class="pulse"></span> Backend is running correctly</div>
      <h1>Eatofine API</h1>
      <p class="lead">
        Welcome 👋. The Eatofine backend is live and serving requests from MongoDB Atlas.
        All admin, customer, vendor and delivery-partner endpoints are mounted under
        <code>/api/v1</code>.
      </p>
      <div class="grid">
        <div class="stat">
          <div class="label">Status</div>
          <div class="value">✅ Healthy</div>
        </div>
        <div class="stat">
          <div class="label">Database</div>
          <div class="value">MongoDB Atlas</div>
        </div>
        <div class="stat">
          <div class="label">Uptime</div>
          <div class="value">${this.formatUptime(uptime)}</div>
        </div>
        <div class="stat">
          <div class="label">Started</div>
          <div class="value">${startedAt.slice(0, 19).replace('T', ' ')} UTC</div>
        </div>
      </div>
      <div class="footer">
        Try <code>GET /api/v1</code> for the API health check, or
        <code>GET /health</code> for a quick JSON ping.
      </div>
    </div>
  </body>
</html>`;
  }

  /** Simple JSON health endpoint — for uptime monitors / cron-job pings. */
  @Get('/health')
  health() {
    return {
      ok: true,
      service: 'eatofine-api',
      database: 'MongoDB Atlas',
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** API root (now reachable at /api/v1) — returns service metadata. */
  @Get()
  apiRoot() {
    return {
      service: 'eatofine-api',
      version: '1.0.0',
      database: 'MongoDB Atlas',
      status: 'running',
      docs: '/api/v1',
    };
  }

  private formatUptime(seconds: number): string {
    const s = Math.round(seconds);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
}
