// Secure settings storage with encryption for API keys
import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const SETTINGS_DIR = path.join(app.getPath('userData'), 'agentic-marketer')
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json')
const SECURE_KEYS_FILE = path.join(SETTINGS_DIR, 'secure-keys.bin')

export interface AppSettings {
  orchestrationMode: 'pipeline' | 'single-agent'
  // Non-sensitive settings stored in plain JSON
}

export interface ApiKeys {
  openaiApiKey?: string
  exaApiKey?: string
  linkedinClientId?: string
  linkedinClientSecret?: string
}

// Ensure settings directory exists
function ensureDir(): void {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true })
  }
}

// Load plain settings
export function loadSettings(): AppSettings {
  ensureDir()
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('[settings] Failed to load settings:', error)
  }
  return { orchestrationMode: 'pipeline' }
}

// Save plain settings
export function saveSettings(settings: AppSettings): void {
  ensureDir()
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

// Check if encryption is available
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

// Load API keys (encrypted if available)
export function loadApiKeys(): ApiKeys {
  ensureDir()
  
  try {
    if (fs.existsSync(SECURE_KEYS_FILE)) {
      const encryptedData = fs.readFileSync(SECURE_KEYS_FILE)
      
      if (isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(encryptedData)
        return JSON.parse(decrypted)
      } else {
        // Fallback: stored as base64 (not truly secure, but better than plain text)
        const decoded = Buffer.from(encryptedData.toString(), 'base64').toString('utf-8')
        return JSON.parse(decoded)
      }
    }
  } catch (error) {
    console.error('[settings] Failed to load API keys:', error)
  }
  
  return {}
}

// Save API keys (encrypted if available)
export function saveApiKeys(keys: ApiKeys): void {
  ensureDir()
  
  const jsonData = JSON.stringify(keys)
  
  if (isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(jsonData)
    fs.writeFileSync(SECURE_KEYS_FILE, encrypted)
  } else {
    // Fallback: base64 encode (not truly secure)
    const encoded = Buffer.from(jsonData).toString('base64')
    fs.writeFileSync(SECURE_KEYS_FILE, encoded)
  }
}

// Get a specific API key (checks settings first, then env vars)
export function getApiKey(key: keyof ApiKeys): string | undefined {
  const keys = loadApiKeys()
  
  // Check saved settings first
  if (keys[key]) {
    return keys[key]
  }
  
  // Fallback to environment variables
  switch (key) {
    case 'openaiApiKey':
      return process.env.OPENAI_API_KEY
    case 'exaApiKey':
      return process.env.EXA_API_KEY
    case 'linkedinClientId':
      return process.env.LINKEDIN_CLIENT_ID
    case 'linkedinClientSecret':
      return process.env.LINKEDIN_CLIENT_SECRET
    default:
      return undefined
  }
}

// Get all API key statuses (configured or not)
export function getApiKeyStatus(): Record<keyof ApiKeys, boolean> {
  return {
    openaiApiKey: !!getApiKey('openaiApiKey'),
    exaApiKey: !!getApiKey('exaApiKey'),
    linkedinClientId: !!getApiKey('linkedinClientId'),
    linkedinClientSecret: !!getApiKey('linkedinClientSecret')
  }
}

// Validate OpenAI API key
export async function validateOpenAiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    })
    
    if (response.ok) {
      return { valid: true }
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' }
    } else {
      return { valid: false, error: `API error: ${response.status}` }
    }
  } catch (error) {
    return { valid: false, error: 'Network error' }
  }
}

// Validate Exa API key
export async function validateExaKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'test', numResults: 1 })
    })
    
    if (response.ok) {
      return { valid: true }
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' }
    } else {
      return { valid: false, error: `API error: ${response.status}` }
    }
  } catch (error) {
    return { valid: false, error: 'Network error' }
  }
}
