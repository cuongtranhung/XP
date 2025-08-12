import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-hook-form',
      '@hookform/resolvers',
      'yup',
      'axios',
      'clsx'
    ],
    exclude: ['@vite/client', '@vite/env'],
  },
  cacheDir: '.vite',
  server: {
    port: parseInt(process.env.PORT || '3002'),
    host: true, // Listen on all network interfaces
    strictPort: true, // Force port, fail if unavailable
    hmr: {
      overlay: false // Disable error overlay to bypass Babel issue
    },
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy, options) => {
          // Handle WSL2 to Windows connectivity
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying:', req.method, req.url, '->', options.target);
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
    minify: 'terser',
    cssCodeSplit: true,
    assetsInlineLimit: 4096, // Inline assets < 4KB
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        dead_code: true,
        unused: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          forms: ['react-hook-form', '@hookform/resolvers', 'yup'],
          utils: ['axios', 'clsx'],
          charts: ['chart.js', 'react-chartjs-2'],
          icons: ['lucide-react'],
          dragdrop: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          motion: ['framer-motion'],
          excel: ['exceljs'],
          query: ['@tanstack/react-query'],
          socketio: ['socket.io-client']
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
    },
    chunkSizeWarningLimit: 1000, // Warn for chunks > 1MB
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});