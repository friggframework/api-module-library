const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.fathom.ai/external/v1';
        
        this.URLs = {
            meetings: '/meetings',
            teams: '/teams',
            teamMembers: '/team-members',
        };
        
        this.apiKey = get(params, 'apiKey', null);
        this.access_token = this.apiKey;
    }

    async _request(url, options = {}, i = 0) {
        options.headers = options.headers || {};
        options.headers['X-Api-Key'] = this.apiKey;
        options.headers['Content-Type'] = 'application/json';
        
        return super._request(url, options, i);
    }

    async listMeetings(params = {}) {
        const queryParams = new URLSearchParams();
        
        if (params.recorded_by && Array.isArray(params.recorded_by)) {
            params.recorded_by.forEach(email => queryParams.append('recorded_by[]', email));
        }
        
        if (params.teams && Array.isArray(params.teams)) {
            params.teams.forEach(team => queryParams.append('teams[]', team));
        }
        
        if (params.calendar_invitees && Array.isArray(params.calendar_invitees)) {
            params.calendar_invitees.forEach(email => queryParams.append('calendar_invitees[]', email));
        }
        
        if (params.created_after) {
            queryParams.append('created_after', params.created_after);
        }
        
        if (params.meeting_type) {
            queryParams.append('meeting_type', params.meeting_type);
        }
        
        if (params.include_transcript !== undefined) {
            queryParams.append('include_transcript', params.include_transcript);
        }
        
        if (params.cursor) {
            queryParams.append('cursor', params.cursor);
        }
        
        const query = queryParams.toString();
        const url = query ? `${this.URLs.meetings}?${query}` : this.URLs.meetings;
        
        return this._get(url);
    }

    async listTeams() {
        return this._get(this.URLs.teams);
    }

    async listTeamMembers() {
        return this._get(this.URLs.teamMembers);
    }

    async *iterateMeetings(params = {}) {
        let cursor = null;
        do {
            const response = await this.listMeetings({ ...params, cursor });
            
            if (response.data && Array.isArray(response.data)) {
                for (const meeting of response.data) {
                    yield meeting;
                }
            }
            
            cursor = response.next_cursor || null;
        } while (cursor);
    }
}

module.exports = { Api };