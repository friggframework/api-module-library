const { Requester, get } = require('@friggframework/core');

class Api extends Requester {
    constructor(params) {
        super(params);
        this.apiKey = get(params, 'api_key', process.env.BAMBOOHR_API_KEY);
        this.subdomain = get(params, 'subdomain', process.env.BAMBOOHR_SUBDOMAIN);
        this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${this.subdomain}/v1`;
        
        this.URLs = {
            // Employee Management
            employees: '/employees/directory',
            employeeById: (employeeId) => `/employees/${employeeId}`,
            employeeFields: '/meta/fields',
            
            // Time Off
            timeOffRequests: '/time_off/requests',
            timeOffRequestById: (requestId) => `/time_off/requests/${requestId}`,
            timeOffPolicies: '/meta/time_off/policies',
            timeOffBalance: (employeeId) => `/employees/${employeeId}/time_off/calculator`,
            
            // Reports
            reports: '/reports',
            reportById: (reportId) => `/reports/${reportId}`,
            customReport: '/reports/custom',
            
            // Company
            companyInfo: '/meta/users',
            departments: '/meta/lists/department',
            divisions: '/meta/lists/division',
            locations: '/meta/lists/location',
            
            // Files
            employeeFiles: (employeeId) => `/employees/${employeeId}/files`,
            fileById: (employeeId, fileId) => `/employees/${employeeId}/files/${fileId}`,
            
            // Benefits
            benefits: '/benefits',
            benefitPlansByEmployee: (employeeId) => `/employees/${employeeId}/benefits`
        };
    }
    
    addAuthHeaders(options) {
        // BambooHR uses Basic Auth with API key as username and 'x' as password
        const credentials = Buffer.from(`${this.apiKey}:x`).toString('base64');
        const authHeaders = {
            'Authorization': `Basic ${credentials}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }
    
    async _get(options) {
        this.addAuthHeaders(options);
        return super._get(options);
    }
    
    async _post(options, stringify = true) {
        this.addAuthHeaders(options);
        return super._post(options, stringify);
    }
    
    async _put(options, stringify = true) {
        this.addAuthHeaders(options);
        return super._put(options, stringify);
    }
    
    async _delete(options) {
        this.addAuthHeaders(options);
        return super._delete(options);
    }
    
    // **************************   Employees   **********************************
    
    async listEmployees() {
        const options = {
            url: this.baseUrl + this.URLs.employees,
        };
        return this._get(options);
    }
    
    async getEmployeeById(employeeId, fields = null) {
        let url = this.baseUrl + this.URLs.employeeById(employeeId);
        
        const options = {
            url: url,
        };
        
        if (fields && fields.length > 0) {
            options.query = { fields: fields.join(',') };
        }
        
        return this._get(options);
    }
    
    async updateEmployee(employeeId, employeeData) {
        const options = {
            url: this.baseUrl + this.URLs.employeeById(employeeId),
            body: employeeData,
        };
        return this._post(options);
    }
    
    async getEmployeeFields() {
        const options = {
            url: this.baseUrl + this.URLs.employeeFields,
        };
        return this._get(options);
    }
    
    // **************************   Time Off   **********************************
    
    async listTimeOffRequests(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.timeOffRequests,
            query: params
        };
        return this._get(options);
    }
    
    async createTimeOffRequest(requestData) {
        const options = {
            url: this.baseUrl + this.URLs.timeOffRequests,
            body: requestData,
        };
        return this._post(options);
    }
    
    async updateTimeOffRequest(requestId, requestData) {
        const options = {
            url: this.baseUrl + this.URLs.timeOffRequestById(requestId),
            body: requestData,
        };
        return this._put(options);
    }
    
    async getTimeOffPolicies() {
        const options = {
            url: this.baseUrl + this.URLs.timeOffPolicies,
        };
        return this._get(options);
    }
    
    async getTimeOffBalance(employeeId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.timeOffBalance(employeeId),
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Reports   **********************************
    
    async listReports() {
        const options = {
            url: this.baseUrl + this.URLs.reports,
        };
        return this._get(options);
    }
    
    async getReport(reportId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.reportById(reportId),
            query: params
        };
        return this._get(options);
    }
    
    async generateCustomReport(reportData) {
        const options = {
            url: this.baseUrl + this.URLs.customReport,
            body: reportData,
        };
        return this._post(options);
    }
    
    // **************************   Company Info   **********************************
    
    async getCompanyInfo() {
        const options = {
            url: this.baseUrl + this.URLs.companyInfo,
        };
        return this._get(options);
    }
    
    async getDepartments() {
        const options = {
            url: this.baseUrl + this.URLs.departments,
        };
        return this._get(options);
    }
    
    async getDivisions() {
        const options = {
            url: this.baseUrl + this.URLs.divisions,
        };
        return this._get(options);
    }
    
    async getLocations() {
        const options = {
            url: this.baseUrl + this.URLs.locations,
        };
        return this._get(options);
    }
    
    // **************************   Files   **********************************
    
    async getEmployeeFiles(employeeId) {
        const options = {
            url: this.baseUrl + this.URLs.employeeFiles(employeeId),
        };
        return this._get(options);
    }
    
    async getEmployeeFile(employeeId, fileId) {
        const options = {
            url: this.baseUrl + this.URLs.fileById(employeeId, fileId),
        };
        return this._get(options);
    }
}

module.exports = { Api };
