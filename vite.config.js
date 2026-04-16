import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import https from 'node:https'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    {
      name: 'plex-proxy',
      configureServer(server) {
        // Proxy /plex-proxy/* to the Plex server server-side, bypassing browser CORS/PNA
        server.middlewares.use('/plex-proxy', (req, res) => {
          // URL format: /plex-proxy/{encodeURIComponent(serverBase)}/rest/of/path?query
          // Works for both fetch() and <img src=...> since no custom headers needed
          const withoutSlash = req.url.slice(1)
          const firstSlash = withoutSlash.indexOf('/')
          const encodedBase = firstSlash === -1 ? withoutSlash : withoutSlash.slice(0, firstSlash)
          const restPath = firstSlash === -1 ? '/' : withoutSlash.slice(firstSlash)

          let targetUrl
          try {
            targetUrl = new URL(decodeURIComponent(encodedBase) + restPath)
          } catch {
            res.statusCode = 400
            res.end('Invalid proxy target URL')
            return
          }

          // Block link-local (cloud metadata) addresses — allow localhost and RFC1918
          // (RFC1918 must be allowed since Plex servers run on local network IPs)
          if (/^169\.254\./.test(targetUrl.hostname)) {
            res.statusCode = 403
            res.end('Proxy target blocked')
            return
          }

          // Strip cookies and auth headers before forwarding to prevent credential leakage
          const { cookie, authorization, ...safeHeaders } = req.headers
          const forwardHeaders = { ...safeHeaders, host: targetUrl.host }

          const lib = targetUrl.protocol === 'https:' ? https : http
          const proxyReq = lib.request(
            {
              hostname: targetUrl.hostname,
              port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
              path: targetUrl.pathname + targetUrl.search,
              method: req.method,
              headers: forwardHeaders,
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode, {
                ...proxyRes.headers,
                'access-control-allow-origin': '*',
              })
              proxyRes.pipe(res)
            }
          )

          proxyReq.on('error', (e) => {
            res.statusCode = 502
            res.end(`Proxy error: ${e.message}`)
          })

          req.pipe(proxyReq)
        })
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
  },
})
