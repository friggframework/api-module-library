import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { Api } from '../src/api';

// Type for the mockApi utility - adjust path as needed
// @ts-ignore - mockApi may not have TypeScript types
const { mockApi } = require('../../../../test/utils/mockApi');

const MockedApi = mockApi(Api, {
    authenticationMode: 'browser',
    filteringScope: (url: string) => {
        return /^https:[/][/].+[.]pipedrive[.]com/.test(url);
    },
});

describe('Pipedrive API class', () => {
    let api: Api;

    beforeAll(async () => {
        await MockedApi.initialize({ test: {} });
        api = await MockedApi.mock();
    });

    afterAll(async () => {
        await MockedApi.clean({ test: {} });
    });

    describe('User', () => {
        it('should list user profile', async () => {
            const response = await api.getUser();
            const expectedKeys = [
                'id',
                'name',
                'company_country',
                'company_domain',
                'company_id',
                'company_name',
                'default_currency',
                'locale',
                'lang',
                'last_login',
                'language',
                'email',
                'phone',
                'created',
                'modified',
                'signup_flow_variation',
                'has_created_company',
                'is_admin',
                'active_flag',
                'timezone_name',
                'timezone_offset',
                'role_id',
                'icon_url',
                'is_you',
            ];

            expect(Object.keys(response.data)).toEqual(expect.arrayContaining(expectedKeys));
            expect(expectedKeys.every(key => key in response.data)).toBe(true);
        });
    });

    describe('Deals', () => {
        it('should list deals', async () => {
            const response = await api.listDeals();
            expect(response.data.length).toBeGreaterThan(0);
            expect(response.data[0]).toHaveProperty('id');
        });
    });

    describe('Activities', () => {
        const mockActivity: any = {};

        it('should list all Activity Fields', async () => {
            const response = await api.listActivityFields();
            const isRequired = response.data.filter(
                (field: any) => field.mandatory_flag
            );

            for (const field of isRequired) {
                mockActivity[field.key] = 'blah';
            }
        });

        it('should create an email activity', async () => {
            const activity = {
                subject: 'Example Activtiy from the local grave',
                type: 'email',
                due_date: new Date('2021-12-03T15:06:38.700Z').toISOString().split('T')[0],
                owner_id: 1811658,
            };
            const response = await api.createActivity(activity);
            expect(response.success).toBe(true);
        });

        it('should get activities', async () => {
            const response = await api.listActivities({
                user_id: 0, // Gets activities for all users, instead of just the auth'ed user
            });
            expect(response.data[0]).toHaveProperty('id');
            expect(response.data.length).toBeGreaterThan(0);
        });
    });

    describe('Users', () => {
        it('should get users', async () => {
            const response = await api.listUsers();
            expect(Array.isArray(response.data)).toBe(true);
            expect(response.data.length).toBeGreaterThan(0);

            const expectedKeys = [
                'active_flag',
                'created',
                'default_currency',
                'email',
                'has_created_company',
                'icon_url',
                'id',
                'is_admin',
                'is_you',
                'lang',
                'last_login',
                'locale',
                'modified',
                'name',
                'phone',
                'role_id',
                'signup_flow_variation',
                'timezone_name',
                'timezone_offset'
            ];

            expect(Object.keys(response.data[0])).toEqual(expect.arrayContaining(expectedKeys));
        });
    });

    describe('Bad Auth', () => {
        it('should refresh bad auth token', async () => {
            // Needed to paste a valid JWT, otherwise it's testing the wrong error.
            const badAccessToken =
                'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZWFuLm1hdHRoZXdzQGxlZnRob29rLmNvbSIsImlhdCI6MTYzNTUzMDk3OCwiZXhwIjoxNjM1NTM4MTc4LCJiZW50byI6ImFwcDFlIiwiYWN0Ijp7InN1YiI6IlZob0NzMFNRZ25Fa2RDanRkaFZLemV5bXBjNW9valZoRXB2am03Rjh1UVEiLCJuYW1lIjoiTGVmdCBIb29rIiwiaXNzIjoiZmxhZ3NoaXAiLCJ0eXBlIjoiYXBwIn0sIm9yZ191c2VyX2lkIjoxLCJhdWQiOiJMZWZ0IEhvb2siLCJzY29wZXMiOiJBSkFBOEFIUUFCQUJRQT09Iiwib3JnX2d1aWQiOiJmNzY3MDEzZC1mNTBiLTRlY2QtYjM1My0zNWU0MWQ5Y2RjNGIiLCJvcmdfc2hvcnRuYW1lIjoibGVmdGhvb2tzYW5kYm94In0.XFmIai0GpAePsYeA4MjRntZS3iW6effmKmIhT7SBzTQ';
            (api as any).access_token = badAccessToken;

            await api.listDeals();
            expect((api as any).access_token).not.toBe(badAccessToken);
        });

        it('should throw error with invalid refresh token', async () => {
            (api as any).access_token =
                'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZWFuLm1hdHRoZXdzQGxlZnRob29rLmNvbSIsImlhdCI6MTYzNTUzMDk3OCwiZXhwIjoxNjM1NTM4MTc4LCJiZW50byI6ImFwcDFlIiwiYWN0Ijp7InN1YiI6IlZob0NzMFNRZ25Fa2RDanRkaFZLemV5bXBjNW9valZoRXB2am03Rjh1UVEiLCJuYW1lIjoiTGVmdCBIb29rIiwiaXNzIjoiZmxhZ3NoaXAiLCJ0eXBlIjoiYXBwIn0sIm9yZ191c2VyX2lkIjoxLCJhdWQiOiJMZWZ0IEhvb2siLCJzY29wZXMiOiJBSkFBOEFIUUFCQUJRQT09Iiwib3JnX2d1aWQiOiJmNzY3MDEzZC1mNTBiLTRlY2QtYjM1My0zNWU0MWQ5Y2RjNGIiLCJvcmdfc2hvcnRuYW1lIjoibGVmdGhvb2tzYW5kYm94In0.XFmIai0GpAePsYeA4MjRntZS3iW6effmKmIhT7SBzTQ';
            (api as any).refresh_token = 'nolongervalid';

            await expect(async () => {
                await api.listDeals();
            }).rejects.toThrow(/An error ocurred while fetching an external resource/);
        });
    });
});
