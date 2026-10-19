import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';
import { Api } from '../src/api';

const makeApi = () =>
  new Api({ access_token: 'tok', companyDomain: 'https://acme.pipedrive.com' } as any);

describe('Pipedrive addPerson / updatePerson', () => {
  afterEach(() => nock.cleanAll());

  it('addPerson POSTs the body to /api/v2/persons', async () => {
    const body = {
      name: 'Ada Lovelace',
      owner_id: 7,
      org_id: 3,
      emails: [{ value: 'ada@example.com', primary: true, label: 'work' }],
      phones: [{ value: '+15551234', primary: true, label: 'mobile' }],
      visible_to: 3,
    };
    const scope = nock('https://acme.pipedrive.com')
      .post('/api/v2/persons', body)
      .reply(201, { success: true, data: { id: 42, name: 'Ada Lovelace' } });
    const res: any = await makeApi().addPerson(body);
    expect(scope.isDone()).toBe(true);
    expect(res.data.id).toBe(42);
  });

  it('updatePerson PATCHes only the given fields to /api/v2/persons/{id}', async () => {
    const scope = nock('https://acme.pipedrive.com')
      .patch('/api/v2/persons/42', { name: 'Ada King', org_id: 9 })
      .reply(200, { success: true, data: { id: 42 } });
    await makeApi().updatePerson(42, { name: 'Ada King', org_id: 9 });
    expect(scope.isDone()).toBe(true);
  });

  it('updatePerson accepts a string id', async () => {
    const scope = nock('https://acme.pipedrive.com')
      .patch('/api/v2/persons/42', { owner_id: 1 })
      .reply(200, { success: true, data: { id: 42 } });
    await makeApi().updatePerson('42', { owner_id: 1 });
    expect(scope.isDone()).toBe(true);
  });
});
