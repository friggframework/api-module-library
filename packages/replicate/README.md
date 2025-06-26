# Replicate API Module

This module provides comprehensive access to Replicate's cloud-based machine learning model hosting platform, allowing you to run thousands of open-source models with a simple API.

## Features

- **Model Execution**: Run any public model on Replicate
- **Async Predictions**: Create and monitor long-running predictions
- **Streaming Support**: Stream output from compatible models
- **Deployment Management**: Use dedicated deployments for consistent performance
- **Webhook Integration**: Get notified when predictions complete
- **Progress Tracking**: Monitor prediction progress in real-time
- **High-Level Helpers**: Simplified methods for common model types

## Authentication

Replicate uses API tokens for authentication. You'll need to:

1. Sign up at [replicate.com](https://replicate.com)
2. Get your API token from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
3. Set the following environment variable:

```bash
REPLICATE_API_TOKEN=your_token_here
# or
REPLICATE_API_KEY=your_token_here
```

## Usage Examples

### Basic Model Execution

```javascript
const {Api} = require('./api');

const api = new Api({
    apiKey: process.env.REPLICATE_API_TOKEN
});

// Run a model and wait for results
const output = await api.run(
    "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
    {
        prompt: "a vision of paradise, unreal engine"
    }
);

// Run without waiting (get prediction object immediately)
const prediction = await api.run(
    "meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3",
    {
        prompt: "What is machine learning?",
        max_new_tokens: 500
    },
    { wait: false }
);

// Check status later
const result = await api.getPrediction(prediction.id);
```

### Text Generation

```javascript
// Using high-level helper
const response = await api.generateText(
    "Write a haiku about artificial intelligence",
    {
        temperature: 0.8,
        maxTokens: 100,
        model: "meta/llama-2-70b-chat:latest" // optional, defaults to Llama 2
    }
);

// Using specific model
const output = await api.run(
    "meta/llama-2-13b-chat:f4e2de70d66816a838a89eeeb621910adffb0dd0baba3976c96980970978018d",
    {
        prompt: "Explain quantum computing in simple terms",
        system_prompt: "You are a helpful, respectful and honest assistant.",
        max_new_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.1
    }
);
```

### Image Generation

```javascript
// Using high-level helper
const images = await api.generateImage(
    "An astronaut riding a horse on Mars, photorealistic",
    {
        negativePrompt: "blurry, bad quality",
        width: 1024,
        height: 1024,
        numOutputs: 2
    }
);

// Using SDXL directly
const output = await api.run(
    "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
    {
        prompt: "A serene Japanese garden in autumn",
        negative_prompt: "worst quality, low quality",
        width: 1024,
        height: 1024,
        scheduler: "K_EULER",
        num_inference_steps: 25,
        guidance_scale: 7.5,
        num_outputs: 1
    }
);
```

### Audio Transcription

```javascript
// Using high-level helper
const transcription = await api.transcribeAudio(
    "https://example.com/audio.mp3",
    {
        whisperModel: "large-v2",
        transcription: "plain text"
    }
);

// Using Whisper directly
const output = await api.run(
    "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2",
    {
        audio: "https://example.com/speech.wav",
        model: "base",
        transcription: "srt",
        translate: false,
        language: "en"
    }
);
```

### Progress Tracking

```javascript
// Run with progress callback
const output = await api.runWithProgress(
    "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
    {
        prompt: "A futuristic city at night"
    },
    (prediction) => {
        console.log(`Status: ${prediction.status}`);
        if (prediction.logs) {
            console.log(`Logs: ${prediction.logs}`);
        }
        if (prediction.metrics?.predict_time) {
            console.log(`Time: ${prediction.metrics.predict_time}s`);
        }
    }
);
```

### Streaming Output

```javascript
// For models that support streaming
const prediction = await api.run(
    "meta/llama-2-70b-chat:latest",
    {
        prompt: "Tell me a story",
        max_new_tokens: 1000,
        stream: true
    },
    { wait: false }
);

// Stream the output
for await (const token of api.streamPrediction(prediction.id)) {
    process.stdout.write(token);
}
```

### Model Information

```javascript
// Get model details
const model = await api.getModel("stability-ai", "stable-diffusion");

// List model versions
const versions = await api.listModelVersions("stability-ai", "stable-diffusion");

// Get specific version
const version = await api.getModelVersion(
    "stability-ai",
    "stable-diffusion",
    "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf"
);
```

### Collections

```javascript
// Browse curated collections
const collections = await api.listCollections();

// Get models in a collection
const textToImage = await api.getCollection("text-to-image");
console.log(textToImage.models); // Array of models in collection
```

### Deployments

```javascript
// List your deployments
const deployments = await api.listDeployments();

// Get deployment details
const deployment = await api.getDeployment("my-username", "my-deployment");

// Run prediction on deployment
const output = await api.createDeploymentPredictionAndWait(
    "my-username",
    "my-deployment",
    {
        input: {
            prompt: "Hello world"
        }
    }
);
```

### Webhooks

```javascript
// Create prediction with webhook
const prediction = await api.createPrediction({
    version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
    input: {
        prompt: "A beautiful landscape"
    },
    webhook: "https://example.com/webhook",
    webhook_events_filter: ["start", "completed"]
});

// Get webhook signing secret
const secret = await api.getWebhookSecret();
```

### Batch Predictions

```javascript
// Process multiple inputs
const prompts = [
    "A cat in space",
    "A dog underwater",
    "A bird in a library"
];

const predictions = await Promise.all(
    prompts.map(prompt => 
        api.run(
            "stability-ai/stable-diffusion:latest",
            { prompt },
            { wait: false }
        )
    )
);

// Wait for all to complete
const results = await Promise.all(
    predictions.map(p => api.waitForPrediction(p.id))
);
```

### Error Handling

```javascript
try {
    const output = await api.run("invalid/model", { input: "test" });
} catch (error) {
    if (error.status === 404) {
        console.error("Model not found");
    } else if (error.message.includes("timeout")) {
        console.error("Prediction timed out");
    } else {
        console.error("Error:", error.message);
    }
}

// Cancel a long-running prediction
const prediction = await api.run("some/model", { input }, { wait: false });
// ... later
await api.cancelPrediction(prediction.id);
```

## API Methods

### Predictions
- `createPrediction(params)` - Create a new prediction
- `createPredictionAndWait(params, options)` - Create and wait for completion
- `getPrediction(predictionId)` - Get prediction details
- `cancelPrediction(predictionId)` - Cancel a running prediction
- `listPredictions(params)` - List your predictions
- `waitForPrediction(predictionId, options)` - Wait for prediction to complete

### Models
- `getModel(owner, name)` - Get model information
- `listModelVersions(owner, name)` - List model versions
- `getModelVersion(owner, name, versionId)` - Get specific version
- `searchModels(query)` - Search for models (via collections)

### Collections
- `listCollections()` - List model collections
- `getCollection(slug)` - Get collection details

### Deployments
- `listDeployments()` - List your deployments
- `getDeployment(owner, name)` - Get deployment details
- `createDeploymentPrediction(owner, name, params)` - Run on deployment
- `createDeploymentPredictionAndWait(owner, name, params, options)` - Run and wait

### Account & Hardware
- `getAccount()` - Get account information
- `listHardware()` - List available hardware
- `getWebhookSecret()` - Get webhook signing secret

### High-Level Helpers
- `run(model, input, options)` - Run any model easily
- `runWithProgress(model, input, progressCallback, options)` - Run with progress
- `streamPrediction(predictionId, options)` - Stream prediction output
- `generateText(prompt, options)` - Generate text easily
- `generateImage(prompt, options)` - Generate images easily
- `transcribeAudio(audioUrl, options)` - Transcribe audio easily

### Utilities
- `testAuth()` - Verify API token
- `formatModelId(owner, name, version)` - Format model identifier
- `parseModelId(modelId)` - Parse model identifier

## Model Identifiers

Models are identified in the format:
- `owner/name` - Uses latest version
- `owner/name:version` - Uses specific version
- `owner/name:sha256hash` - Uses exact version by hash

Examples:
- `stability-ai/stable-diffusion`
- `meta/llama-2-70b-chat:latest`
- `openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2`

## Options

### Prediction Options
- `wait`: Whether to wait for completion (default: true)
- `webhook`: Webhook URL for notifications
- `webhook_events_filter`: Events to send (start, output, logs, completed)

### Wait Options
- `maxWait`: Maximum time to wait in ms (default: 60000)
- `interval`: Polling interval in ms (default: 500)

## Best Practices

1. **Use Specific Versions**: Pin model versions for consistent results
2. **Handle Timeouts**: Set appropriate `maxWait` for long-running models
3. **Use Webhooks**: For production, use webhooks instead of polling
4. **Batch Wisely**: Run predictions in parallel but respect rate limits
5. **Monitor Costs**: Check prediction metrics and costs regularly

## Error Handling

Common errors:
- `401`: Invalid API token
- `404`: Model not found
- `422`: Invalid input parameters
- `429`: Rate limit exceeded
- `503`: Model is loading

## Support

For more information, visit [Replicate Documentation](https://replicate.com/docs).