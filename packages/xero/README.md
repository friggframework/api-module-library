# Xero API Module

A comprehensive Node.js module for integrating with Xero's Accounting API, built for the Frigg Framework.

## Overview

This module provides seamless integration with Xero accounting software, supporting financial management, invoicing, contact management, and business operations. It handles OAuth2 authentication and provides methods for managing accounting data.

## Installation

```bash
npm install @friggframework/api-module-xero
```

## Configuration

### Environment Variables

```bash
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_SCOPE=openid profile email accounting.transactions accounting.contacts
REDIRECT_URI=your_redirect_uri_base
```

### Xero App Setup

1. Go to [Xero Developer Portal](https://developer.xero.com/myapps)
2. Create a new app
3. Configure redirect URI: `{REDIRECT_URI}/xero`
4. Set required scopes:
   - `openid profile email` - Basic identity
   - `accounting.transactions` - Transaction access
   - `accounting.contacts` - Contact management
   - `accounting.settings` - Organization settings

## Usage

### Basic Setup

```javascript
const { Api, Definition } = require('@friggframework/api-module-xero');

const api = new Api({
    client_id: process.env.XERO_CLIENT_ID,
    client_secret: process.env.XERO_CLIENT_SECRET,
    redirect_uri: `${process.env.REDIRECT_URI}/xero`,
    scope: 'openid profile email accounting.transactions accounting.contacts'
});
```

### Authentication Flow

```javascript
// 1. Get authorization URL
const authUrl = api.getAuthUri();

// 2. Handle callback
const tokens = await api.getTokenFromCode(authorizationCode);

// 3. Get tenant information and set tenant ID
const tenants = await api.getTenants();
api.tenantId = tenants[0].tenantId;

// 4. Get organization details
const org = await api.getOrganisation();
```

### Core Operations

```javascript
// Get contacts
const contacts = await api.getContacts();

// Create contact
const newContact = await api.createContact({
    Contacts: [{
        Name: 'John Doe',
        EmailAddress: 'john@example.com',
        ContactStatus: 'ACTIVE'
    }]
});

// Get invoices
const invoices = await api.getInvoices({
    where: 'Type="ACCREC"',
    order: 'Date DESC'
});

// Create invoice
const newInvoice = await api.createInvoice({
    Invoices: [{
        Type: 'ACCREC',
        Contact: { ContactID: 'contact_id' },
        Date: new Date().toISOString().split('T')[0],
        DueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        LineItems: [{
            Description: 'Consulting Services',
            Quantity: 1,
            UnitAmount: 100.00,
            AccountCode: '200'
        }]
    }]
});

// Get accounts
const accounts = await api.getAccounts();
```

## API Reference

### Core Methods

#### Authentication & Organization
- `getTenants()` - Get authorized organizations
- `getOrganisation()` - Get organization details

#### Contacts
- `getContacts(params)` - Get contacts
- `createContact(contactData)` - Create new contact

#### Invoices
- `getInvoices(params)` - Get invoices
- `createInvoice(invoiceData)` - Create new invoice

#### Accounts
- `getAccounts(params)` - Get chart of accounts

## Resources

- [Xero API Documentation](https://developer.xero.com/documentation/)
- [Xero OAuth2 Guide](https://developer.xero.com/documentation/guides/oauth2/overview)

## License

MIT License - see LICENSE file for details.