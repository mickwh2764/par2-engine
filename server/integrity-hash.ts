/**
 * Integrity Hash Generator for PAR(2) Analysis Provenance
 * 
 * Generates SHA-256 verification hashes for analysis runs to ensure
 * complete audit trail and reproducibility verification.
 */

import crypto from 'crypto';

export interface HashableAnalysis {
  datasetName: string;
  createdAt: Date | string;
  significantPairs?: number;
  totalPairs?: number;
  meanEigenvalue?: number;
  parameters?: Record<string, unknown>;
}

export interface IntegrityHashResult {
  hash: string;
  shortHash: string;
  timestamp: string;
  version: string;
}

const HASH_VERSION = '1.0.0';

/**
 * Generate a SHA-256 integrity hash for an analysis run
 */
export function generateIntegrityHash(analysis: HashableAnalysis): IntegrityHashResult {
  const timestamp = new Date().toISOString();
  
  const hashInput = {
    version: HASH_VERSION,
    dataset: analysis.datasetName,
    created: typeof analysis.createdAt === 'string' 
      ? analysis.createdAt 
      : analysis.createdAt.toISOString(),
    significantPairs: analysis.significantPairs ?? 0,
    totalPairs: analysis.totalPairs ?? 0,
    meanEigenvalue: analysis.meanEigenvalue 
      ? Math.round(analysis.meanEigenvalue * 10000) / 10000 
      : 0,
    parameters: analysis.parameters ?? {},
    timestamp,
  };
  
  const serialized = JSON.stringify(hashInput, Object.keys(hashInput).sort());
  const hash = crypto.createHash('sha256').update(serialized).digest('hex');
  const shortHash = hash.substring(0, 12).toUpperCase();
  
  return {
    hash,
    shortHash,
    timestamp,
    version: HASH_VERSION,
  };
}

/**
 * Verify an integrity hash matches expected parameters
 */
export function verifyIntegrityHash(
  analysis: HashableAnalysis,
  expectedHash: string,
  originalTimestamp: string
): { valid: boolean; reason?: string } {
  const hashInput = {
    version: HASH_VERSION,
    dataset: analysis.datasetName,
    created: typeof analysis.createdAt === 'string' 
      ? analysis.createdAt 
      : analysis.createdAt.toISOString(),
    significantPairs: analysis.significantPairs ?? 0,
    totalPairs: analysis.totalPairs ?? 0,
    meanEigenvalue: analysis.meanEigenvalue 
      ? Math.round(analysis.meanEigenvalue * 10000) / 10000 
      : 0,
    parameters: analysis.parameters ?? {},
    timestamp: originalTimestamp,
  };
  
  const serialized = JSON.stringify(hashInput, Object.keys(hashInput).sort());
  const computedHash = crypto.createHash('sha256').update(serialized).digest('hex');
  
  if (computedHash === expectedHash) {
    return { valid: true };
  }
  
  return { 
    valid: false, 
    reason: 'Hash mismatch - analysis parameters may have been modified' 
  };
}

/**
 * Format hash for display with checksum groups
 */
export function formatHashForDisplay(hash: string): string {
  return hash.match(/.{1,8}/g)?.join('-') ?? hash;
}

/**
 * Generate a verification badge based on hash status
 */
export function getVerificationBadge(isVerified: boolean): {
  status: 'verified' | 'unverified' | 'pending';
  icon: string;
  color: string;
} {
  if (isVerified) {
    return {
      status: 'verified',
      icon: '✓',
      color: '#22c55e',
    };
  }
  return {
    status: 'unverified',
    icon: '?',
    color: '#f59e0b',
  };
}
