# pipedrive

This is the API Module for pipedrive that allows the [Frigg](https://friggframework.org) code to talk to the pipedrive API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/pipedrive

## Rate limits

`Api.rateLimit` tells the Frigg Requester how Pipedrive limits calls. The numbers come from [Pipedrive's rate limiting guide](https://pipedrive.readme.io/docs/core-api-concepts-rate-limiting).

- **Burst:** a rolling 2 second window, counted per token. An OAuth app gets 80 requests in the window on the Lite plan, 160 on Growth, 400 on Premium and 480 on Ultimate. The module declares 80, the lowest. Pipedrive reports the real figure in `x-ratelimit-limit`.
- **A throttled call** returns `429`. When the 2 second window has no requests left (`x-ratelimit-remaining: 0`), the Requester waits for `Retry-After` when the response has one, and otherwise for `x-ratelimit-reset` (in seconds), then retries. A `429` with no `x-ratelimit-remaining` keeps the fixed backoff ladder.
- **Search:** the search endpoints (`searchPersons`, `search`) have their own limit of 10 requests per 2 seconds on every plan. The module declares it, but the Requester does not pass the request URL to the policy, so a throttled search is handled like any other `429`.
- **Daily token budget:** each company has a budget of 30,000 tokens times a plan multiplier times the number of seats. It resets at midnight in Pipedrive's server time zone. When it is spent, every call gets a `429`, and Pipedrive documents no header or body that marks it. The module treats a `429` that leaves requests in the 2 second window (`x-ratelimit-remaining` above 0) as the spent budget: the Requester throws a `RateLimitError` with `reason: 'daily'` and a `retryAt` one hour ahead, and does not sleep in process.
