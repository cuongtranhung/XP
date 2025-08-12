import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// Production-optimized Vite configuration
export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh in development
      fastRefresh: process.env.NODE_ENV !== 'production',
    }),
    // Bundle analyzer for production builds
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),

  // Build configuration for production
  build: {
    // Output directory
    outDir: 'dist',
    
    // Generate source maps for production debugging
    sourcemap: true,
    
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    
    // Rollup options for advanced bundling
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@headlessui/react', 'framer-motion'],
          charts: ['chart.js', 'react-chartjs-2'],
          utils: ['date-fns', 'lodash', 'axios'],
        },
        
        // Asset naming for cache busting
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') ?? [];
          let extType = info[info.length - 1];
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType ?? '')) {
            extType = 'img';
          } else if (/woff2?|eot|ttf|otf/i.test(extType ?? '')) {
            extType = 'fonts';
          }
          
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        
        // Chunk naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    
    // Target modern browsers for smaller bundles
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },

  // Dependency optimization
  optimizeDeps: {
    // Include dependencies that need to be pre-bundled
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'date-fns',
      'lodash',
    ],
    
    // Exclude dependencies from optimization
    exclude: ['@vite/client', '@vite/env'],
  },

  // Server configuration for production preview
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
  },

  // Asset handling
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf'],

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },

  // Environment variable handling
  envPrefix: 'VITE_',

  // CSS configuration
  css: {
    // PostCSS configuration is handled by postcss.config.js
    postcss: {},
    
    // CSS modules configuration
    modules: {
      localsConvention: 'camelCaseOnly',
    },
    
    // CSS preprocessing
    preprocessorOptions: {
      scss: {
        additionalData: `@import "src/styles/variables.scss";`,
      },
    },
  },

  // JSON configuration
  json: {
    namedExports: true,
    stringify: false,
  },

  // Worker configuration
  worker: {
    format: 'es',
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
      '@services': resolve(__dirname, 'src/services'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },

  // Experimental features
  experimental: {
    renderBuiltUrl(filename: string) {
      // Custom asset URL handling
      return `/${filename}`;
    },
  },

  // Plugin-specific configurations
  esbuild: {
    // Remove console and debugger in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});