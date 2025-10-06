import 'dotenv/config'
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

const origin = (process.env.VITE_API_ORIGIN || '').trim()

// Injeta links na âncora API_ORIGIN_LINKS
if (origin) {
  const inject = `\n    <link rel="preconnect" href="${origin}" crossorigin>\n    <link rel="dns-prefetch" href="${origin}">\n`
  html = html.replace('<!-- API_ORIGIN_LINKS -->', `<!-- API_ORIGIN_LINKS -->${inject}`)
} else {
  // Nada a injetar; mantém o comentário como âncora
}

writeFileSync(distIndex, html, 'utf8')
console.log('[postbuild] index.html atualizado com origem da API:', origin || 'removido')
