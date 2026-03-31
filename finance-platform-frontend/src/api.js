import axios from 'axios'

const DEFAULT_REQUEST_TIMEOUT_MS = 15 * 60 * 1000
const requestTimeoutMs = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS)
const uploadTimeoutMs = Number(import.meta.env.VITE_UPLOAD_TIMEOUT_MS || requestTimeoutMs)
const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim()
const apiBaseCandidates = Array.from(
  new Set(
    [
      configuredBaseUrl || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4000',
    ].filter(Boolean)
  )
)

const api = axios.create({
  baseURL: apiBaseCandidates[0],
  timeout: requestTimeoutMs,
})

function shouldTryNextBase(error) {
  if (!error) return false
  if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') return true
  if (!error?.response) return true
  return false
}

async function runWithBaseFallback(requestFn) {
  let lastError = null
  for (const baseURL of apiBaseCandidates) {
    try {
      api.defaults.baseURL = baseURL
      return await requestFn()
    } catch (error) {
      lastError = error
      if (!shouldTryNextBase(error)) throw error
    }
  }
  throw lastError || new Error('Backend API is not reachable.')
}

function isRetriableUploadError(error) {
  const status = error?.response?.status
  const code = error?.code
  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK') return true
  if (!status) return true
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || status === 524
}

function formatUploadError(error, fileName) {
  const status = error?.response?.status
  if (status) return `Submission failed for "${fileName}" (HTTP ${status}).`
  if (error?.code === 'ERR_NETWORK') return `Cannot reach backend API at ${api.defaults.baseURL}.`
  if (error?.code === 'ECONNABORTED') return `Submission timed out for "${fileName}".`
  return error?.message || `Submission failed for "${fileName}".`
}

function base64ToBlob(base64Content, mimeType) {
  const binary = atob(base64Content)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

export async function uploadFinancialDocuments(files, userEmail = '') {
  const results = []
  try {
    await runWithBaseFallback(() => api.get('/health', { timeout: 10000 }))
  } catch {
    throw new Error(`Backend API is not reachable. Tried: ${apiBaseCandidates.join(', ')}`)
  }

  for (const file of files) {
    let lastError = null

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        if (userEmail) formData.append('userEmail', userEmail)

        const response = await runWithBaseFallback(() =>
          api.post('/documents/submit', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: uploadTimeoutMs,
          })
        )

        results.push({
          fileName: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          jobId: response?.data?.jobId,
          status: 'Submitted',
        })
        lastError = null
        break
      } catch (error) {
        lastError = error
        if (!isRetriableUploadError(error)) break
      }
    }

    if (lastError) {
      const wrapped = new Error(formatUploadError(lastError, file.name))
      wrapped.cause = lastError
      throw wrapped
    }
  }

  return results
}

export async function fetchLatestEmailAttachment(afterUid = 0) {
  const response = await runWithBaseFallback(() =>
    api.get('/documents/latest-email-attachment', {
      params: { afterUid },
      validateStatus: (status) => status === 200 || status === 204,
      timeout: requestTimeoutMs,
    })
  )

  if (response.status === 204 || !response.data?.base64Content) return null

  const zipBlob = base64ToBlob(response.data.base64Content, response.data.mimeType)
  return {
    emailUid: response.data.uid,
    fileName: response.data.fileName,
    size: zipBlob.size,
    uploadedAt: new Date().toISOString(),
    zipName: response.data.fileName,
    zipBlob,
    emailMeta: {
      subject: response.data.subject,
      from: response.data.from,
      to: response.data.to,
      sentAt: response.data.sentAt,
    },
  }
}

export async function generateAIReport(payload) {
  const response = await runWithBaseFallback(() => api.post('/analytics/report', payload))

  return response.data
}

export async function fetchRbiGuidelines() {
  const response = await runWithBaseFallback(() =>
    api.get('/rbi/latest-guidelines', {
      timeout: 30000,
    })
  )
  return response.data
}

export async function askFinanceChatbot(question, structuredFiles, documentLinks = []) {
  const response = await runWithBaseFallback(() =>
    api.post('/chat', {
      question,
      domain: 'finance-only',
      documents: structuredFiles.map((item) => item.structuredData),
      documentLinks,
    })
  )

  return response.data
}

export async function fetchUserProfile(userId) {
  if (!userId) throw new Error('userId is required')

  try {
    const response = await runWithBaseFallback(() => api.get(`/profiles/${encodeURIComponent(userId)}`))
    return response.data
  } catch (error) {
    if (error?.response?.status === 404) return null
    throw error
  }
}

export async function saveUserProfile(userId, profile, email = '') {
  if (!userId) throw new Error('userId is required')
  const response = await runWithBaseFallback(() =>
    api.put(`/profiles/${encodeURIComponent(userId)}`, {
      email,
      fullName: profile?.fullName || '',
      institution: profile?.institution || '',
      role: profile?.role || '',
      phone: profile?.phone || '',
      country: profile?.country || '',
    })
  )
  return response.data
}

export default api
