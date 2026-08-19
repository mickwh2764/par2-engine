import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import helmet from "helmet";
import { INTERNAL_PAGES } from "@shared/internal-pages";
import { registerRoutes } from "./routes";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import { enqueueStale } from "./paper-compiler";

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception (kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection (kept alive):', reason);
});

const app = express();
const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV !== "development";

// Compress every text response. The client bundle and CSS are ~775 KB
// uncompressed and were previously served raw.
app.use(compression());

// Security headers. CSP and cross-origin resource/embedder policies are left
// off so they don't break the Vite SPA or cross-origin loading of served
// figures/PDFs; this still adds X-Frame-Options (clickjacking), HSTS,
// X-Content-Type-Options, Referrer-Policy, etc.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Drop scanner/bot probes for paths that can't exist on this app.
// This catches WordPress plugin scanners, PHP file-manager probes, etc.
// Return 404 immediately so they don't touch any real middleware.
app.use((req: Request, res: Response, next: NextFunction) => {
  const p = req.path;
  if (
    p.endsWith(".php") ||
    p.includes("/wp-") ||
    p.includes("/wordpress") ||
    p.includes("/xmlrpc") ||
    p.includes("/.env") ||
    p.includes("/etc/passwd") ||
    p.includes("/cgi-bin")
  ) {
    res.status(404).end();
    return;
  }
  next();
});

// Block direct access to draft paper static files — require password
const DRAFT_STATIC_FILES = new Set([
  '/PaperH_GlialClockInversion_Supplement.zip',
  '/PaperM_GigaScience.pdf',
  '/PaperO_Organoid_Circadian_Hierarchy.pdf',
  '/PaperN_p53_Regulon_Package.zip',
  // Paper G (accepted by The Fibonacci Quarterly, in press): submitted revision,
  // reviewer reply, and the cover letter narrative stay gated until the journal
  // version appears.
  '/Whiteside_FQ_Revision_v1.zip',
  '/PaperG_Submitted_Manuscript.pdf',
  '/PaperG_Fibonacci_PAR2_Revised.pdf',
  '/Paper_G_Fibonacci_Reply_Original.pdf',
  '/PaperA_CoverLetter_PLOSONE.pdf',
]);
app.use("/downloads", (req, res, next) => {
  if (!DRAFT_STATIC_FILES.has(req.path)) return next();
  const envPassword = process.env.DRAFT_PAPER_PASSWORD;
  const provided = (req.query.password as string) || (req.headers['x-download-password'] as string);
  if (!envPassword || !provided || provided !== envPassword) {
    res.status(401).json({ error: 'Password required for draft manuscripts.' });
    return;
  }
  next();
});

// Paper N (p53 regulon) figures are draft / in-review — block direct access.
app.use("/figures", (req, res, next) => {
  if (req.path.startsWith("/paper-n/")) {
    res.status(404).end();
    return;
  }
  next();
});

// Serve static figures (SVG/PNG for papers, X posts, etc.)
app.use("/figures", express.static(path.resolve(process.cwd(), "public", "figures"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".svg")) res.setHeader("Content-Type", "image/svg+xml");
    if (filePath.endsWith(".png")) res.setHeader("Content-Type", "image/png");
  },
}));

// Serve downloadable files (PDFs etc.) from the workspace public/downloads directory
// Must be registered before Vite middleware, which uses client/ as its root
app.use("/downloads", express.static(path.resolve(process.cwd(), "public", "downloads"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
    }
  },
}));

// Password-gated download pages — tell crawlers not to index them (only a lock-screen is visible)
app.use(["/paper-a-download", "/paper-g-download", "/manuscript-download"], (_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

// Block common scanner/exploit probe paths
app.use((req, res, next) => {
  const blocked = /^\/\.git|^\/\.env|^\/\.htaccess|^\/wp-|^\/phpmyadmin|^\/admin\.php|^\/xmlrpc\.php/i;
  if (blocked.test(req.path)) {
    res.status(404).end();
    return;
  }
  next();
});

// Block internal/draft pages in production — only accessible in development preview
app.use((req, res, next) => {
  if (isProduction) {
    if (INTERNAL_PAGES.includes(req.path)) {
      res.status(404).end();
      return;
    }
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

let serverReady = false;

app.use((req, res, next) => {
  if (!serverReady) {
    if (req.path === "/" || req.path === "/__health") {
      res.status(200).send("<!DOCTYPE html><html><body><p>Starting...</p></body></html>");
      return;
    }
    res.status(503).json({ message: "Server starting up..." });
    return;
  }
  next();
});

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`serving on port ${port}`);
  },
);

(async () => {
  const authPromise = (async () => {
    try {
      await setupAuth(app);
      registerAuthRoutes(app);
      log('auth setup complete');
    } catch (err: any) {
      console.warn('[express] Auth setup failed (will retry later):', err.message || err);
    }
  })();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('[express] Error handler:', err.message || err);
    res.status(status).json({ message });
  });

  if (isProduction) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  serverReady = true;
  log("all routes registered, server fully ready");

  // Auto-recompile any stale paper PDFs in the background (non-blocking)
  enqueueStale().catch((e) => console.error("[paper-compiler] Startup check failed:", e));

  if (isProduction) {
    setInterval(() => {
      const mem = process.memoryUsage();
      console.log(`[keepalive] heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB, rss: ${Math.round(mem.rss / 1024 / 1024)}MB`);
    }, 30000);
  }
})();
