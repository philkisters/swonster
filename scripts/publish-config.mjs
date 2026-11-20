import { readFile } from 'node:fs/promises'
import { DEFAULT_GAME_CONFIG } from '../game/config.ts'
import { parseAvailableConfig } from '../game/configValidation.ts'

const [projectId, id, name, rulesFile] = process.argv.slice(2)
const token = process.env.FIRESTORE_ACCESS_TOKEN
if (!projectId || !id || !name || !token || !/^[a-zA-Z0-9_-]+$/.test(id) || id === '__legacy__') {
  throw new Error('Usage: set FIRESTORE_ACCESS_TOKEN, then run node scripts/publish-config.mjs <project-id> <config-id> <name> [rules.json]')
}

const input = rulesFile ? JSON.parse(await readFile(rulesFile, 'utf8')) : DEFAULT_GAME_CONFIG
const { rules } = parseAvailableConfig(id, { name, rules: input })

function firestoreValue(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } }
  return { mapValue: { fields: firestoreFields(value) } }
}

function firestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]))
}

const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/configs?documentId=${encodeURIComponent(id)}`
const response = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: firestoreFields({ name, rules }) })
})
if (!response.ok) throw new Error(`Could not publish configuration (${response.status}): ${await response.text()}`)
console.log(`Published configuration ${id}.`)
