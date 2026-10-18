import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Runs middleware.ts and api/*.ts in `vite dev`, mimicking Vercel,
// so login works locally with env vars from .env.local.
function vercelDev(): Plugin {
  async function toRequest(req: IncomingMessage): Promise<Request> {
    const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
    }
    const chunks: Buffer[] = []
    if (req.method !== 'GET' && req.method !== 'HEAD') for await (const c of req) chunks.push(c as Buffer)
    return new Request(url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined })
  }
  async function send(res: ServerResponse, response: Response) {
    res.statusCode = response.status
    response.headers.forEach((v, k) => { if (k !== 'set-cookie') res.setHeader(k, v) })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('set-cookie', cookies)
    res.end(Buffer.from(await response.arrayBuffer()))
  }

  return {
    name: 'vercel-dev-auth',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use(async (req, res, nextFn) => {
        try {
          const request = await toRequest(req)
          const { default: middleware } = await server.ssrLoadModule('/middleware.ts')
          let response: Response = await middleware(request)
          if (response.headers.get('x-middleware-next')) {
            const route = new URL(request.url).pathname.match(/^\/api\/([\w-]+)$/)
            if (!route) return nextFn()
            const mod = await server.ssrLoadModule(`/api/${route[1]}.ts`).catch(() => null)
            const handler = mod?.[req.method ?? 'GET']
            response = handler ? await handler(request) : new Response('Not found', { status: 404 })
          }
          await send(res, response)
        } catch (e) {
          nextFn(e)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vercelDev()],
})
