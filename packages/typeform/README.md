# Typeform API Module

A comprehensive Typeform API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
TYPEFORM_CLIENT_ID=your_typeform_client_id
TYPEFORM_CLIENT_SECRET=your_typeform_client_secret
TYPEFORM_SCOPE=forms:read forms:write responses:read accounts:read workspaces:read
REDIRECT_URI=your_redirect_uri_base
```

### Getting Typeform API Credentials

1. Go to the [Typeform Developer Portal](https://developer.typeform.com/)
2. Sign in with your Typeform account
3. Create a new app in your developer account
4. Get your Client ID and Client Secret
5. Set up your redirect URI (e.g., `https://yourdomain.com/typeform`)

### OAuth2 Scopes

Available scopes for Typeform API:
- `accounts:read` - Read account information
- `forms:read` - Read forms and their structure
- `forms:write` - Create and modify forms
- `images:read` - Read images
- `images:write` - Upload and manage images
- `themes:read` - Read themes
- `themes:write` - Create and modify themes
- `responses:read` - Read form responses
- `webhooks:read` - Read webhook configurations
- `webhooks:write` - Create and manage webhooks
- `workspaces:read` - Read workspace information
- `workspaces:write` - Create and manage workspaces

## Usage

```javascript
const { Api } = require('@friggframework/api-module-typeform');

// Initialize with credentials
const typeformApi = new Api({
    client_id: process.env.TYPEFORM_CLIENT_ID,
    client_secret: process.env.TYPEFORM_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/typeform',
    scope: 'forms:read forms:write responses:read accounts:read workspaces:read'
});

// Get authorization URL
const authUrl = typeformApi.getAuthUri();

// Exchange code for tokens
const tokens = await typeformApi.getTokenFromCode(authorizationCode);

// Get user information
const me = await typeformApi.getMe();

// Get all forms
const forms = await typeformApi.getForms();

// Get responses for a form
const responses = await typeformApi.getFormResponses('form-id');
```

## Available Methods

### User/Account Methods
- `getMe()` - Get current user account information

### Forms Methods
- `getForms(params)` - List forms with pagination and filters
- `createForm(formData)` - Create new form
- `getForm(formId)` - Get specific form
- `updateForm(formId, formData)` - Update form
- `deleteForm(formId)` - Delete form
- `duplicateForm(formId, targetWorkspaceHref)` - Duplicate form
- `createSimpleForm(title, fields, workspaceHref)` - Helper for simple forms
- `searchForms(searchTerm, workspaceId)` - Search forms by title

### Form Messages Methods
- `getFormMessages(formId)` - Get form custom messages
- `updateFormMessages(formId, messagesData)` - Update form messages

### Responses Methods
- `getFormResponses(formId, params)` - Get form responses
- `deleteFormResponses(formId, responseIds)` - Delete specific responses
- `getFormResponsesSince(formId, since)` - Get responses since timestamp
- `getFormResponsesWithAnswers(formId, params)` - Get completed responses
- `extractAnswers(response)` - Helper to extract answer values

### Images Methods
- `getImages()` - List uploaded images
- `uploadImage(imageData)` - Upload new image
- `getImage(imageId)` - Get specific image
- `deleteImage(imageId)` - Delete image

### Themes Methods
- `getThemes(params)` - List themes
- `createTheme(themeData)` - Create custom theme
- `getTheme(themeId)` - Get specific theme
- `updateTheme(themeId, themeData)` - Update theme
- `deleteTheme(themeId)` - Delete theme

### Workspaces Methods
- `getWorkspaces(params)` - List workspaces
- `createWorkspace(workspaceData)` - Create new workspace
- `getWorkspace(workspaceId)` - Get specific workspace
- `updateWorkspace(workspaceId, workspaceData)` - Update workspace
- `deleteWorkspace(workspaceId)` - Delete workspace
- `getWorkspaceForms(workspaceId, params)` - Get forms in workspace

### Webhooks Methods
- `getFormWebhooks(formId)` - List webhooks for form
- `createFormWebhook(formId, webhookData)` - Create webhook
- `getFormWebhook(formId, webhookTag)` - Get specific webhook
- `updateFormWebhook(formId, webhookTag, webhookData)` - Update webhook
- `deleteFormWebhook(formId, webhookTag)` - Delete webhook

## Usage Examples

### Creating a Simple Form
```javascript
const fields = [
    {
        title: 'What is your name?',
        type: 'short_text',
        properties: {
            description: 'Please enter your full name'
        },
        validations: {
            required: true
        }
    },
    {
        title: 'What is your email?',
        type: 'email',
        validations: {
            required: true
        }
    },
    {
        title: 'How satisfied are you?',
        type: 'rating',
        properties: {
            steps: 5,
            labels: {
                left: 'Not satisfied',
                right: 'Very satisfied'
            }
        }
    }
];

const form = await typeformApi.createSimpleForm(
    'Customer Feedback Survey',
    fields
);

console.log('Form created:', form.id);
console.log('Form URL:', form._links.display);
```

### Creating a Complex Form
```javascript
const formData = {
    title: 'Product Feedback Form',
    type: 'quiz',
    workspace: {
        href: 'https://api.typeform.com/workspaces/workspace-id'
    },
    theme: {
        href: 'https://api.typeform.com/themes/theme-id'
    },
    settings: {
        is_public: true,
        is_trial: false,
        language: 'en',
        progress_bar: 'proportion',
        show_progress_bar: true,
        show_typeform_branding: true,
        meta: {
            allow_indexing: false
        }
    },
    welcome_screens: [
        {
            title: 'Welcome to our survey!',
            properties: {
                description: 'Thank you for taking the time to provide feedback.',
                button_text: 'Start'
            }
        }
    ],
    thankyou_screens: [
        {
            title: 'Thank you!',
            properties: {
                description: 'We appreciate your feedback.'
            }
        }
    ],
    fields: [
        {
            title: 'What product are you reviewing?',
            type: 'dropdown',
            properties: {
                choices: [
                    { label: 'Product A' },
                    { label: 'Product B' },
                    { label: 'Product C' }
                ]
            },
            validations: {
                required: true
            }
        },
        {
            title: 'Rate this product',
            type: 'opinion_scale',
            properties: {
                start_at_one: true,
                steps: 10,
                labels: {
                    left: 'Poor',
                    right: 'Excellent'
                }
            }
        }
    ]
};

const form = await typeformApi.createForm(formData);
```

### Getting and Processing Responses
```javascript
// Get all completed responses
const responses = await typeformApi.getFormResponsesWithAnswers('form-id');

responses.items.forEach(response => {
    console.log('Response ID:', response.response_id);
    console.log('Submitted:', response.submitted_at);
    
    // Extract answers using helper method
    const answers = typeformApi.extractAnswers(response);
    console.log('Answers:', answers);
    
    // Or process answers manually
    response.answers.forEach(answer => {
        console.log(`Question: ${answer.field.id}`);
        console.log(`Answer: ${answer.text || answer.email || answer.number}`);
    });
});
```

### Setting up Webhooks
```javascript
const webhookData = {
    url: 'https://yoursite.com/webhooks/typeform',
    enabled: true,
    secret: 'your-webhook-secret',
    verify_ssl: true
};

const webhook = await typeformApi.createFormWebhook('form-id', webhookData);
console.log('Webhook created with tag:', webhook.tag);
```

### Working with Workspaces
```javascript
// Get all workspaces
const workspaces = await typeformApi.getWorkspaces();

// Create a new workspace
const newWorkspace = await typeformApi.createWorkspace({
    name: 'Marketing Team Workspace'
});

// Get forms in a workspace
const workspaceForms = await typeformApi.getWorkspaceForms(newWorkspace.id);
```

### Uploading and Managing Images
```javascript
// Note: Image upload requires multipart/form-data
const imageFormData = new FormData();
imageFormData.append('image', fileBuffer, 'image.jpg');
imageFormData.append('media_type', 'image');

const uploadedImage = await typeformApi.uploadImage(imageFormData);

// Use the image in a form
const formField = {
    title: 'Rate this image',
    type: 'rating',
    attachment: {
        type: 'image',
        href: uploadedImage.src
    }
};
```

### Filtering Responses
```javascript
// Get responses from the last 7 days
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);

const recentResponses = await typeformApi.getFormResponses('form-id', {
    since: weekAgo.toISOString(),
    completed: true,
    page_size: 100
});

// Get responses with specific completion status
const incompleteResponses = await typeformApi.getFormResponses('form-id', {
    completed: false
});
```

## Authentication Flow

Typeform uses OAuth2:

1. Redirect users to Typeform's authorization URL
2. Handle the callback with the authorization code
3. Exchange the code for access and refresh tokens
4. Use tokens for API requests

## Error Handling

Typeform returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const form = await typeformApi.createForm(formData);
    console.log('Form created successfully');
} catch (error) {
    console.error('Typeform error:', error.message);
    if (error.details) {
        error.details.forEach(detail => {
            console.error('Error detail:', detail.description);
        });
    }
}
```

## Rate Limiting

Typeform enforces rate limits on API requests:
- 4 requests per second for most endpoints
- Different limits for different operations

The module does not implement automatic retry logic - you should handle rate limiting in your application.

## Webhooks

Typeform sends webhooks when forms receive new responses. Configure webhooks to receive real-time notifications about form submissions.

Webhook payload includes:
- Event type (`form_response`)
- Form ID and response data
- Timestamp and response ID

## Field Types

Typeform supports various field types:
- `short_text` - Short text input
- `long_text` - Long text area
- `email` - Email validation
- `number` - Numeric input
- `multiple_choice` - Single selection
- `yes_no` - Yes/No question
- `dropdown` - Dropdown selection
- `rating` - Star rating
- `opinion_scale` - Numeric scale
- `date` - Date picker
- `file_upload` - File upload
- `payment` - Payment processing

## Documentation

For detailed Typeform API documentation, visit: https://developer.typeform.com/