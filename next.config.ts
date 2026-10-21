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
  // exceljs usa módulos de Node (fs, stream, zlib) que su paquete resuelve con
  // require dinámico. Bundlearlo con Turbopack lo revienta al generar el .xlsx,
  // así que se deja fuera del bundle y Next lo sirve tal cual de node_modules.
  serverExternalPackages: ["exceljs"],
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
