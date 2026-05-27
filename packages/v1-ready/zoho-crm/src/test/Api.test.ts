import { describe, it, beforeAll, expect } from 'vitest';
import {Authenticator} from '@friggframework/test';
import {Api} from '../api';
import {FetchError} from '@friggframework/core';
import * as config from '../defaultConfig.json';

const api = new Api({
    client_id: process.env.ZOHO_CRM_CLIENT_ID,
    client_secret: process.env.ZOHO_CRM_CLIENT_SECRET,
    scope: process.env.ZOHO_CRM_SCOPE,
    redirect_uri: `${process.env.REDIRECT_URI}/zohoCrm`,
});

beforeAll(async () => {
    const url = api.getAuthUri();
    const response = await Authenticator.oauth2(url);
    const baseArr = response.base.split('/');
    response.entityType = baseArr[baseArr.length - 1];
    delete response.base;
    await api.getTokenFromCode(response.data.code);
});

describe(`${config.label} API tests`, () => {
    let existingRoleId: string;
    describe('Test Role resource', () => {
        it('should list all Roles', async () => {
            const response = await api.listRoles();
            expect(response).toHaveProperty('roles');
            expect(response.roles).toBeInstanceOf(Array);
            existingRoleId = response.roles[0].id;
        });

        let newRoleId: string;
        it('should create a new Role', async () => {
            const response = await api.createRole({
                roles: [
                    {'name': 'Test Role 1000', 'description': 'Just testing stuff'}
                ]
            });
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].code).toBe('SUCCESS');
            expect(response.roles[0].message).toBe('Role added');
            newRoleId = response.roles[0].details.id;
        });

        it('should get the newly created Role by ID', async () => {
            const response = await api.getRole(newRoleId);
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].id).toBe(newRoleId);
            expect(response.roles[0].name).toBe('Test Role 1000');
            expect(response.roles[0].description).toBe('Just testing stuff');
        });

        let updatedName = 'Foo';
        let updatedDescription = 'Bar';
        it('should update the newly created Role by ID', async () => {
            const response = await api.updateRole(
                newRoleId,
                {roles: [{'name': updatedName, 'description': updatedDescription}]},
            );
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].code).toBe('SUCCESS');
            expect(response.roles[0].message).toBe('Role updated');
        });

        it('should receive the updated values when getting the newly created User by ID', async () => {
            const response = await api.getRole(newRoleId);
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].id).toBe(newRoleId);
            expect(response.roles[0].name).toBe(updatedName);
            expect(response.roles[0].description).toBe(updatedDescription);
        });

        it('should delete the newly created Role by ID', async () => {
            const response = await api.deleteRole(
                newRoleId,
                {'transfer_to_id': existingRoleId}
            );
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].code).toBe('SUCCESS');
            expect(response.roles[0].message).toBe('Role Deleted');
        });

        it('should throw error when trying to create with empty params', async () => {
            await expect(api.createRole()).rejects.toThrow('Request body is required');
        });
    });

    describe('Test User resource', () => {
        it('should list all Users', async () => {
            const response = await api.listUsers();
            expect(response).toHaveProperty('users');
            expect(response.users).toBeInstanceOf(Array);
        });

        let newUserId: string;
        it('should create a new User', async () => {
            const rolesResponse = await api.listRoles();
            const role = rolesResponse.roles[0];
            const profilesResponse = await api.listProfiles();
            const profile = profilesResponse.profiles[0];

            const response = await api.createUser({
                users: [{
                    first_name: 'Test User 1000',
                    email: 'test@friggframework.org',
                    role: role.id,
                    profile: profile.id,
                }]
            });

            expect(response).toHaveProperty('users');
            expect(response.users[0].code).toBe('SUCCESS');
            expect(response.users[0].message).toBe('User added');
            newUserId = response.users[0].details.id;
        });

        it('should get the newly created User by ID', async () => {
            const response = await api.getUser(newUserId);
            expect(response).toHaveProperty('users');
            expect(response.users[0].id).toBe(newUserId);
            expect(response.users[0].first_name).toBe('Test User 1000');
            expect(response.users[0].email).toBe('test@friggframework.org');
        });

        let updatedFirstName = 'Elon';
        let updatedEmail = 'musk@friggframework.com';
        it('should update the newly created User by ID', async () => {
            const response = await api.updateUser(
                newUserId,
                {users: [{'first_name': updatedFirstName, 'email': updatedEmail}]},
            );
            expect(response).toHaveProperty('users');
            expect(response.users[0].code).toBe('SUCCESS');
            expect(response.users[0].message).toBe('User updated');
        });

        it('should receive the updated values when getting the newly created User by ID', async () => {
            const response = await api.getUser(newUserId);
            expect(response).toHaveProperty('users');
            expect(response.users[0].id).toBe(newUserId);
            expect(response.users[0].first_name).toBe(updatedFirstName);
            expect(response.users[0].email).toBe(updatedEmail);
        });

        it('should delete the newly created User by ID', async () => {
            const response = await api.deleteUser(newUserId);
            expect(response).toHaveProperty('users');
            expect(response.users[0].code).toBe('SUCCESS');
            expect(response.users[0].message).toBe('User deleted');
        });

        it('should throw error when trying to create with empty params', async () => {
            await expect(api.createUser()).rejects.toThrow('Request body is required');
        });
    });

    describe('Test Profile resource', () => {
        it('should list all Profiles', async () => {
            const response = await api.listProfiles();
            expect(response).toHaveProperty('profiles');
            expect(response.profiles).toBeInstanceOf(Array);
        });

        it.skip('should create a new Profile', async () => {
            // TODO
        });

        it.skip('should get the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should update the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should receive the updated values when getting the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should delete the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should throw error when trying to create with empty params', () => {
            // TODO
        });
    });

    describe('Test Contact resource', () => {
        let contactId: string;

        it('should list all Contacts', async () => {
            const response = await api.listContacts();
            expect(response).toHaveProperty('data');
            expect(response.data).toBeInstanceOf(Array);
            if (response.data.length > 0) {
                contactId = response.data[0].id;
            }
        });

        it('should list Contacts with query params', async () => {
            const response = await api.listContacts({
                fields: 'Last_Name,First_Name,Email',
                per_page: 5,
                page: 1
            });
            expect(response).toHaveProperty('data');
            expect(response).toHaveProperty('info');
            expect(response.info.per_page).toBeLessThanOrEqual(5);
        });

        it('should get a Contact by ID', async () => {
            if (!contactId) {
                console.log('Skipping: No contact ID available from list');
                return;
            }
            const response = await api.getContact(contactId);
            expect(response).toHaveProperty('data');
            expect(response.data).toBeInstanceOf(Array);
            expect(response.data[0].id).toBe(contactId);
        });

        it('should search Contacts by email', async () => {
            const listResponse = await api.listContacts({ per_page: 1 });
            if (!listResponse.data || listResponse.data.length === 0) {
                console.log('Skipping: No contacts available to search');
                return;
            }
            const email = listResponse.data[0].Email;
            if (!email) {
                console.log('Skipping: Contact has no email');
                return;
            }

            const response = await api.searchContacts({ email });
            expect(response).toHaveProperty('data');
        });

        it('should search Contacts by criteria', async () => {
            const response = await api.searchContacts({
                criteria: '(Last_Name:starts_with:A)',
                fields: 'Last_Name,First_Name,Email',
                per_page: 10
            });
            expect(response).toHaveProperty('data');
            if (response.data && response.data.length > 0) {
                expect(response.data[0]).toHaveProperty('Last_Name');
            }
        });

        it('should throw error when contactId is missing', async () => {
            await expect(api.getContact('')).rejects.toThrow('contactId is required');
        });

        it('should throw error when search params are missing', async () => {
            await expect(api.searchContacts({})).rejects.toThrow('At least one search parameter is required');
        });
    });

});
