import type { Plugin } from "vite";

/**
 * Vite plugin stub for meta/OG image handling.
 * On Replit this processes social media preview images;
 * in standalone builds it's a no-op.
 */
export function metaImagesPlugin(): Plugin {
  return {
    name: "meta-images",
    // No-op in standalone builds
  };
}
