#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shimRootDir = path.join(repoRoot, 'node_modules', '.cache', 'package-bin-shims')
const cwdPackageJsonPath = path.join(process.cwd(), 'package.json')

function isJavaScriptEntry(filePath) {
  return /\.(?:cjs|js|mjs)$/i.test(filePath)
}

function findPackageJsonPath(fromPath) {
  let currentDir = path.dirname(fromPath)

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json')

    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath
    }

    const parentDir = path.dirname(currentDir)

    if (parentDir === currentDir) {
      throw new Error(`Unable to locate package.json for "${fromPath}".`)
    }

    currentDir = parentDir
  }
}

function resolvePackageJsonPath(packageName, resolveFromPath) {
  const packageRequire = createRequire(resolveFromPath ?? cwdPackageJsonPath)

  try {
    return packageRequire.resolve(`${packageName}/package.json`)
  } catch {
    const packageEntryPath = packageRequire.resolve(packageName)
    return findPackageJsonPath(packageEntryPath)
  }
}

function readPackageMetadata(packageName, resolveFromPath) {
  const packageJsonPath = resolvePackageJsonPath(packageName, resolveFromPath)
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  return { packageJsonPath, packageJson }
}

function resolveBinPath(packageJsonPath, packageJson, binName) {
  const packageDisplayName = packageJson.name ?? packageJsonPath

  if (!packageJson.bin) {
    throw new Error(`Package "${packageDisplayName}" does not expose a bin entry.`)
  }

  const binEntry =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : binName
        ? packageJson.bin[binName]
        : Object.values(packageJson.bin)[0]

  if (!binEntry) {
    if (binName) {
      throw new Error(`Package "${packageDisplayName}" does not expose a "${binName}" bin entry.`)
    }

    throw new Error(`Package "${packageDisplayName}" exposes an empty bin entry.`)
  }

  return path.resolve(path.dirname(packageJsonPath), binEntry)
}

function getPackageBinEntries(packageJson) {
  if (!packageJson.bin) {
    return []
  }

  return typeof packageJson.bin === 'string'
    ? [[packageJson.name ?? 'bin', packageJson.bin]]
    : Object.entries(packageJson.bin)
}

function quoteForShell(value) {
  return `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`
}

function ensurePackageBinShims(packageJsonPath, packageJson) {
  const packageName = packageJson.name ?? path.basename(path.dirname(packageJsonPath))
  const shimDir = path.join(shimRootDir, packageName.replace(/[@/]/g, '_'))

  fs.mkdirSync(shimDir, { recursive: true })

  for (const [binName, binEntry] of getPackageBinEntries(packageJson)) {
    const resolvedBinPath = path.resolve(path.dirname(packageJsonPath), binEntry)
    const shimPath = path.join(shimDir, binName)
    const shimSource = isJavaScriptEntry(resolvedBinPath)
      ? `#!/bin/sh\nexec ${quoteForShell(process.execPath)} ${quoteForShell(resolvedBinPath)} "$@"\n`
      : `#!/bin/sh\nexec ${quoteForShell(resolvedBinPath)} "$@"\n`

    fs.writeFileSync(shimPath, shimSource, { mode: 0o755 })
  }

  return shimDir
}

function collectRelatedBinDirs(packageJsonPath, packageJson) {
  const binDirs = new Set([ensurePackageBinShims(packageJsonPath, packageJson)])
  const relatedPackages = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {})
  ])

  for (const dependencyName of relatedPackages) {
    try {
      const dependency = readPackageMetadata(dependencyName, packageJsonPath)

      if (!dependency.packageJson.bin) {
        continue
      }

      binDirs.add(ensurePackageBinShims(dependency.packageJsonPath, dependency.packageJson))
    } catch {
      // Skip unresolved optional helpers. The primary binary can still run without them.
    }
  }

  return [...binDirs]
}

export function runPackageBin(packageName, args = [], options = {}) {
  const { packageJsonPath, packageJson } = readPackageMetadata(packageName)
  const binPath = resolveBinPath(packageJsonPath, packageJson, options.binName)
  const command = isJavaScriptEntry(binPath) ? process.execPath : binPath
  const commandArgs = isJavaScriptEntry(binPath) ? [binPath, ...args] : args
  const binDirs = collectRelatedBinDirs(packageJsonPath, packageJson)
  const env = {
    ...process.env,
    ...options.env,
    PATH: [binDirs.join(path.delimiter), options.env?.PATH ?? process.env.PATH].filter(Boolean).join(path.delimiter)
  }

  return runCommand(command, commandArgs, {
    ...options,
    env
  })
}

export function runNodeFile(filePath, args = [], options = {}) {
  return runCommand(process.execPath, [filePath, ...args], options)
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: options.stdio ?? 'inherit'
    })

    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        return
      }

      resolve(code ?? 0)
    })
  })
}

async function main() {
  const [packageName, ...args] = process.argv.slice(2)

  if (!packageName) {
    console.error('Usage: node scripts/run-package-bin.mjs <package-name> [--bin=<bin-name>] [...args]')
    process.exit(1)
  }

  const [maybeBinArg, ...binArgs] = args
  const hasBinOverride = maybeBinArg?.startsWith('--bin=')
  const binName = hasBinOverride ? maybeBinArg.slice('--bin='.length) : undefined
  const exitCode = await runPackageBin(packageName, hasBinOverride ? binArgs : args, { binName })
  process.exit(exitCode)
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
