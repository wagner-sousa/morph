import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { OAuthTokens, OAuthClientInformationMixed, OAuthClientMetadata, OAuthProtectedResourceMetadata, AuthorizationServerMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

export interface OAuthStoreData {
  tokens?: OAuthTokens;
  clientInformation?: OAuthClientInformationMixed;
  clientMetadata?: OAuthClientMetadata;
  codeVerifier?: string;
  authorizationUrl?: string;
  authorizationServerUrl?: string;
  resourceMetadata?: OAuthProtectedResourceMetadata;
  serverMetadata?: AuthorizationServerMetadata;
  resourceMetadataUrl?: string;
}

const SESSIONS = new Map<string, OAuthStoreData>();

export class OAuthStore {
  private filePath: string;

  constructor(dataDir: string) {
    this.filePath = resolve(dataDir, 'oauth-sessions.json');
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, OAuthStoreData>;
      Object.entries(parsed).forEach(([k, v]) => SESSIONS.set(k, v));
    } catch { }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const obj: Record<string, OAuthStoreData> = {};
    Array.from(SESSIONS.entries()).forEach(([k, v]) => { obj[k] = v; });
    await writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
  }

  get(mcpName: string): OAuthStoreData | undefined {
    return SESSIONS.get(mcpName);
  }

  async set(mcpName: string, data: OAuthStoreData): Promise<void> {
    const existing = SESSIONS.get(mcpName) ?? {};
    Object.assign(existing, data);
    SESSIONS.set(mcpName, existing);
    await this.save();
  }

  async delete(mcpName: string): Promise<void> {
    SESSIONS.delete(mcpName);
    await this.save();
  }

  async clearPending(mcpName: string): Promise<void> {
    const existing = SESSIONS.get(mcpName);
    if (existing) {
      delete existing.codeVerifier;
      delete existing.authorizationUrl;
      await this.save();
    }
  }
}
