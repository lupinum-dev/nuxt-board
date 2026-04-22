import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const host = '127.0.0.1'
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureRoot = fileURLToPath(new URL('./fixtures/basic', import.meta.url))

let port = 0
let serverProcess: ChildProcessWithoutNullStreams | undefined
let serverOutput = ''

const getBaseUrl = () => `http://${host}:${port}/`

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

async function waitForServerReady() {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(getBaseUrl())
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

  const output = serverOutput.trim()
  const detail = output ? `\n\nServer output:\n${output}` : ''
  throw new Error(`Timed out waiting for the Nuxt fixture server.${detail}`, {
    cause: lastError,
  })
}

beforeAll(async () => {
  port = await getAvailablePort()
  serverProcess = spawn(
    'pnpm',
    [
      'exec',
      'nuxi',
      'dev',
      fixtureRoot,
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

  const collectOutput = (chunk: Buffer) => {
    serverOutput += chunk.toString()

    if (serverOutput.length > 8000) {
      serverOutput = serverOutput.slice(-8000)
    }
  }

  serverProcess.stdout.on('data', collectOutput)
  serverProcess.stderr.on('data', collectOutput)

  await waitForServerReady()
}, 120_000)

afterAll(async () => {
  if (!serverProcess) {
    return
  }

  if (serverProcess.exitCode === null && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
    await delay(250)
  }

  if (serverProcess.exitCode === null && !serverProcess.killed) {
    serverProcess.kill('SIGKILL')
  }
}, 30_000)

describe('@lupinum/nuxt-board module', () => {
  it('renders static page content server-side', async () => {
    const html = await fetch(getBaseUrl()).then((response) => response.text())
    expect(html).toContain('board-module-ok')
  })

  it('server-renders the board markup and initial nodes', async () => {
    const html = await fetch(getBaseUrl()).then((response) => response.text())
    expect(html).toContain('class="board-root"')
    expect(html).toContain('fixture-node-content')
  })
})
