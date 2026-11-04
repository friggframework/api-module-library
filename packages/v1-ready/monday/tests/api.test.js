const crypto = require('crypto');
const { Api, MondayGraphqlError, verifyHs256Jwt } = require('../api');

// Fully offline: stub `_post` and assert on the GraphQL request the methods build.
function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/monday',
        ...overrides,
    });
    api._captured = [];
    api._post = async (options) => {
        api._captured.push(options);
        return { data: {} };
    };
    return api;
}

function lastBody(api) {
    const captured = api._captured[api._captured.length - 1];
    return captured.body;
}

describe('monday Api', () => {
    describe('construction & auth', () => {
        it('sets the GraphQL base URL and default API version', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe('https://api.monday.com/v2');
            expect(api.apiVersion).toBe('2026-07');
            expect(api.tokenUri).toBe('https://auth.monday.com/oauth2/token');
            expect(api.isRefreshable).toBe(false);
        });

        it('builds the OAuth authorize URL', () => {
            const api = new Api({
                client_id: 'abc',
                redirect_uri: 'https://x.example/redirect/monday',
                scope: 'me:read boards:read',
            });
            expect(api.authorizationUri).toContain(
                'https://auth.monday.com/oauth2/authorize'
            );
            expect(api.authorizationUri).toContain('client_id=abc');
            expect(api.authorizationUri).toContain('response_type=code');
            expect(decodeURIComponent(api.authorizationUri)).toContain(
                'scope=me:read boards:read'
            );
        });

        it('accepts api_token as an alias for access_token', () => {
            const api = new Api({ api_token: 'personal' });
            expect(api.access_token).toBe('personal');
        });
    });

    describe('graphql transport', () => {
        it('POSTs to baseUrl with API-Version and JSON body', async () => {
            const api = makeApi();
            await api.graphql('query { me { id } }', { a: 1 });
            const c = api._captured[0];
            expect(c.url).toBe('https://api.monday.com/v2');
            expect(c.headers['Content-Type']).toBe('application/json');
            expect(c.headers['API-Version']).toBe('2026-07');
            expect(c.body).toEqual({
                query: 'query { me { id } }',
                variables: { a: 1 },
            });
        });

        it('throws MondayGraphqlError when GraphQL returns errors', async () => {
            const api = makeApi();
            api._post = async () => ({
                errors: [
                    {
                        message: 'not allowed',
                        extensions: { code: 'NOT_AUTHENTICATED' },
                    },
                ],
            });
            await expect(api.graphql('query { me { id } }')).rejects.toBeInstanceOf(
                MondayGraphqlError
            );
            try {
                await api.graphql('query { me { id } }');
            } catch (e) {
                expect(e.statusCode).toBe(401);
                expect(e.errorCodes).toContain('NOT_AUTHENTICATED');
            }
        });

        it('getTokenFromCode posts JSON to the token URI', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.getTokenFromCode('the-code');
            const c = api._captured[0];
            expect(c.url).toBe('https://auth.monday.com/oauth2/token');
            expect(c.headers['Content-Type']).toBe('application/json');
            expect(c.body).toMatchObject({
                client_id: 'cid',
                client_secret: 'csecret',
                code: 'the-code',
            });
        });
    });

    describe('identity', () => {
        it('getMe issues the me query', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    data: {
                        me: {
                            id: '1',
                            name: 'Ada',
                            account: { id: '9', name: 'Acme' },
                        },
                    },
                };
            };
            const me = await api.getMe();
            expect(me.id).toBe('1');
            expect(lastBody(api).query).toMatch(/me\s*\{/);
        });

        it('getAccount issues the account query', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return { data: { account: { id: '9', name: 'Acme' } } };
            };
            const account = await api.getAccount();
            expect(account.id).toBe('9');
            expect(lastBody(api).query).toMatch(/account\s*\{/);
        });
    });

    describe('boards', () => {
        it('listBoards sends limit/page variables', async () => {
            const api = makeApi();
            await api.listBoards({ limit: 10, page: 2, state: 'active' });
            const body = lastBody(api);
            expect(body.query).toMatch(/boards\(/);
            expect(body.variables).toMatchObject({
                limit: 10,
                page: 2,
                state: 'active',
            });
        });

        it('getBoard queries by ids and returns the first board', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    data: {
                        boards: [{ id: '123', name: 'Roadmap' }],
                    },
                };
            };
            const board = await api.getBoard(123);
            expect(board.name).toBe('Roadmap');
            expect(lastBody(api).variables.ids).toEqual(['123']);
        });

        it('createBoard maps board_name and board_kind', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    data: {
                        create_board: { id: '1', name: 'New', board_kind: 'public' },
                    },
                };
            };
            const board = await api.createBoard({
                board_name: 'New',
                board_kind: 'public',
            });
            expect(board.id).toBe('1');
            expect(lastBody(api).variables).toMatchObject({
                boardName: 'New',
                boardKind: 'public',
            });
        });
    });

    describe('columns', () => {
        it('createColumn stringifies defaults objects', async () => {
            const api = makeApi();
            await api.createColumn({
                board_id: 1,
                title: 'Status',
                column_type: 'status',
                defaults: { labels: { 0: 'Done' } },
            });
            const vars = lastBody(api).variables;
            expect(vars.boardId).toBe('1');
            expect(vars.columnType).toBe('status');
            expect(vars.defaults).toBe(
                JSON.stringify({ labels: { 0: 'Done' } })
            );
        });

        it('listColumns reads boards.ids columns', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    data: {
                        boards: [
                            {
                                columns: [{ id: 'status', title: 'Status', type: 'status' }],
                            },
                        ],
                    },
                };
            };
            const cols = await api.listColumns(99);
            expect(cols).toHaveLength(1);
            expect(lastBody(api).variables.ids).toEqual(['99']);
        });
    });

    describe('items', () => {
        it('listItems queries by ids', async () => {
            const api = makeApi();
            await api.listItems({ ids: [1, 2], limit: 50 });
            expect(lastBody(api).variables).toEqual({
                ids: ['1', '2'],
                limit: 50,
            });
        });

        it('listBoardItems uses items_page under boards', async () => {
            const api = makeApi();
            await api.listBoardItems({ board_id: 5, limit: 10, cursor: 'abc' });
            const body = lastBody(api);
            expect(body.query).toMatch(/items_page/);
            expect(body.variables).toMatchObject({
                ids: ['5'],
                limit: 10,
                cursor: 'abc',
            });
        });

        it('createItem stringifies column_values objects', async () => {
            const api = makeApi();
            await api.createItem({
                board_id: 1,
                item_name: 'Task',
                column_values: { status: { label: 'Done' } },
            });
            expect(lastBody(api).variables.columnValues).toBe(
                JSON.stringify({ status: { label: 'Done' } })
            );
        });

        it('changeMultipleColumnValues posts the mutation', async () => {
            const api = makeApi();
            await api.changeMultipleColumnValues({
                board_id: 1,
                item_id: 2,
                column_values: '{"status":"Done"}',
            });
            const vars = lastBody(api).variables;
            expect(vars.boardId).toBe('1');
            expect(vars.itemId).toBe('2');
            expect(vars.columnValues).toBe('{"status":"Done"}');
            expect(lastBody(api).query).toMatch(/change_multiple_column_values/);
        });

        it('deleteItem posts delete_item', async () => {
            const api = makeApi();
            await api.deleteItem(42);
            expect(lastBody(api).variables).toEqual({ itemId: '42' });
            expect(lastBody(api).query).toMatch(/delete_item/);
        });

        it('nextItemsPage continues a cursor', async () => {
            const api = makeApi();
            await api.nextItemsPage({ cursor: 'c1', limit: 50 });
            expect(lastBody(api).query).toMatch(/next_items_page/);
            expect(lastBody(api).variables).toEqual({ cursor: 'c1', limit: 50 });
        });

        it('findItemsByColumnValues queries items_page_by_column_values', async () => {
            const api = makeApi();
            await api.findItemsByColumnValues({
                board_id: 9,
                columns: [{ column_id: 'phone', column_values: ['+15551212'] }],
                limit: 10,
            });
            expect(lastBody(api).query).toMatch(/items_page_by_column_values/);
            expect(lastBody(api).variables.boardId).toBe('9');
        });
    });

    describe('CRM Emails & Activities', () => {
        it('listCustomActivities queries custom_activity', async () => {
            const api = makeApi();
            await api.listCustomActivities();
            expect(lastBody(api).query).toMatch(/custom_activity/);
        });

        it('createCustomActivity posts the mutation', async () => {
            const api = makeApi();
            await api.createCustomActivity({
                name: 'Call',
                icon_id: 'HEADPHONES',
                color: 'SLATE_BLUE',
            });
            expect(lastBody(api).query).toMatch(/create_custom_activity/);
            expect(lastBody(api).variables).toMatchObject({
                name: 'Call',
                iconId: 'HEADPHONES',
                color: 'SLATE_BLUE',
            });
        });

        it('createTimelineItem selects id only', async () => {
            const api = makeApi();
            await api.createTimelineItem({
                item_id: 1,
                custom_activity_id: 'act-1',
                title: 'Note',
                timestamp: '2026-01-01T00:00:00Z',
                content: 'hi',
            });
            const q = lastBody(api).query;
            expect(q).toMatch(/create_timeline_item/);
            expect(q).toMatch(/\{\s*id\s*\}/);
            expect(q).not.toMatch(/created_at/);
        });

        it('deleteTimelineItem posts delete_timeline_item', async () => {
            const api = makeApi();
            await api.deleteTimelineItem({ id: 'tl-1' });
            expect(lastBody(api).variables).toEqual({ id: 'tl-1' });
        });
    });

    describe('webhooks', () => {
        it('listWebhooks queries by board_id', async () => {
            const api = makeApi();
            await api.listWebhooks({ board_id: 7, app_webhooks_only: true });
            expect(lastBody(api).variables).toEqual({
                boardId: '7',
                appWebhooksOnly: true,
            });
        });

        it('createWebhook sends event and url', async () => {
            const api = makeApi();
            await api.createWebhook({
                board_id: 7,
                url: 'https://hook.example.com',
                event: 'create_item',
                config: { columnId: 'status' },
            });
            const vars = lastBody(api).variables;
            expect(vars.url).toBe('https://hook.example.com');
            expect(vars.event).toBe('create_item');
            expect(vars.config).toBe(JSON.stringify({ columnId: 'status' }));
        });

        it('deleteWebhook posts delete_webhook', async () => {
            const api = makeApi();
            await api.deleteWebhook(12);
            expect(lastBody(api).variables).toEqual({ id: '12' });
        });
    });

    describe('verifyWebhookSignature', () => {
        function sign(payload, secret) {
            const header = Buffer.from(
                JSON.stringify({ alg: 'HS256', typ: 'JWT' })
            ).toString('base64url');
            const body = Buffer.from(
                JSON.stringify({
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    ...payload,
                })
            ).toString('base64url');
            const data = `${header}.${body}`;
            const sig = crypto
                .createHmac('sha256', secret)
                .update(data)
                .digest('base64url');
            return `${data}.${sig}`;
        }

        it('accepts a valid HS256 JWT', () => {
            const secret = 'signing-secret';
            const token = sign({ boardId: 1 }, secret);
            const result = verifyHs256Jwt(token, [
                { name: 'signing_secret', value: secret },
            ]);
            expect(result.ok).toBe(true);
            expect(result.claims.boardId).toBe(1);
        });

        it('rejects a bad signature', () => {
            const token = sign({ boardId: 1 }, 'right');
            const result = verifyHs256Jwt(token, [
                { name: 'signing_secret', value: 'wrong' },
            ]);
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('signature');
        });

        it('rejects alg none', () => {
            const header = Buffer.from(
                JSON.stringify({ alg: 'none', typ: 'JWT' })
            ).toString('base64url');
            const body = Buffer.from(
                JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })
            ).toString('base64url');
            const result = verifyHs256Jwt(`${header}.${body}.`, [
                { name: 'signing_secret', value: 'sec' },
            ]);
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('alg');
        });

        it('Api.verifyWebhookSignature reads Authorization header', () => {
            const secret = 's';
            const token = sign({ a: 1 }, secret);
            const api = new Api({ signingSecret: secret });
            const result = api.verifyWebhookSignature({
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(result.valid).toBe(true);
        });
    });
});
