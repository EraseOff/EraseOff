import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        removeGeminiWatermark: 'remove-gemini-watermark.html',
        freeGeminiWatermarkRemover: 'free-gemini-watermark-remover.html',
        geminiWatermarkRemoverOnline: 'gemini-watermark-remover-online.html'
      }
    }
  }
})
