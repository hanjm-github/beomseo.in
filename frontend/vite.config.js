import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const REACT_PACKAGES = new Set([
  'react',
  'react-dom',
  'react-router',
  'react-router-dom',
  '@remix-run/router',
  'scheduler',
]);

const UI_PACKAGES = new Set([
  'lucide-react',
]);

const CHART_PACKAGES = new Set([
  'recharts',
  'victory-vendor',
  'd3-array',
  'd3-color',
  'd3-ease',
  'd3-format',
  'd3-interpolate',
  'd3-path',
  'd3-scale',
  'd3-shape',
  'd3-time',
  'd3-time-format',
]);

const getPackageName = (id) => {
  const normalizedId = id.replace(/\\/g, '/');
  const [, rest] = normalizedId.split('/node_modules/');
  if (!rest) return null;

  const parts = rest.split('/');
  if (!parts.length) return null;

  if (parts[0].startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  }

  return parts[0];
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: {},
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const packageName = getPackageName(id);
          if (!packageName) return;

          if (REACT_PACKAGES.has(packageName)) return 'react-vendor';
          if (UI_PACKAGES.has(packageName)) return 'ui-vendor';
          if (CHART_PACKAGES.has(packageName) || packageName.startsWith('d3-')) return 'charts-vendor';

          return undefined;
        },
      },
    },
  },
});
