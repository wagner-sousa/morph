import { describe, expect, it, vi } from 'vitest';
import { MorphOAuthProvider } from '../../src/mcp-client/oauth-provider.js';
import { OAuthStore } from '../../src/mcp-client/oauth-store.js';

function createProvider(): MorphOAuthProvider {
  const store = { get: vi.fn(), set: vi.fn(), delete: vi.fn(), clearPending: vi.fn(), save: vi.fn() } as unknown as OAuthStore;
  return new MorphOAuthProvider('test-mcp', store, 'http://localhost:3101');
}

describe('MorphOAuthProvider', () => {
  it('redirectUrl formats correctly', () => {
    const p = createProvider();
    expect(p.redirectUrl).toBe('http://localhost:3101/api/mcps/test-mcp/oauth/callback');
  });

  it('clientMetadata has redirect_uris', () => {
    const p = createProvider();
    expect(p.clientMetadata.redirect_uris).toContain('http://localhost:3101/api/mcps/test-mcp/oauth/callback');
    expect(p.clientMetadata.client_name).toBe('Morph-test-mcp');
  });

  it('saveClientInformation delegates to store', async () => {
    const p = createProvider();
    await p.saveClientInformation({ client_id: 'cid' } as never);
    expect((p as unknown as { store: { set: ReturnType<typeof vi.fn> } }).store.set).toHaveBeenCalled();
  });

  it('saveTokens delegates to store', async () => {
    const p = createProvider();
    await p.saveTokens({ access_token: 'tok' } as never);
    expect((p as unknown as { store: { set: ReturnType<typeof vi.fn> } }).store.set).toHaveBeenCalled();
  });

  it('saveCodeVerifier delegates to store', async () => {
    const p = createProvider();
    await p.saveCodeVerifier('verifier');
    expect((p as unknown as { store: { set: ReturnType<typeof vi.fn> } }).store.set).toHaveBeenCalled();
  });

  it('codeVerifier throws when missing', async () => {
    const p = createProvider();
    await expect(p.codeVerifier()).rejects.toThrow('No PKCE code verifier found');
  });

  it('redirectToAuthorization stores URL', async () => {
    const p = createProvider();
    const url = new URL('http://auth/url');
    await p.redirectToAuthorization(url);
    expect((p as unknown as { store: { set: ReturnType<typeof vi.fn> } }).store.set).toHaveBeenCalledWith('test-mcp', { authorizationUrl: 'http://auth/url' });
  });

  it('waitForRedirect resolves with pendingUrl when available', async () => {
    const p = createProvider();
    const url = new URL('http://pending');
    await p.redirectToAuthorization(url);
    const result = await p.waitForRedirect();
    expect(result.toString()).toBe('http://pending/');
  });

  it('waitForRedirect returns a promise when no pendingUrl', async () => {
    const p = createProvider();
    const promise = p.waitForRedirect();
    const url = new URL('http://later');
    await p.redirectToAuthorization(url);
    const result = await promise;
    expect(result.toString()).toBe('http://later/');
  });

  it('getAuthorizationUrl returns undefined when no URL stored', () => {
    const p = createProvider();
    expect(p.getAuthorizationUrl()).toBeUndefined();
  });

  it('hasTokens returns false by default', () => {
    const p = createProvider();
    expect(p.hasTokens()).toBe(false);
  });

  it('invalidateCredentials calls store.delete for all', async () => {
    const p = createProvider();
    await p.invalidateCredentials('all');
    expect((p as unknown as { store: { delete: ReturnType<typeof vi.fn> } }).store.delete).toHaveBeenCalledWith('test-mcp');
  });
});
