import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // GEMINI_API_KEY is intentionally NOT exposed to the client bundle.
    // All Gemini calls go through authenticated /api/ai/* server routes.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
              if (id.includes('lucide-react') || id.includes('motion')) return 'ui-vendor';
              if (id.includes('jspdf') || id.includes('jspdf-autotable') || id.includes('html2canvas') || id.includes('file-saver')) {
                return 'export-vendor';
              }
              if (id.includes('recharts')) return 'charts-vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
