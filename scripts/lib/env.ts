/**
 * Loads .env.local for standalone scripts. Variables already set in the real environment win
 * (Node's loader never overrides existing values). Never prints values.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'

const ENV_FILE = path.resolve(process.cwd(), '.env.local')

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`✖ ${name} is not set. Run \`make setup\` (writes .env.local) or export it.`)
    process.exit(1)
  }
  return value
}
