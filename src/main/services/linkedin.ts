import { shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

// LinkedIn OAuth configuration
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts'
const LINKEDIN_UPLOAD_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload'

const REDIRECT_PORT = 8377
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`
const SCOPES = ['openid', 'profile', 'w_member_social']

export interface LinkedInCredentials {
  accessToken: string
  expiresAt: number
  userUrn: string
  userName?: string
  profilePicture?: string
}

export interface LinkedInConfig {
  clientId: string
  clientSecret: string
}

/**
 * LinkedIn OAuth and publishing service
 */
export class LinkedInService {
  private credentials: LinkedInCredentials | null = null
  private config: LinkedInConfig | null = null

  constructor(_mainWindow: BrowserWindow) {
    // mainWindow kept for future use (e.g., in-app OAuth flow)
  }

  /**
   * Configure the service with client credentials
   */
  configure(config: LinkedInConfig): void {
    this.config = config
  }

  /**
   * Check if user is connected
   */
  isConnected(): boolean {
    if (!this.credentials) return false
    return Date.now() < this.credentials.expiresAt
  }

  /**
   * Get current credentials
   */
  getCredentials(): LinkedInCredentials | null {
    return this.credentials
  }

  /**
   * Set credentials (for restoring from storage)
   */
  setCredentials(credentials: LinkedInCredentials): void {
    this.credentials = credentials
  }

  /**
   * Start OAuth flow - opens browser for user to authenticate
   */
  async startOAuthFlow(): Promise<LinkedInCredentials> {
    if (!this.config) {
      throw new Error('LinkedIn not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET')
    }

    return new Promise((resolve, reject) => {
      // Start local server to receive callback
      const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:${REDIRECT_PORT}`)
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code')
          const error = url.searchParams.get('error')
          const errorDescription = url.searchParams.get('error_description')

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
              <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>❌ Authorization Failed</h1>
                <p>${errorDescription || error}</p>
                <p>You can close this window.</p>
              </body></html>
            `)
            server.close()
            reject(new Error(errorDescription || error))
            return
          }

          if (code) {
            try {
              // Exchange code for token
              const credentials = await this.exchangeCodeForToken(code)
              this.credentials = credentials

              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(`
                <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1>✅ Connected to LinkedIn!</h1>
                  <p>Welcome, ${credentials.userName || 'User'}!</p>
                  <p>You can close this window and return to the app.</p>
                  <script>setTimeout(() => window.close(), 2000)</script>
                </body></html>
              `)
              server.close()
              resolve(credentials)
            } catch (err) {
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(`
                <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1>❌ Error</h1>
                  <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
                  <p>You can close this window.</p>
                </body></html>
              `)
              server.close()
              reject(err)
            }
          }
        }
      })

      server.listen(REDIRECT_PORT, () => {
        // Build authorization URL
        const authUrl = new URL(LINKEDIN_AUTH_URL)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('client_id', this.config!.clientId)
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
        authUrl.searchParams.set('scope', SCOPES.join(' '))
        authUrl.searchParams.set('state', crypto.randomUUID())

        // Open in default browser
        shell.openExternal(authUrl.toString())
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close()
        reject(new Error('OAuth timeout - please try again'))
      }, 5 * 60 * 1000)
    })
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<LinkedInCredentials> {
    if (!this.config) throw new Error('LinkedIn not configured')

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    })

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const data = await response.json() as {
      access_token: string
      expires_in: number
    }

    // Get user info
    const userInfo = await this.getUserInfo(data.access_token)

    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      userUrn: userInfo.sub,
      userName: userInfo.name,
      profilePicture: userInfo.picture
    }
  }

  /**
   * Get user info from LinkedIn
   */
  private async getUserInfo(accessToken: string): Promise<{
    sub: string
    name?: string
    picture?: string
  }> {
    const response = await fetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!response.ok) {
      throw new Error('Failed to get user info')
    }

    return response.json()
  }

  /**
   * Disconnect from LinkedIn
   */
  disconnect(): void {
    this.credentials = null
  }

  /**
   * Publish a text post to LinkedIn
   */
  async publishTextPost(text: string): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!this.credentials) {
      return { success: false, error: 'Not connected to LinkedIn' }
    }

    if (!this.isConnected()) {
      return { success: false, error: 'LinkedIn token expired. Please reconnect.' }
    }

    try {
      const response = await fetch(LINKEDIN_POSTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          author: `urn:li:person:${this.credentials.userUrn}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        })
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[linkedin] Publish failed:', error)
        return { success: false, error: `Failed to publish: ${response.status}` }
      }

      const data = await response.json() as { id: string }
      console.log('[linkedin] Published successfully:', data.id)
      return { success: true, postId: data.id }
    } catch (error) {
      console.error('[linkedin] Publish error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Publish a post with an image
   */
  async publishPostWithImage(
    text: string, 
    imageData: string // base64 or URL
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!this.credentials) {
      return { success: false, error: 'Not connected to LinkedIn' }
    }

    try {
      // Step 1: Register upload
      const uploadResponse = await fetch(LINKEDIN_UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: `urn:li:person:${this.credentials.userUrn}`,
            serviceRelationships: [{
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }]
          }
        })
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text()
        return { success: false, error: `Failed to register upload: ${error}` }
      }

      const uploadData = await uploadResponse.json() as {
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: string
            }
          }
          asset: string
        }
      }

      const uploadUrl = uploadData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
      const assetUrn = uploadData.value.asset

      // Step 2: Upload the image
      let imageBuffer: Buffer
      if (imageData.startsWith('data:')) {
        // Base64 data URL
        const base64 = imageData.split(',')[1]
        imageBuffer = Buffer.from(base64, 'base64')
      } else {
        // Assume it's a URL, fetch it
        const imgResponse = await fetch(imageData)
        imageBuffer = Buffer.from(await imgResponse.arrayBuffer())
      }

      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'image/png'
        },
        body: new Uint8Array(imageBuffer)
      })

      if (!uploadResult.ok) {
        return { success: false, error: 'Failed to upload image' }
      }

      // Step 3: Create post with image
      const postResponse = await fetch(LINKEDIN_POSTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          author: `urn:li:person:${this.credentials.userUrn}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text },
              shareMediaCategory: 'IMAGE',
              media: [{
                status: 'READY',
                media: assetUrn
              }]
            }
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        })
      })

      if (!postResponse.ok) {
        const error = await postResponse.text()
        return { success: false, error: `Failed to publish: ${error}` }
      }

      const data = await postResponse.json() as { id: string }
      return { success: true, postId: data.id }
    } catch (error) {
      console.error('[linkedin] Publish with image error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
