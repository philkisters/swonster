import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import type { CallableRequest } from 'firebase-functions/v2/https'
import { parseAvailableConfig } from '../../game/configValidation.ts'

initializeApp()

function requireAdmin(request: CallableRequest) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in as an administrator.')
  if (request.auth.token.admin !== true || request.auth.token.firebase.sign_in_provider !== 'google.com') {
    throw new HttpsError('permission-denied', 'A Google administrator account is required.')
  }
}

function isConfigId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= 1500
    && /^[a-zA-Z0-9_-]+$/.test(id) && !/^__.*__$/.test(id)
}

export const publishConfig = onCall({ region: 'europe-west1' }, async (request) => {
  requireAdmin(request)
  const data: unknown = request.data
  if (!data || typeof data !== 'object' || !('id' in data) || !isConfigId(data.id)) {
    throw new HttpsError('invalid-argument', 'Use a new config ID containing only letters, numbers, underscores, or hyphens.')
  }
  if (!('name' in data) || !('rules' in data)) {
    throw new HttpsError('invalid-argument', 'A name and complete rules are required.')
  }

  let config
  try {
    config = parseAvailableConfig(data.id, { name: data.name, rules: data.rules })
  } catch (error) {
    throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Invalid configuration.')
  }

  try {
    await getFirestore().collection('configs').doc(config.id).create({
      name: config.name,
      rules: config.rules
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 6) {
      throw new HttpsError('already-exists', 'That config ID already exists. Publish with a new ID.')
    }
    console.error('Could not publish configuration.', error)
    throw new HttpsError('internal', 'Could not publish the configuration. Check the function logs.')
  }

  return { id: config.id }
})

export const setConfigArchived = onCall({ region: 'europe-west1' }, async (request) => {
  requireAdmin(request)
  const data: unknown = request.data
  if (!data || typeof data !== 'object' || !('id' in data) || !isConfigId(data.id)
    || !('archived' in data) || typeof data.archived !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A valid config ID and archive status are required.')
  }

  try {
    await getFirestore().collection('configs').doc(data.id).update({ archived: data.archived })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 5) {
      throw new HttpsError('not-found', 'That configuration no longer exists.')
    }
    console.error('Could not update configuration archive status.', error)
    throw new HttpsError('internal', 'Could not update the configuration. Check the function logs.')
  }
  return { id: data.id, archived: data.archived }
})
