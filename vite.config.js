const { defineConfig } = require('vite');
const { resolve } = require('node:path');

module.exports = defineConfig({
  input: {
    main: resolve(__dirname, 'index.html'),
    removeGeminiWatermark: resolve(
      __dirname,
      'remove-gemini-watermark/index.html'
    ),
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
