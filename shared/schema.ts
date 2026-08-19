import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, jsonb, boolean, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const analysisRuns = pgTable("analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  datasetName: text("dataset_name").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  integrityHash: text("integrity_hash"),
  integrityHashShort: text("integrity_hash_short"),
  hashTimestamp: timestamp("hash_timestamp"),
  hashVersion: text("hash_version"),
});

export const hypotheses = pgTable("hypotheses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
  targetGene: text("target_gene").notNull(),
  targetRole: text("target_role").notNull(),
  clockGene: text("clock_gene").notNull(),
  clockRole: text("clock_role").notNull(),
  significant: boolean("significant").notNull().default(false),
  pValue: doublePrecision("p_value"),
  qValue: doublePrecision("q_value"),
  significantAfterFDR: boolean("significant_after_fdr").default(false),
  significantTerms: text("significant_terms").array(),
  description: text("description"),
  effectSizeCohensF2: doublePrecision("effect_size_cohens_f2"),
  effectSizeInterpretation: text("effect_size_interpretation"),
  rSquaredChange: doublePrecision("r_squared_change"),
  confidenceIntervals: jsonb("confidence_intervals"),
  beta1: doublePrecision("beta1"),
  beta2: doublePrecision("beta2"),
  eigenvalueModulus: doublePrecision("eigenvalue_modulus"),
  isComplexRoot: boolean("is_complex_root"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalysisRunSchema = createInsertSchema(analysisRuns).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertHypothesisSchema = createInsertSchema(hypotheses).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalysisRun = z.infer<typeof insertAnalysisRunSchema>;
export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type InsertHypothesis = z.infer<typeof insertHypothesisSchema>;
export type Hypothesis = typeof hypotheses.$inferSelect;

// Proteomics analysis tables
export const proteomicsRuns = pgTable("proteomics_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  datasetName: text("dataset_name").notNull(),
  dataType: text("data_type").notNull().default("protein"), // protein, phospho, etc.
  status: text("status").notNull().default("pending"),
  linkedTranscriptomicsRunId: varchar("linked_transcriptomics_run_id").references(() => analysisRuns.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const proteomicsResults = pgTable("proteomics_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => proteomicsRuns.id, { onDelete: "cascade" }),
  targetProtein: text("target_protein").notNull(),
  targetGeneSymbol: text("target_gene_symbol").notNull(),
  clockProtein: text("clock_protein").notNull(),
  clockGeneSymbol: text("clock_gene_symbol").notNull(),
  significant: boolean("significant").notNull().default(false),
  pValue: doublePrecision("p_value"),
  qValue: doublePrecision("q_value"),
  significantAfterFDR: boolean("significant_after_fdr").default(false),
  significantTerms: text("significant_terms").array(),
  effectSizeCohensF2: doublePrecision("effect_size_cohens_f2"),
  effectSizeInterpretation: text("effect_size_interpretation"),
  rSquaredChange: doublePrecision("r_squared_change"),
  confidenceIntervals: jsonb("confidence_intervals"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Concordance analysis for mRNA vs protein comparison
export const concordanceAnalysis = pgTable("concordance_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transcriptomicsRunId: varchar("transcriptomics_run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
  proteomicsRunId: varchar("proteomics_run_id").notNull().references(() => proteomicsRuns.id, { onDelete: "cascade" }),
  targetGene: text("target_gene").notNull(),
  clockGene: text("clock_gene").notNull(),
  mrnaPValue: doublePrecision("mrna_p_value"),
  mrnaSignificant: boolean("mrna_significant"),
  proteinPValue: doublePrecision("protein_p_value"),
  proteinSignificant: boolean("protein_significant"),
  concordanceStatus: text("concordance_status").notNull(), // 'both_significant', 'mrna_only', 'protein_only', 'neither'
  interpretation: text("interpretation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProteomicsRunSchema = createInsertSchema(proteomicsRuns).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertProteomicsResultSchema = createInsertSchema(proteomicsResults).omit({
  id: true,
  createdAt: true,
});

export const insertConcordanceSchema = createInsertSchema(concordanceAnalysis).omit({
  id: true,
  createdAt: true,
});

export type InsertProteomicsRun = z.infer<typeof insertProteomicsRunSchema>;
export type ProteomicsRun = typeof proteomicsRuns.$inferSelect;
export type InsertProteomicsResult = z.infer<typeof insertProteomicsResultSchema>;
export type ProteomicsResult = typeof proteomicsResults.$inferSelect;
export type InsertConcordance = z.infer<typeof insertConcordanceSchema>;
export type ConcordanceAnalysis = typeof concordanceAnalysis.$inferSelect;

export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  page: text("page"),
  country: text("country"),
  city: text("city"),
  region: text("region"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("IDX_analytics_created").on(table.createdAt), index("IDX_analytics_type").on(table.eventType)]);

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

export const sharedAnalyses = pgTable("shared_analyses", {
  id: varchar("id").primaryKey(),
  fileName: text("file_name").notNull(),
  detectedFormat: text("detected_format").notNull(),
  analysisData: jsonb("analysis_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSharedAnalysisSchema = createInsertSchema(sharedAnalyses).omit({
  createdAt: true,
});

export type InsertSharedAnalysis = z.infer<typeof insertSharedAnalysisSchema>;
export type SharedAnalysis = typeof sharedAnalyses.$inferSelect;

export const feedbackSubmissions = pgTable("feedback_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  message: text("message").notNull(),
  email: text("email"),
  page: text("page"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackSubmissions).omit({
  id: true,
  createdAt: true,
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackSubmissions.$inferSelect;

export const savedReports = pgTable("saved_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  sourcePage: text("source_page").notNull(),
  reportType: text("report_type").notNull(),
  summary: text("summary"),
  geneCount: integer("gene_count"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("IDX_saved_reports_created").on(table.createdAt)]);

export const insertSavedReportSchema = createInsertSchema(savedReports).omit({
  id: true,
  createdAt: true,
});

export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;

export const paperDownloads = pgTable("paper_downloads", {
  id: serial("id").primaryKey(),
  paperId: text("paper_id").notNull(),
  isSelf: boolean("is_self").default(false).notNull(),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
});

export type PaperDownload = typeof paperDownloads.$inferSelect;
