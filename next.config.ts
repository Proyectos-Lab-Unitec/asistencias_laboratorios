import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Toda la app está detrás de sesión (lee cookies), así que ninguna ruta
    // produce un static shell. Sin esto, Next valida implícitamente todas las
    // páginas en desarrollo y el NEXT_REDIRECT de requireRol() reventaba la
    // validación de instant navigation. Con 'manual-warning' solo se valida lo
    // que se opte explícitamente con `export const instant = true` (p. ej. la
    // página pública de registro por QR, más adelante).
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
