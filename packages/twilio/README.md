# Twilio API Module

A comprehensive Twilio API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_API_KEY=your_api_key
TWILIO_API_SECRET=your_api_secret
```

### Getting Twilio API Credentials

1. Sign up for a Twilio account at [https://www.twilio.com/](https://www.twilio.com/)
2. Go to the [Twilio Console](https://console.twilio.com/)
3. Your Account SID is displayed on the console dashboard
4. Navigate to Settings > API Keys & Tokens
5. Create a new API Key and copy the Key and Secret

### Authentication

This module uses HTTP Basic Authentication with your API Key as the username and API Secret as the password.

## Usage

```javascript
const { Api } = require('@friggframework/api-module-twilio');

// Initialize with credentials
const twilioApi = new Api({
    account_sid: process.env.TWILIO_ACCOUNT_SID,
    api_key: process.env.TWILIO_API_KEY,
    api_secret: process.env.TWILIO_API_SECRET
});

// Send an SMS
const message = await twilioApi.sendMessage(
    '+1234567890',     // to
    '+0987654321',     // from (your Twilio number)
    'Hello from Twilio!'
);

// Make a call
const call = await twilioApi.makeCall(
    '+1234567890',     // to
    '+0987654321',     // from (your Twilio number)
    'https://your-app.com/twiml'  // TwiML URL
);
```

## Available Methods

### Account Methods
- `getAccount()` - Get account information
- `updateAccount(params)` - Update account settings

### Messages Methods
- `getMessages(params)` - List messages with optional filters
- `getMessage(messageSid)` - Get specific message
- `sendMessage(to, from, body, params)` - Send SMS/MMS message
- `deleteMessage(messageSid)` - Delete a message

### Calls Methods
- `getCalls(params)` - List calls with optional filters
- `getCall(callSid)` - Get specific call
- `makeCall(to, from, url, params)` - Make a phone call
- `updateCall(callSid, params)` - Update call in progress
- `deleteCall(callSid)` - Delete call record

### Phone Numbers Methods
- `getIncomingPhoneNumbers(params)` - List your phone numbers
- `getIncomingPhoneNumber(phoneNumberSid)` - Get specific phone number
- `purchasePhoneNumber(phoneNumber, params)` - Purchase a phone number
- `updateIncomingPhoneNumber(phoneNumberSid, params)` - Update phone number settings
- `deleteIncomingPhoneNumber(phoneNumberSid)` - Release a phone number
- `getAvailablePhoneNumbers(countryCode, params)` - Search available numbers

### Applications Methods
- `getApplications(params)` - List applications
- `getApplication(applicationSid)` - Get specific application
- `createApplication(friendlyName, params)` - Create new application
- `updateApplication(applicationSid, params)` - Update application
- `deleteApplication(applicationSid)` - Delete application

### Conferences Methods
- `getConferences(params)` - List conferences
- `getConference(conferenceSid)` - Get specific conference
- `getConferenceParticipants(conferenceSid)` - List conference participants
- `getConferenceParticipant(conferenceSid, participantSid)` - Get specific participant
- `updateConferenceParticipant(conferenceSid, participantSid, params)` - Update participant
- `deleteConferenceParticipant(conferenceSid, participantSid)` - Remove participant

### Recordings Methods
- `getRecordings(params)` - List recordings
- `getRecording(recordingSid)` - Get specific recording
- `deleteRecording(recordingSid)` - Delete recording

### Usage Methods
- `getUsageRecords(params)` - Get usage records with filters
- `getUsageToday()` - Get today's usage
- `getUsageYesterday()` - Get yesterday's usage
- `getUsageThisMonth()` - Get current month's usage
- `getUsageLastMonth()` - Get last month's usage

## Error Handling

Twilio returns detailed error information in responses. Always wrap API calls in try-catch blocks:

```javascript
try {
    const message = await twilioApi.sendMessage(to, from, body);
    console.log('Message sent:', message.sid);
} catch (error) {
    console.error('Error sending message:', error.message);
}
```

## Rate Limiting

Twilio enforces rate limits on API requests. The module does not implement automatic retry logic - you should handle rate limiting in your application.

## Webhooks

Twilio can send webhooks to your application for various events. You'll need to configure webhook URLs in your Twilio Console or via the API.

## Documentation

For detailed Twilio API documentation, visit: https://www.twilio.com/docs/api