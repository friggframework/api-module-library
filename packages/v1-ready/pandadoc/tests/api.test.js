const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://example.com/redirect/pandadoc',
        scope: 'read write',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'doc_1' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'doc_1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('PandaDoc Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth endpoints', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'sec',
                redirect_uri: 'https://app.example/redirect/pandadoc',
                scope: 'read write',
            });
            expect(api.baseUrl).toBe('https://api.pandadoc.com');
            expect(api.tokenUri).toBe(
                'https://api.pandadoc.com/oauth2/access_token'
            );
            expect(api.authorizationUri).toContain(
                'https://app.pandadoc.com/oauth2/authorize?'
            );
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.authorizationUri).toContain('scope=read+write');
            expect(api.authorizationUri).toContain('response_type=code');
        });

        it('stores access and refresh tokens from params', () => {
            const api = new Api({
                access_token: 'a',
                refresh_token: 'r',
            });
            expect(api.access_token).toBe('a');
            expect(api.refresh_token).toBe('r');
        });
    });

    describe('members', () => {
        it('detailsCurrentMember hits GET /public/v1/members/current', async () => {
            const api = makeApi();
            await api.detailsCurrentMember();
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/members/current'
            );
        });

        it('listMembers hits GET /public/v1/members', async () => {
            const api = makeApi();
            await api.listMembers({ count: 10 });
            expect(api._captured[0].url).toContain(
                'https://api.pandadoc.com/public/v1/members?'
            );
            expect(api._captured[0].url).toContain('count=10');
        });

        it('detailsMember hits GET /public/v1/members/{id}', async () => {
            const api = makeApi();
            await api.detailsMember('mem_1');
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/members/mem_1'
            );
        });
    });

    describe('documents', () => {
        it('listDocuments hits GET /public/v1/documents', async () => {
            const api = makeApi();
            await api.listDocuments({ status: 2, count: 50 });
            const { url } = api._captured[0];
            expect(url).toContain('/public/v1/documents?');
            expect(url).toContain('status=2');
            expect(url).toContain('count=50');
        });

        it('createDocument POSTs the body', async () => {
            const api = makeApi();
            const body = {
                name: 'MSA',
                template_uuid: 'tpl_1',
                recipients: [{ email: 'a@b.com', role: 'Client' }],
            };
            await api.createDocument(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/documents'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('statusDocument / detailsDocument / update / delete paths', async () => {
            const api = makeApi();
            await api.statusDocument('d1');
            await api.detailsDocument('d1');
            await api.updateDocument('d1', { name: 'Renamed' });
            await api.deleteDocument('d1');
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1'
            );
            expect(api._captured[1].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1/details'
            );
            expect(api._captured[2].method).toBe('PATCH');
            expect(api._captured[3].method).toBe('DELETE');
        });

        it('sendDocument / changeDocumentStatus / documentRevertToDraft', async () => {
            const api = makeApi();
            await api.sendDocument('d1', { silent: true });
            await api.changeDocumentStatus('d1', { status: 2 });
            await api.documentRevertToDraft('d1');
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1/send'
            );
            expect(api._captured[1].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1/status'
            );
            expect(api._captured[2].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1/draft'
            );
        });

        it('createDocumentLink and createDocumentEditingSession', async () => {
            const api = makeApi();
            await api.createDocumentLink('d1', {
                recipient: 'a@b.com',
                lifetime: 900,
            });
            await api.createDocumentEditingSession('d1', {
                email: 'a@b.com',
                lifetime: 100,
            });
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1/session'
            );
            expect(api._captured[1].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1/editing-sessions'
            );
        });

        it('downloadDocument hits the download path', async () => {
            const api = makeApi();
            await api.downloadDocument('d1');
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/documents/d1/download'
            );
        });
    });

    describe('templates', () => {
        it('list/create/details/status/update/delete/editing-session', async () => {
            const api = makeApi();
            await api.listTemplates({ count: 5 });
            await api.createTemplate({ name: 'T' });
            await api.statusTemplate('t1');
            await api.detailsTemplate('t1');
            await api.updateTemplate('t1', { name: 'T2' });
            await api.deleteTemplate('t1');
            await api.createTemplateEditingSession('t1', {
                email: 'a@b.com',
            });
            expect(api._captured[0].url).toContain('/public/v1/templates?');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].url).toBe(
                'https://api.pandadoc.com/public/v1/templates/t1'
            );
            expect(api._captured[3].url).toBe(
                'https://api.pandadoc.com/public/v1/templates/t1/details'
            );
            expect(api._captured[6].url).toBe(
                'https://api.pandadoc.com/public/v1/templates/t1/editing-sessions'
            );
        });
    });

    describe('contacts', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            await api.listContacts();
            await api.createContact({ email: 'a@b.com' });
            await api.detailsContact('c1');
            await api.updateContact('c1', { first_name: 'A' });
            await api.deleteContact('c1');
            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/contacts'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].url).toBe(
                'https://api.pandadoc.com/public/v1/contacts/c1'
            );
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('webhook subscriptions', () => {
        it('CRUD + shared-key rotation + event history', async () => {
            const api = makeApi();
            const body = {
                name: 'Frigg',
                url: 'https://hook.example.com/pandadoc',
                triggers: ['document_state_changed'],
            };
            await api.listWebhookSubscriptions();
            await api.createWebhookSubscription(body);
            await api.detailsWebhookSubscription('wh_1');
            await api.updateWebhookSubscription('wh_1', { active: false });
            await api.updateWebhookSubscriptionSharedKey('wh_1');
            await api.deleteWebhookSubscription('wh_1');
            await api.listWebhookEvent();
            await api.detailsWebhookEvent('ev_1');

            expect(api._captured[0].url).toBe(
                'https://api.pandadoc.com/public/v1/webhook-subscriptions'
            );
            expect(api._captured[1].body).toEqual(body);
            expect(api._captured[4].url).toBe(
                'https://api.pandadoc.com/public/v1/webhook-subscriptions/wh_1/shared-key'
            );
            expect(api._captured[6].url).toBe(
                'https://api.pandadoc.com/public/v1/webhook-events'
            );
            expect(api._captured[7].url).toBe(
                'https://api.pandadoc.com/public/v1/webhook-events/ev_1'
            );
        });
    });
});
