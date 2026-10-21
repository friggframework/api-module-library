import { describe, it, expect, vi } from 'vitest';
import { Api } from '../src/api';
import { Definition } from '../src/definition';

const credentials = {
    client_id: 'us-id',
    client_secret: 'us-secret',
    redirect_uri: 'https://example.com/redirect/clio',
    regional_credentials: {
        ca: { client_id: 'ca-id', client_secret: 'ca-secret' },
    },
};

function captureTokenPost(api: Api) {
    return vi
        .spyOn(api, '_post')
        .mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
}

describe('Clio regions', () => {
    it('defaults to the US host and credentials', () => {
        const api = new Api(credentials);

        expect(api.region).toBe('us');
        expect(api.baseUrl).toBe('https://app.clio.com/api/v4');
        expect(api.tokenUri).toBe('https://app.clio.com/oauth/token');
        expect(api.client_id).toBe('us-id');
    });

    it.each([null, ''])('treats a saved region of %j as US', (region) => {
        const api = new Api({ ...credentials, region: region as any });

        expect(api.region).toBe('us');
        expect(api.tokenUri).toBe('https://app.clio.com/oauth/token');
    });

    it('uses the regional host and credentials for a persisted region', () => {
        const api = new Api({ ...credentials, region: 'ca' });

        expect(api.baseUrl).toBe('https://ca.app.clio.com/api/v4');
        expect(api.tokenUri).toBe('https://ca.app.clio.com/oauth/token');
        expect(api.authorizationUri).toContain(
            'https://ca.app.clio.com/oauth/authorize?client_id=ca-id',
        );
        expect(api.client_id).toBe('ca-id');
        expect(api.client_secret).toBe('ca-secret');
    });

    it('falls back to the default credentials when a region has none', () => {
        const api = new Api({ ...credentials, region: 'eu' });

        expect(api.tokenUri).toBe('https://eu.app.clio.com/oauth/token');
        expect(api.client_id).toBe('us-id');
    });

    it('restores the default credentials when switching back to US', () => {
        const api = new Api({ ...credentials, region: 'ca' });
        api.setRegion('us');

        expect(api.tokenUri).toBe('https://app.clio.com/oauth/token');
        expect(api.client_id).toBe('us-id');
        expect(api.client_secret).toBe('us-secret');
    });

    it('rejects an unknown region', () => {
        const api = new Api(credentials);

        expect(() => api.setRegion('xx' as any)).toThrow(
            'Invalid Clio region: xx',
        );
    });

    it('exchanges the code in the region sent with it', async () => {
        const api = new Api(credentials);
        const post = captureTokenPost(api);

        await Definition.requiredAuthMethods.getToken(api, {
            code: 'the-code',
            region: 'ca',
        });

        const [options] = post.mock.calls[0] as any[];
        expect(options.url).toBe('https://ca.app.clio.com/oauth/token');
        expect(options.body.get('client_id')).toBe('ca-id');
        expect(options.body.get('client_secret')).toBe('ca-secret');
        expect(options.body.get('code')).toBe('the-code');
        expect(api.region).toBe('ca');
    });

    it('keeps the US exchange when no region is sent', async () => {
        const api = new Api(credentials);
        const post = captureTokenPost(api);

        await Definition.requiredAuthMethods.getToken(api, {
            code: 'the-code',
        });

        const [options] = post.mock.calls[0] as any[];
        expect(options.url).toBe('https://app.clio.com/oauth/token');
        expect(options.body.get('client_id')).toBe('us-id');
    });

    it('refreshes against the persisted region', async () => {
        const api = new Api({ ...credentials, region: 'ca' });
        const post = captureTokenPost(api);

        await (api as any).refreshAccessToken({ refresh_token: 'r' });

        const [options] = post.mock.calls[0] as any[];
        expect(options.url).toBe('https://ca.app.clio.com/oauth/token');
        expect(options.body.get('client_id')).toBe('ca-id');
        expect(options.body.get('refresh_token')).toBe('r');
    });
});
