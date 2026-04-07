#!/usr/bin/env node

import { copyFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNodeFile, runPackageBin } from './run-package-bin.mjs'

const require = createRequire(import.meta.url)
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const envPath = path.join(repoRoot, '.env')
const envExamplePath = path.join(repoRoot, '.env.example')

function ensureEnvFile() {
  if (existsSync(envPath) || !existsSync(envExamplePath)) {
    return
  }

  copyFileSync(envExamplePath, envPath)
  console.warn('[dev] .env was missing, created it from .env.example')
}

function loadEnvFile() {
  const dotenv = require('dotenv')

  dotenv.config({ path: envPath })
}

function hasElectronBinary() {
  try {
    require('electron')
    return true
  } catch {
    return false
  }
}

async function ensureElectronInstalled() {
  if (hasElectronBinary()) {
    return
  }

  console.warn('[dev] Electron runtime is missing, restoring it now...')

  const exitCode = await runNodeFile(require.resolve('electron/install.js'), [], {
    cwd: repoRoot,
    env: process.env
  })

  if (exitCode !== 0 || !hasElectronBinary()) {
    throw new Error(
      'Electron runtime install failed. If your network is restricted, retry with ELECTRON_MIRROR set to a reachable mirror.'
    )
  }
}

async function main() {
  ensureEnvFile()
  loadEnvFile()
  await ensureElectronInstalled()

  const args = process.argv.slice(2)
  const exitCode = await runPackageBin('electron-vite', args, {
    cwd: repoRoot,
    env: process.env
  })

  process.exit(exitCode)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
