const { defineConfig } = require('vite');
const { resolve } = require('node:path');

module.exports = defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),

        removeGeminiWatermark: resolve(
          __dirname,
          'remove-gemini-watermark/index.html'
        ),

        freeGeminiWatermarkRemover: resolve(
          __dirname,
          'free-gemini-watermark-remover/index.html'
        ),

        geminiWatermarkRemoverOnline: resolve(
          __dirname,
          'gemini-watermark-remover-online/index.html'
        ),
      },
    },
  },
});
