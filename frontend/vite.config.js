import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { getPrerenderRoutes, resolveSeoFeatureFlags } from './src/seo/policy.js';

function applyLoadedEnvToProcess(env) {
  Object.entries(env).forEach(([key, value]) => {
    if (key.startsWith('VITE_') && process.env[key] == null) {
      process.env[key] = value;
    }
  });
}

async function createPrerenderPlugin(featureFlags) {
  // Pre-rendering generates static HTML for SEO-critical pages at build time.
  // Uses vite-prerender-plugin which calls the prerender() export in main.jsx.
  try {
    const { vitePrerenderPlugin } = await import('vite-prerender-plugin');
    return vitePrerenderPlugin({
      // CSS selector for the element where the React app is mounted.
      renderTarget: '#root',
      additionalPrerenderRoutes: getPrerenderRoutes(new Date(), featureFlags).filter(
        (route) => route !== '/'
      ),
    });
  } catch {
    // Gracefully skip pre-rendering if the package is not yet installed.
    return null;
  }
}

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
  'firebase',
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
export default defineConfig(async ({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  };
  applyLoadedEnvToProcess(env);
  const seoFeatureFlags = resolveSeoFeatureFlags(env);
  const prerenderPlugin = await createPrerenderPlugin(seoFeatureFlags);

  return {
    plugins: [react(), prerenderPlugin].filter(Boolean),
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
  };
});
