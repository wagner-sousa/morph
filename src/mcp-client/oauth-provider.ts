import type { OAuthClientProvider, OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { OAuthStore } from './oauth-store.js';

export class MorphOAuthProvider implements OAuthClientProvider {
  private resolveRedirect: ((url: URL) => void) | undefined;
  private pendingUrl: URL | undefined;

  constructor(
    private readonly mcpName: string,
    private readonly store: OAuthStore,
    private readonly baseUrl: string,
  ) { }

  get redirectUrl(): string | URL {
    return `${this.baseUrl}/api/mcps/${this.mcpName}/oauth/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [String(this.redirectUrl)] as unknown as [string, ...string[]],
      client_name: `Morph-${this.mcpName}`,
    };
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return this.store.get(this.mcpName)?.clientInformation;
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    await this.store.set(this.mcpName, { clientInformation: info });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return this.store.get(this.mcpName)?.tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const existing = this.store.get(this.mcpName) ?? {};
    existing.tokens = tokens;
    await this.store.set(this.mcpName, existing);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.store.set(this.mcpName, {
      authorizationUrl: authorizationUrl.toString(),
    });
    this.pendingUrl = authorizationUrl;
    if (this.resolveRedirect) {
      this.resolveRedirect(authorizationUrl);
      this.resolveRedirect = undefined;
    }
  }

  saveCodeVerifier(codeVerifier: string): Promise<void> {
    return this.store.set(this.mcpName, { codeVerifier });
  }

  async codeVerifier(): Promise<string> {
    const v = this.store.get(this.mcpName)?.codeVerifier;
    if (!v) throw new Error('No PKCE code verifier found');
    return v;
  }

  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    await this.store.set(this.mcpName, {
      authorizationServerUrl: state.authorizationServerUrl,
      resourceMetadataUrl: state.resourceMetadataUrl,
    });
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    const s = this.store.get(this.mcpName);
    if (!s?.authorizationServerUrl) return undefined;
    return {
      authorizationServerUrl: s.authorizationServerUrl,
      resourceMetadataUrl: s.resourceMetadataUrl,
    };
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    switch (scope) {
      case 'all':
        await this.store.delete(this.mcpName);
        break;
      case 'tokens':
        {
          const existing = this.store.get(this.mcpName);
          if (existing) {
            delete existing.tokens;
            await this.store.save();
          }
        }
        break;
      case 'verifier':
        await this.store.clearPending(this.mcpName);
        break;
      case 'client':
        {
          const existing = this.store.get(this.mcpName);
          if (existing) {
            delete existing.clientInformation;
            await this.store.save();
          }
        }
        break;
      case 'discovery':
        {
          const existing = this.store.get(this.mcpName);
          if (existing) {
            delete existing.authorizationServerUrl;
            delete existing.resourceMetadata;
            delete existing.serverMetadata;
            delete existing.resourceMetadataUrl;
            await this.store.save();
          }
        }
        break;
    }
  }

  getAuthorizationUrl(): string | undefined {
    return this.store.get(this.mcpName)?.authorizationUrl;
  }

  hasTokens(): boolean {
    return !!this.store.get(this.mcpName)?.tokens;
  }

  waitForRedirect(): Promise<URL> {
    if (this.pendingUrl) {
      const url = this.pendingUrl;
      this.pendingUrl = undefined;
      return Promise.resolve(url);
    }
    return new Promise((resolve) => {
      this.resolveRedirect = resolve;
    });
  }
}
