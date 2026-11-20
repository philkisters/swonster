import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [projectId, uid] = process.argv.slice(2)
if (!projectId || !uid || process.argv.length !== 4) {
  throw new Error('Usage: node functions/grant-admin.mjs <firebase-project-id> <user-uid>')
}

initializeApp({ credential: applicationDefault(), projectId })
const auth = getAuth()
const user = await auth.getUser(uid)
if (!user.providerData.some(provider => provider.providerId === 'google.com')) {
  throw new Error('The account must be linked to Google before granting admin access.')
}
await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true })
console.log(`Granted admin access to ${uid} in ${projectId}. Refresh the ID token or sign in again.`)
