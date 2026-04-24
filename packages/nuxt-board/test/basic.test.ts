import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const host = '127.0.0.1'
const packageRoot = fileURLToPath(new URL('..', import.meta.url))

interface FixtureServer {
  baseUrl: string
  fixtureName: string
  output: string
  port: number
  process: ChildProcessWithoutNullStreams
}

const getFixtureRoot = (fixtureName: string) =>
  fileURLToPath(new URL(`./fixtures/${fixtureName}`, import.meta.url))

async function getAvailablePort() {
  return await new Promise<number>((resolve, reject) => {
    const probe = createServer()

    probe.once('error', reject)
    probe.listen(0, host, () => {
      const address = probe.address()

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to acquire an ephemeral test port'))
        return
      }

      probe.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }

        resolve(address.port)
      })
    })
  })
}

async function waitForServerReady(server: FixtureServer) {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(server.baseUrl)
      const html = await response.text()

      if (response.ok && !html.includes('__NUXT_LOADING__')) {
        return
      }

      lastError = new Error(
        `Unexpected response from fixture server: ${response.status}`,
      )
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    await delay(100)
  }

  const output = server.output.trim()
  const detail = output ? `\n\nServer output:\n${output}` : ''
  throw new Error(
    `Timed out waiting for the Nuxt fixture "${server.fixtureName}".${detail}`,
    {
      cause: lastError,
    },
  )
}

async function startFixtureServer(fixtureName: string): Promise<FixtureServer> {
  const port = await getAvailablePort()
  const childProcess = spawn(
    'pnpm',
    [
      'exec',
      'nuxi',
      'dev',
      getFixtureRoot(fixtureName),
      '--host',
      host,
      '--port',
      String(port),
    ],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
      stdio: 'pipe',
    },
  )

  const server: FixtureServer = {
    baseUrl: `http://${host}:${port}/`,
    fixtureName,
    output: '',
    port,
    process: childProcess,
  }

  const collectOutput = (chunk: Buffer) => {
    server.output += chunk.toString()

    if (server.output.length > 8000) {
      server.output = server.output.slice(-8000)
    }
  }

  childProcess.stdout.on('data', collectOutput)
  childProcess.stderr.on('data', collectOutput)

  await waitForServerReady(server)
  return server
}

async function stopFixtureServer(server: FixtureServer | undefined) {
  if (!server) {
    return
  }

  if (server.process.exitCode === null && !server.process.killed) {
    server.process.kill('SIGTERM')
    await delay(250)
  }

  if (server.process.exitCode === null && !server.process.killed) {
    server.process.kill('SIGKILL')
  }
}

describe('nuxt-board module', () => {
  describe('default auto-imports', () => {
    let server: FixtureServer | undefined

    beforeAll(async () => {
      server = await startFixtureServer('basic')
    }, 120_000)

    afterAll(async () => {
      await stopFixtureServer(server)
    }, 30_000)

    it('renders static page content server-side', async () => {
      const html = await fetch(server!.baseUrl).then((response) =>
        response.text(),
      )
      expect(html).toContain('board-module-ok')
    })

    it('renders component, helper, and composable auto-imports', async () => {
      const html = await fetch(server!.baseUrl).then((response) =>
        response.text(),
      )
      expect(html).toContain('class="board-root"')
      expect(html).toContain('fixture-node-content')
      expect(html).toContain('class="board-probe"')
      expect(html).toContain('data-nodes="1"')
      expect(html).toContain('data-zoom="1"')
    })
  })

  describe('prefixed auto-imports', () => {
    let server: FixtureServer | undefined

    beforeAll(async () => {
      server = await startFixtureServer('prefixed')
    }, 120_000)

    afterAll(async () => {
      await stopFixtureServer(server)
    }, 30_000)

    it('renders prefixed component, helper, and composable aliases', async () => {
      const html = await fetch(server!.baseUrl).then((response) =>
        response.text(),
      )
      expect(html).toContain('prefixed-module-ok')
      expect(html).toContain('class="board-root"')
      expect(html).toContain('prefixed-node-content')
      expect(html).toContain('class="prefixed-board-probe"')
      expect(html).toContain('data-nodes="1"')
      expect(html).toContain('data-zoom="1"')
    })
  })
})
