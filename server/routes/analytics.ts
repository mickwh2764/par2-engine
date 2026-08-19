import type { Express, Request, Response } from "express";
import { createHash } from "crypto";
import { storage } from "../storage";
import { logger } from "../logger";
import fs from "fs";
import path from "path";

interface AnalyticsSession {
  id: string;
  userAgent: string;
  country: string | null;
  city: string | null;
  pages: string[];
  eventCount: number;
  uploads: number;
  analyses: number;
  firstSeen: string;
  lastSeen: string;
  durationMinutes: number;
  tier: 'bounce' | 'browser' | 'engaged' | 'power';
  isSelf: boolean;
}

interface EngagementSummary {
  bounce: number;
  browser: number;
  engaged: number;
  power: number;
  totalSessions: number;
}

function isSelfTraffic(e: { userAgent?: string | null; referrer?: string | null; country?: string | null; city?: string | null; page?: string | null }): boolean {
  const ua = e.userAgent || '';
  const ref = e.referrer || '';
  if (ua.includes('HeadlessChrome')) return true;
  if (ref.includes('__replco/workspace_iframe') || ref.includes('riker.replit.dev/__replco')) return true;
  if (ref.includes('replit.com')) return true;
  if (e.country === 'Ireland' || e.city === 'Dublin') return true;
  if (e.page === '/analytics') return true;
  return false;
}

function buildSessions(events: Array<{
  id: string; eventType: string; page: string | null; country: string | null;
  city: string | null; userAgent: string | null; referrer: string | null;
  sessionId: string | null; createdAt: Date;
}>): AnalyticsSession[] {
  const buckets = new Map<string, typeof events>();
  for (const e of events) {
    const key = (e.userAgent || 'unknown').slice(0, 100) + '|' + (e.country || '') + '|' + (e.city || '');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }

  const sessions: AnalyticsSession[] = [];
  let sessionIdx = 0;

  for (const [, bucket] of buckets) {
    const sorted = bucket.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let currentSession: typeof events = [];

    for (const evt of sorted) {
      if (currentSession.length === 0) {
        currentSession.push(evt);
      } else {
        const gap = evt.createdAt.getTime() - currentSession[currentSession.length - 1].createdAt.getTime();
        if (gap > 30 * 60 * 1000) {
          sessions.push(finalizeSession(currentSession, sessionIdx++));
          currentSession = [evt];
        } else {
          currentSession.push(evt);
        }
      }
    }
    if (currentSession.length > 0) {
      sessions.push(finalizeSession(currentSession, sessionIdx++));
    }
  }

  sessions.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  return sessions;
}

function finalizeSession(events: Array<{
  id: string; eventType: string; page: string | null; country: string | null;
  city: string | null; userAgent: string | null; referrer: string | null;
  sessionId: string | null; createdAt: Date;
}>, idx: number): AnalyticsSession {
  const pages: string[] = [];
  const seen = new Set<string>();
  let uploads = 0;
  let analyses = 0;
  for (const e of events) {
    if (e.page && !seen.has(e.page)) { pages.push(e.page); seen.add(e.page); }
    if (e.eventType === 'file_upload') uploads++;
    if (e.eventType === 'analysis_run') analyses++;
  }
  const first = events[0];
  const last = events[events.length - 1];
  const durationMinutes = Math.round((last.createdAt.getTime() - first.createdAt.getTime()) / 60000);
  const self = isSelfTraffic(first);

  let tier: AnalyticsSession['tier'] = 'bounce';
  if (uploads > 0 || analyses > 0) tier = 'power';
  else if (pages.length >= 6) tier = 'engaged';
  else if (pages.length >= 2) tier = 'browser';

  return {
    id: `session-${idx}`,
    userAgent: (first.userAgent || 'Unknown').slice(0, 120),
    country: first.country,
    city: first.city,
    pages,
    eventCount: events.length,
    uploads,
    analyses,
    firstSeen: first.createdAt.toISOString(),
    lastSeen: last.createdAt.toISOString(),
    durationMinutes,
    tier,
    isSelf: self,
  };
}

function computeEngagement(sessions: AnalyticsSession[]): EngagementSummary {
  const summary: EngagementSummary = { bounce: 0, browser: 0, engaged: 0, power: 0, totalSessions: sessions.length };
  for (const s of sessions) summary[s.tier]++;
  return summary;
}

// --- Rate limiting (shared state for this module) ---
export const passwordAttempts = new Map<string, { count: number; lockedUntil: number }>();
export const MAX_ATTEMPTS = 3;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function checkPasswordRateLimit(req: Request, res: Response): boolean {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = passwordAttempts.get(ip) || { count: 0, lockedUntil: 0 };

    if (record.lockedUntil > now) {
      const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
      res.status(429).json({ error: "Too many attempts", lockedOut: true, remainingSeconds: remainingSec });
      return false;
    }
    return true;
  }

export function recordFailedAttempt(req: Request, res: Response): void {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = passwordAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
      record.count = 0;
      passwordAttempts.set(ip, record);
      const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
      logger.warn('Password rate limit lockout', { ipHash, lockoutMinutes: 15 });
      res.status(429).json({ error: "Too many attempts. Locked out for 15 minutes.", lockedOut: true, remainingSeconds: 900 });
      return;
    }
    passwordAttempts.set(ip, record);
    res.status(403).json({ error: "Unauthorized", attemptsRemaining: MAX_ATTEMPTS - record.count });
  }

export function clearAttempts(req: Request): void {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    passwordAttempts.delete(ip);
  }


export function registerAnalyticsRoutes(app: Express): void {
  app.post("/api/verify-download-password", (req: Request, res: Response) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body || {};
    const expectedPassword = process.env.DRAFT_PAPER_PASSWORD;

    if (!expectedPassword) {
      return res.json({ valid: false });
    }

    if (password !== expectedPassword) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    return res.json({ valid: true });
  });

  app.post("/api/verify-paper-g-password", (req: Request, res: Response) => {
    if (!checkPasswordRateLimit(req, res)) return;
    const { password } = req.body || {};
    const expectedPassword = process.env.PAPER_G_PASSWORD;

    if (!expectedPassword) {
      return res.json({ valid: false });
    }

    if (password !== expectedPassword) {
      return recordFailedAttempt(req, res);
    }
    clearAttempts(req);
    return res.json({ valid: true });
  });

  // Health check endpoint for monitoring
  app.get("/api/health", async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Check database connectivity
      const dbHealthy = await storage.healthCheck().catch(() => false);
      
      // Check filesystem access
      const fsHealthy = fs.existsSync(path.join(process.cwd(), 'datasets'));
      
      // Get memory usage
      const memUsage = process.memoryUsage();
      const memoryMB = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      };
      
      const status = dbHealthy && fsHealthy ? 'healthy' : 'degraded';
      const statusCode = status === 'healthy' ? 200 : 503;
      
      logger.debug('Health check performed', { status, dbHealthy, fsHealthy });
      
      res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        version: '1.0.0',
        checks: {
          database: dbHealthy ? 'ok' : 'error',
          filesystem: fsHealthy ? 'ok' : 'error'
        },
        memory: memoryMB,
        responseTimeMs: Date.now() - startTime
      });
    } catch (error) {
      logger.error('Health check failed', { error: String(error) });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Analytics: track page visits and events
  const allowedEventTypes = new Set(['page_view', 'analysis_run', 'file_upload', 'download', 'file_download', 'share_link', 'session_validated', 'heartbeat', 'dataset_run']);
  const geoCache = new Map<string, { country: string | null; city: string | null; region: string | null; ts: number }>();

  const timezoneToLocation: Record<string, { country: string; region: string }> = {
    'America/New_York': { country: 'United States', region: 'Eastern US' },
    'America/Chicago': { country: 'United States', region: 'Central US' },
    'America/Denver': { country: 'United States', region: 'Mountain US' },
    'America/Los_Angeles': { country: 'United States', region: 'Western US' },
    'America/Phoenix': { country: 'United States', region: 'Arizona' },
    'America/Anchorage': { country: 'United States', region: 'Alaska' },
    'Pacific/Honolulu': { country: 'United States', region: 'Hawaii' },
    'America/Toronto': { country: 'Canada', region: 'Ontario' },
    'America/Vancouver': { country: 'Canada', region: 'British Columbia' },
    'America/Edmonton': { country: 'Canada', region: 'Alberta' },
    'America/Winnipeg': { country: 'Canada', region: 'Manitoba' },
    'America/Halifax': { country: 'Canada', region: 'Nova Scotia' },
    'America/Montreal': { country: 'Canada', region: 'Quebec' },
    'Europe/London': { country: 'United Kingdom', region: 'England' },
    'Europe/Paris': { country: 'France', region: 'Île-de-France' },
    'Europe/Berlin': { country: 'Germany', region: 'Berlin' },
    'Europe/Amsterdam': { country: 'Netherlands', region: 'North Holland' },
    'Europe/Brussels': { country: 'Belgium', region: 'Brussels' },
    'Europe/Rome': { country: 'Italy', region: 'Lazio' },
    'Europe/Madrid': { country: 'Spain', region: 'Madrid' },
    'Europe/Zurich': { country: 'Switzerland', region: 'Zurich' },
    'Europe/Stockholm': { country: 'Sweden', region: 'Stockholm' },
    'Europe/Copenhagen': { country: 'Denmark', region: 'Capital Region' },
    'Europe/Oslo': { country: 'Norway', region: 'Oslo' },
    'Europe/Helsinki': { country: 'Finland', region: 'Uusimaa' },
    'Europe/Vienna': { country: 'Austria', region: 'Vienna' },
    'Europe/Warsaw': { country: 'Poland', region: 'Masovia' },
    'Europe/Prague': { country: 'Czech Republic', region: 'Prague' },
    'Europe/Dublin': { country: 'Ireland', region: 'Leinster' },
    'Europe/Lisbon': { country: 'Portugal', region: 'Lisbon' },
    'Europe/Athens': { country: 'Greece', region: 'Attica' },
    'Europe/Bucharest': { country: 'Romania', region: 'Bucharest' },
    'Europe/Moscow': { country: 'Russia', region: 'Moscow' },
    'Europe/Istanbul': { country: 'Turkey', region: 'Istanbul' },
    'Asia/Tokyo': { country: 'Japan', region: 'Tokyo' },
    'Asia/Shanghai': { country: 'China', region: 'Shanghai' },
    'Asia/Hong_Kong': { country: 'Hong Kong', region: 'Hong Kong' },
    'Asia/Seoul': { country: 'South Korea', region: 'Seoul' },
    'Asia/Singapore': { country: 'Singapore', region: 'Singapore' },
    'Asia/Kolkata': { country: 'India', region: 'Maharashtra' },
    'Asia/Dubai': { country: 'UAE', region: 'Dubai' },
    'Asia/Jerusalem': { country: 'Israel', region: 'Jerusalem' },
    'Asia/Taipei': { country: 'Taiwan', region: 'Taipei' },
    'Asia/Bangkok': { country: 'Thailand', region: 'Bangkok' },
    'Asia/Jakarta': { country: 'Indonesia', region: 'Jakarta' },
    'Australia/Sydney': { country: 'Australia', region: 'New South Wales' },
    'Australia/Melbourne': { country: 'Australia', region: 'Victoria' },
    'Australia/Perth': { country: 'Australia', region: 'Western Australia' },
    'Australia/Brisbane': { country: 'Australia', region: 'Queensland' },
    'Pacific/Auckland': { country: 'New Zealand', region: 'Auckland' },
    'America/Mexico_City': { country: 'Mexico', region: 'Mexico City' },
    'America/Sao_Paulo': { country: 'Brazil', region: 'São Paulo' },
    'America/Argentina/Buenos_Aires': { country: 'Argentina', region: 'Buenos Aires' },
    'America/Bogota': { country: 'Colombia', region: 'Bogotá' },
    'America/Lima': { country: 'Colombia', region: 'Lima' },
    'Africa/Cairo': { country: 'Egypt', region: 'Cairo' },
    'Africa/Johannesburg': { country: 'South Africa', region: 'Gauteng' },
    'Africa/Lagos': { country: 'Nigeria', region: 'Lagos' },
    'Africa/Nairobi': { country: 'Kenya', region: 'Nairobi' },
  };

  const botPatterns = /bot|crawl|spider|wget|curl|python|headless|phantom|selenium|scrapy|slurp|mediapartners|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|bingpreview|googleother|bytespider|yandex|baidu|semrush|ahrefs|mj12bot|dotbot|petalbot|archive\.org|uptimerobot|pingdom|statuscake|site24x7|monitor/i;

  const recentHits = new Map<string, number>();
  setInterval(() => {
    const cutoff = Date.now() - 10000;
    for (const [key, ts] of recentHits) {
      if (ts < cutoff) recentHits.delete(key);
    }
  }, 30000);

  app.post("/api/app/event", async (req, res) => {
    try {
      const { eventType, page, sessionId, referrer, timezone, language, validated } = req.body;
      if (!eventType || typeof eventType !== 'string' || !allowedEventTypes.has(eventType)) {
        return res.status(400).json({ error: "Invalid eventType" });
      }

      const userAgentRaw = (req.headers['user-agent'] || '') as string;
      if (botPatterns.test(userAgentRaw)) {
        return res.json({ ok: true, filtered: 'bot' });
      }

      const clientIpForDedup = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket.remoteAddress || '';
      const normalizedPage = typeof page === 'string' ? page.toLowerCase() : '';
      const dedupKey = `${clientIpForDedup}:${normalizedPage}`;
      const lastHit = recentHits.get(dedupKey);
      if (lastHit && Date.now() - lastHit < 5000) {
        return res.json({ ok: true, filtered: 'duplicate' });
      }
      recentHits.set(dedupKey, Date.now());

      const safePage = typeof page === 'string' ? page.slice(0, 200).toLowerCase().replace(/\/+$/, '') || '/' : null;
      const safeSessionId = typeof sessionId === 'string' ? sessionId.slice(0, 64) : null;
      const safeReferrer = typeof referrer === 'string' ? referrer.slice(0, 500) : null;
      const safeTimezone = typeof timezone === 'string' ? timezone.slice(0, 100) : null;
      const safeLanguage = typeof language === 'string' ? language.slice(0, 20) : null;

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
        || req.socket.remoteAddress || '';

      let country: string | null = null;
      let city: string | null = null;
      let region: string | null = null;

      const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
      const xCountry = req.headers['x-country'] as string | undefined;
      const xCity = req.headers['x-city'] as string | undefined;
      const xRegion = req.headers['x-region'] as string | undefined;

      if (cfCountry || xCountry) {
        country = cfCountry || xCountry || null;
        city = xCity || null;
        region = xRegion || null;
      }

      // Timezone is instant and free — use it first before any network call.
      // ipapi.co is rate-limited and adds latency; timezone covers US/India/Brazil well.
      if (!country && safeTimezone && timezoneToLocation[safeTimezone]) {
        const tzLoc = timezoneToLocation[safeTimezone];
        country = tzLoc.country;
        region = tzLoc.region;
      }

      // Fall back to IP geo-lookup only when timezone didn't resolve country
      if (!country && clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        const cached = geoCache.get(clientIp);
        if (cached && Date.now() - cached.ts < 3600000) {
          country = cached.country;
          city = cached.city;
          region = cached.region;
        } else {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const geoRes = await fetch(`https://ipapi.co/${clientIp}/json/`, { signal: controller.signal });
            clearTimeout(timeout);
            if (geoRes.ok) {
              const geo = await geoRes.json() as any;
              country = geo.country_name || null;
              city = geo.city || null;
              region = geo.region || null;
              geoCache.set(clientIp, { country, city, region, ts: Date.now() });
            }
          } catch {
          }
        }
      }

      if (!country && clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        country = 'Unknown';
      }

      const userAgent = userAgentRaw.slice(0, 500) || null;
      const isValidated = validated === true;

      await storage.createAnalyticsEvent({
        eventType,
        page: safePage,
        country,
        city,
        region,
        userAgent,
        referrer: safeReferrer,
        sessionId: safeSessionId,
      });

      res.json({ ok: true });
    } catch (error) {
      logger.error('Analytics track error', { error: String(error) });
      res.json({ ok: true });
    }
  });

  // Analytics: get summary stats (protected by admin password)
  app.post("/api/app/summary", async (req, res) => {
    try {
      if (!checkPasswordRateLimit(req, res)) return;
      const { password } = req.body;
      const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
      
      if (!expectedPassword || password !== expectedPassword) {
        return recordFailedAttempt(req, res);
      }
      clearAttempts(req);

      const excludeSelf = req.body.excludeSelf === true;
      const summary = await storage.getAnalyticsSummary(excludeSelf);
      res.json(summary);
    } catch (error) {
      logger.error('Analytics summary error', { error: String(error) });
      res.status(500).json({ error: "Failed to load analytics" });
    }
  });

  app.post("/api/app/enhanced", async (req, res) => {
    try {
      if (!checkPasswordRateLimit(req, res)) return;
      const { password, excludeSelf } = req.body;
      const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
      if (!expectedPassword || password !== expectedPassword) {
        return recordFailedAttempt(req, res);
      }
      clearAttempts(req);

      const allEvents = await storage.getAnalyticsEvents(10000);
      const filtered = excludeSelf ? allEvents.filter(e => !isSelfTraffic(e)) : allEvents;

      const sessions = buildSessions(filtered);
      const engagement = computeEngagement(sessions);

      res.json({ sessions: sessions.slice(0, 100), engagement });
    } catch (error) {
      logger.error('Analytics enhanced error', { error: String(error) });
      res.status(500).json({ error: "Failed to load enhanced analytics" });
    }
  });

  app.post("/api/app/day", async (req, res) => {
    try {
      if (!checkPasswordRateLimit(req, res)) return;
      const { password, day } = req.body;
      const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
      if (!expectedPassword || password !== expectedPassword) {
        return recordFailedAttempt(req, res);
      }
      clearAttempts(req);
      if (!day || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return res.status(400).json({ error: "Invalid day format, use YYYY-MM-DD" });
      }
      const events = await storage.getAnalyticsForDay(day);
      res.json({ events });
    } catch (error) {
      logger.error('Analytics day error', { error: String(error) });
      res.status(500).json({ error: "Failed to load day analytics" });
    }
  });

  app.post("/api/app/history", async (req, res) => {
    try {
      if (!checkPasswordRateLimit(req, res)) return;
      const { password } = req.body;
      const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
      if (!expectedPassword || password !== expectedPassword) {
        return recordFailedAttempt(req, res);
      }
      clearAttempts(req);
      const analyses = await storage.listSharedAnalyses(100);
      const summaries = analyses.map(a => {
        const data = a.analysisData as any;
        return {
          id: a.id,
          fileName: a.fileName,
          detectedFormat: a.detectedFormat,
          createdAt: a.createdAt,
          autoSaved: data?.autoSaved || false,
          channelsAnalyzed: data?.channelsAnalyzed || data?.results?.length || 0,
          totalRecords: data?.totalRecords || 0,
          results: (data?.results || []).map((r: any) => ({
            channel: r.channel,
            eigenvalue: r.eigenvalue,
            phi1: r.phi1,
            phi2: r.phi2,
            r2: r.r2,
            stability: r.stability,
            overallConfidence: r.overallConfidence,
            sampleCount: r.sampleCount,
          })),
          gearboxAnalysis: data?.gearboxAnalysis ? {
            clockChannel: data.gearboxAnalysis.clockChannel,
            clockEigenvalue: data.gearboxAnalysis.clockEigenvalue,
            targetChannel: data.gearboxAnalysis.targetChannel,
            targetEigenvalue: data.gearboxAnalysis.targetEigenvalue,
            gap: data.gearboxAnalysis.gap,
            hierarchyStatus: data.gearboxAnalysis.hierarchyStatus,
          } : null,
        };
      });
      res.json({ analyses: summaries, total: summaries.length });
    } catch (error) {
      logger.error('Analysis history error', { error: String(error) });
      res.status(500).json({ error: "Failed to load analysis history" });
    }
  });

  app.post("/api/feedback", async (req, res) => {
    try {
      const { type, message, email, page } = req.body;
      if (!type || !message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: "Type and message are required" });
      }
      if (!['suggestion', 'bug', 'other'].includes(type)) {
        return res.status(400).json({ error: "Type must be suggestion, bug, or other" });
      }
      if (message.trim().length > 5000) {
        return res.status(400).json({ error: "Message too long (max 5000 characters)" });
      }
      const feedback = await storage.createFeedback({
        type,
        message: message.trim(),
        email: email?.trim() || null,
        page: page || null,
      });
      res.json({ ok: true, id: feedback.id });
    } catch (error) {
      logger.error('Feedback submission error', { error: String(error) });
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  app.post("/api/app/feedback-list", async (req, res) => {
    try {
      if (!checkPasswordRateLimit(req, res)) return;
      const { password } = req.body;
      const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
      if (!expectedPassword || password !== expectedPassword) {
        return recordFailedAttempt(req, res);
      }
      clearAttempts(req);
      const items = await storage.listFeedback(200);
      res.json({ feedback: items, total: items.length });
    } catch (error) {
      logger.error('Feedback list error', { error: String(error) });
      res.status(500).json({ error: "Failed to load feedback" });
    }
  });

  app.post("/api/app/clear", async (req, res) => {
    try {
      if (!checkPasswordRateLimit(req, res)) return;
      const { password } = req.body;
      const expectedPassword = process.env.DOWNLOAD_PROTECT_PASSWORD;
      if (!expectedPassword || password !== expectedPassword) {
        return recordFailedAttempt(req, res);
      }
      clearAttempts(req);
      await storage.clearAnalytics();
      res.json({ ok: true });
    } catch (error) {
      logger.error('Analytics clear error', { error: String(error) });
      res.status(500).json({ error: "Failed to clear analytics" });
    }
  });
}
