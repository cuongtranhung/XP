import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Optimized Vite configuration
export default defineConfig({
  plugins: [
    react({
      // Use SWC for faster builds
      jsxRuntime: 'automatic'
    })
  ],
  
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  
  // Aggressive optimization for dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'react-hook-form'
    ],
    exclude: ['@vite/client', '@vite/env'],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  
  // Enable caching
  cacheDir: '.vite',
  
  server: {
    port: 3000,
    host: true,
    strictPort: false,
    
    // Preload critical files
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/index.css'
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
    sourcemap: false, // Disable sourcemaps in production for smaller builds
    target: 'es2020',
    minify: 'esbuild', // Use esbuild for faster minification
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('react')) {
            return 'react-vendor';
          }
          
          // Form libraries
          if (id.includes('react-hook-form') || 
              id.includes('@hookform') || 
              id.includes('yup')) {
            return 'forms';
          }
          
          // Heavy libraries in separate chunks
          if (id.includes('chart.js')) {
            return 'charts';
          }
          if (id.includes('exceljs')) {
            return 'excel';
          }
          if (id.includes('framer-motion')) {
            return 'motion';
          }
          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }
          if (id.includes('socket.io')) {
            return 'socketio';
          }
          
          // Utilities
          if (id.includes('axios') || 
              id.includes('clsx') || 
              id.includes('lucide-react')) {
            return 'utils';
          }
          
          // Everything else in vendor
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        
        // Better naming for chunks
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? 
            chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/js/${facadeModuleId}-[hash].js`;
        },
        
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      },
      
      // Prevent large chunks
      maxParallelFileOps: 3
    },
    
    // Warn for large chunks
    chunkSizeWarningLimit: 500, // 500KB warning
    
    // Terser options for production
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2
      },
      format: {
        comments: false
      }
    }
  },
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  
  // Optimization for preview server
  preview: {
    port: 3000,
    strictPort: false
  }
});