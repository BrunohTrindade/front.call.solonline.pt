import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const distIndex = resolve(__dirname, '..', 'dist', 'index.html')
let html = ''
try {
  html = readFileSync(distIndex, 'utf8')
} catch (e) {
  console.error('[postbuild] dist/index.html não encontrado:', e.message)
  process.exit(0)
}

const envOrigin = process.env.VITE_API_ORIGIN?.trim()
let origin = envOrigin
if (!origin) {
  const base = process.env.VITE_API_BASE?.trim()
  try { origin = base ? new URL(base).origin : '' } catch { origin = '' }
}

if (origin) {
  html = html.replaceAll('%VITE_API_ORIGIN%', origin)
} else {
  // Remove as linhas de preconnect/dns-prefetch se não houver origem definida
  html = html.replace(/\n?\s*<link[^>]+%VITE_API_ORIGIN%[^>]*>\s*/g, '')
}

writeFileSync(distIndex, html, 'utf8')
console.log('[postbuild] index.html atualizado com origem da API:', origin || 'removido')
