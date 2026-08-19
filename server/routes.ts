import type { Express } from "express";
import { createServer, type Server } from "http";
import { requestLogger } from "./logger";
import { apiLimiter } from "./security";
import { apiCache } from "./api-cache";
import { registerAPIRoutes } from "./routes/api";
import { upload } from "./routes/shared";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerBomanRoutes } from "./routes/boman";
import { registerAnalysesRoutes } from "./routes/analyses";
import { registerDownloadRoutes } from "./routes/downloads";
import { registerFibonacciRoutes } from "./routes/fibonacci";
import { registerDiscoveryRoutes } from "./routes/discovery";
import { registerValidationRoutes } from "./routes/validation";
import { registerPaperRoutes } from "./routes/papers";
import { bookRouter } from "./routes/book";
import { assessmentPackageRouter } from "./routes/assessment-package";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use(requestLogger());

  // Throttle all API traffic per-IP (token bucket, 120 req/60s). Protects the
  // CPU-heavy AR(2) analysis endpoints and file uploads from abuse/DoS.
  app.use("/api", apiLimiter);

  // Cache and coalesce repeated analysis reads, and cap how many run at once.
  app.use("/api", apiCache());

  registerAPIRoutes(app);
  registerAnalyticsRoutes(app);
  registerBomanRoutes(app, upload);
  registerAnalysesRoutes(app, upload);
  registerDownloadRoutes(app, upload);
  registerFibonacciRoutes(app, upload);
  registerDiscoveryRoutes(app, upload);
  await registerValidationRoutes(app, upload);
  registerPaperRoutes(app);
  app.use("/api/book", bookRouter);
  app.use("/", assessmentPackageRouter);

  return httpServer;
}
