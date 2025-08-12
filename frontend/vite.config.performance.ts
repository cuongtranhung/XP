import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // SWC is 20x faster than Babel
import { compression } from 'vite-plugin-compression2';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    // Use SWC instead of Babel for 20x faster compilation
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: [
          ['@emotion/babel-plugin', {}]
        ]
      }
    }),
    
    // Gzip compression for smaller assets
    compression({
      algorithm: 'gzip',
      threshold: 10240, // Only compress files > 10KB
    }),
    
    // Bundle size visualization
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/bundle-analysis.html'
    })
  ],
  
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  
  // Aggressive dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'react-hook-form',
      '@hookform/resolvers',
      'yup',
      'clsx',
      'react-hot-toast'
    ],
    exclude: ['@vite/client', '@vite/env'],
    esbuildOptions: {
      target: 'es2020',
      // Enable tree shaking
      treeShaking: true,
    }
  },
  
  // Development server optimizations
  server: {
    port: 3000,
    host: true,
    hmr: {
      overlay: false, // Disable error overlay for better performance
    },
    // Preload critical modules
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/LoginPage.tsx',
        './src/pages/DashboardPage.tsx'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    minify: 'esbuild', // Faster than terser
    cssCodeSplit: true,
    
    // Optimize CSS
    cssMinify: 'lightningcss',
    
    // Smaller inline limit
    assetsInlineLimit: 2048, // 2KB
    
    rollupOptions: {
      output: {
        // Aggressive code splitting
        manualChunks: (id) => {
          // React ecosystem
          if (id.includes('react-dom')) return 'react-dom';
          if (id.includes('react')) return 'react';
          if (id.includes('react-router')) return 'router';
          
          // Form libraries
          if (id.includes('react-hook-form') || 
              id.includes('@hookform') || 
              id.includes('yup')) {
            return 'forms';
          }
          
          // Heavy visualization libraries
          if (id.includes('chart.js') || id.includes('react-chartjs')) {
            return 'charts';
          }
          
          // Excel processing
          if (id.includes('exceljs')) {
            return 'excel';
          }
          
          // Animation libraries
          if (id.includes('framer-motion')) {
            return 'animation';
          }
          
          // Drag and drop
          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }
          
          // Date utilities
          if (id.includes('date-fns') || id.includes('react-datepicker')) {
            return 'date';
          }
          
          // Icons
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          
          // Real-time features
          if (id.includes('socket.io')) {
            return 'realtime';
          }
          
          // All other vendor code
          if (id.includes('node_modules')) {
            const module = id.split('node_modules/')[1].split('/')[0];
            // Group small modules together
            if (['axios', 'clsx', 'react-hot-toast'].includes(module)) {
              return 'utils';
            }
            return 'vendor';
          }
        },
        
        // Optimize chunk names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? 
            chunkInfo.facadeModuleId.split('/').pop()?.split('.')[0] : 'chunk';
          return `js/${facadeModuleId}.[hash:8].js`;
        },
        
        entryFileNames: 'js/[name].[hash:8].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop() || 'asset';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `images/[name].[hash:8][extname]`;
          }
          if (/woff2?|ttf|eot/i.test(extType)) {
            return `fonts/[name].[hash:8][extname]`;
          }
          return `${extType}/[name].[hash:8][extname]`;
        }
      },
      
      // Tree shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    
    // Lower chunk size warning
    chunkSizeWarningLimit: 250, // 250KB warning
    
    // Reports
    reportCompressedSize: false, // Faster builds
  },
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  
  // CSS optimization
  css: {
    devSourcemap: false,
    modules: {
      localsConvention: 'camelCase'
    }
  }
});