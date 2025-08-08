# Vonage API Module

A comprehensive Vonage (formerly Nexmo) API module for the Frigg framework, providing voice calls, SMS messaging, number management, and verification services.

## Features

- **SMS Messaging**: Send SMS, Unicode, and binary messages
- **Voice Calls**: Make and manage voice calls with NCCO support
- **Number Management**: Search, buy, and manage phone numbers
- **Verify API**: Two-factor authentication and phone verification
- **Number Insight**: Get detailed information about phone numbers
- **Account Management**: Balance, pricing, and account settings
- **Messages v2**: Advanced messaging with WhatsApp, Viber, Facebook Messenger
- **Webhooks**: Handle inbound messages and delivery receipts
- **Call Control**: Real-time call manipulation (mute, transfer, etc.)

## Installation

```bash
npm install @friggframework/api-module-vonage
```

## Environment Variables

```env
VONAGE_API_KEY=your_api_key
VONAGE_API_SECRET=your_api_secret
VONAGE_APPLICATION_ID=your_application_id
VONAGE_PRIVATE_KEY=your_private_key_path_or_content
VONAGE_SIGNATURE_SECRET=your_signature_secret
```

## Usage

```javascript
const { Api } = require('@friggframework/api-module-vonage');

const vonageApi = new Api({
    api_key: process.env.VONAGE_API_KEY,
    api_secret: process.env.VONAGE_API_SECRET,
    application_id: process.env.VONAGE_APPLICATION_ID,
    private_key: process.env.VONAGE_PRIVATE_KEY
});

// Send SMS
await vonageApi.sendSMS('ACME Corp', '1234567890', 'Hello from Vonage!');

// Make a voice call
await vonageApi.makeCall(
    '1234567890',
    '0987654321',
    'https://your-domain.com/webhooks/answer'
);

// Send verification code
const verification = await vonageApi.sendVerification('1234567890', 'YourApp');
console.log('Request ID:', verification.request_id);

// Check verification code
const result = await vonageApi.checkVerification(verification.request_id, '123456');

// Get number insights
const insights = await vonageApi.getAdvancedNumberInsight('1234567890');
```

## Key Methods

### SMS Messaging
- `sendSMS(from, to, text, options)` - Send SMS message
- `sendUnicodeSMS(from, to, text, options)` - Send Unicode SMS
- `sendBinarySMS(from, to, body, udh, options)` - Send binary SMS

### Voice Calls
- `makeCall(from, to, answerUrl, options)` - Initiate voice call
- `getCalls(options)` - Get call history
- `getCall(callId)` - Get specific call details
- `updateCall(callId, action)` - Update call in progress
- `hangupCall(callId)` - End call
- `muteCall(callId)` - Mute call
- `unmuteCall(callId)` - Unmute call
- `transferCall(callId, destination)` - Transfer call

### Verify API
- `sendVerification(number, brand, options)` - Start verification
- `checkVerification(requestId, code)` - Verify code
- `cancelVerification(requestId)` - Cancel verification
- `searchVerification(requestId)` - Check verification status

### Number Insight
- `getBasicNumberInsight(number, options)` - Basic number info
- `getStandardNumberInsight(number, options)` - Standard number info
- `getAdvancedNumberInsight(number, callback, options)` - Advanced number info
- `getNumberInsight(number, features, options)` - Custom features

### Number Management
- `searchNumbers(country, options)` - Search available numbers
- `getOwnNumbers(options)` - Get your numbers
- `buyNumber(country, msisdn, options)` - Purchase number
- `cancelNumber(country, msisdn, options)` - Release number
- `updateNumber(country, msisdn, options)` - Update number settings

### Account Management
- `getBalance()` - Get account balance
- `getPricing(country, options)` - Get pricing info
- `getSMSPricing(country, options)` - Get SMS pricing
- `getVoicePricing(country, options)` - Get voice pricing
- `getAccountSettings()` - Get account settings
- `updateAccountSettings(params)` - Update account settings

### Messages v2 (Advanced Messaging)
- `sendTextMessage(from, to, text, options)` - Send text via Messages API
- `sendImageMessage(from, to, imageUrl, caption, options)` - Send image
- `sendFileMessage(from, to, fileUrl, caption, options)` - Send file
- `sendTemplateMessage(from, to, templateName, parameters, options)` - Send template

### Webhook Handling
- `handleWebhook(body, signature)` - Process webhook data
- `verifyWebhookSignature(body, signature)` - Verify webhook signature

## Authentication Methods

Vonage uses different authentication methods for different APIs:

### API Key & Secret
Used for SMS, Verify, Number Insight, and Number Management:
```javascript
// Automatically added to requests
{
    api_key: 'your_api_key',
    api_secret: 'your_api_secret'
}
```

### JWT (JSON Web Token)
Used for Voice API, Messages v2, and Conversations:
```javascript
// Automatically generated and added as Bearer token
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Voice Call Control

### Call Actions
Control calls in real-time:
```javascript
// During a call, you can:
await vonageApi.muteCall(callId);           // Mute the call
await vonageApi.unmuteCall(callId);         // Unmute the call
await vonageApi.earmuffCall(callId);        // Prevent caller from hearing
await vonageApi.unearmuffCall(callId);      // Restore caller hearing
await vonageApi.transferCall(callId, {      // Transfer to another number
    type: 'ncco',
    url: 'https://example.com/new-ncco'
});
```

### NCCO (Nexmo Call Control Object)
Define call behavior with NCCO:
```javascript
const ncco = [
    {
        action: 'talk',
        text: 'Please wait while we connect your call'
    },
    {
        action: 'connect',
        endpoint: [{
            type: 'phone',
            number: '1234567890'
        }]
    }
];
```

## Number Verification

Two-factor authentication flow:
```javascript
// 1. Start verification
const verification = await vonageApi.sendVerification('1234567890', 'YourApp', {
    length: 6,
    locale: 'en-us',
    pin_expiry: 300
});

// 2. User receives SMS with code
// 3. Verify the code
const result = await vonageApi.checkVerification(verification.request_id, userEnteredCode);

if (result.status === '0') {
    console.log('Verification successful!');
} else {
    console.log('Verification failed:', result.error_text);
}
```

## Webhook Events

Handle various webhook events:
- **Inbound SMS**: Receive SMS messages
- **Delivery Receipts**: SMS delivery status
- **Voice Events**: Call status updates
- **Verification**: Verification status updates

```javascript
app.post('/webhooks/vonage', async (req, res) => {
    const event = await vonageApi.handleWebhook(req.body, req.headers['authorization']);
    
    switch (event.type) {
        case 'inbound_message':
            console.log('Received SMS:', event.data.text);
            break;
        case 'voice':
            console.log('Call event:', event.data.status);
            break;
        case 'verify':
            console.log('Verification event:', event.data.status);
            break;
    }
    
    res.status(200).send('OK');
});
```

## Error Handling

Comprehensive error handling with Vonage API error codes and descriptions for debugging delivery and authentication issues.