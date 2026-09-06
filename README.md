
# MRNOBODY MD Bot

## Architecture

The bot is platform-independent. Deploy the same repository on Railway, Render, Koyeb, a VPS, Docker, or another Node.js host.

The bot only needs:

- `SESSION_ID`
- optional media-provider environment variables

Supabase credentials stay inside the centralized Pair API.

## Phase 1

Included:

- persistent WhatsApp session loading/sync
- SESSION_ID authentication
- user registration through Pair API
- ban/unban
- owner/admin checks
- rate limiting
- message queue
- heavy-job queue
- per-user heavy-job limits
- heavy-job timeout/abort support
- graceful shutdown
- command auto-loading
- categorized `.menu`
- downloader selection state
- movie/video/song/fb/tiktok/insta command files

## Phase 2

The same Bot repository can be deployed many times.

For every separate deployment:

1. Use a different `SESSION_ID`.
2. Use a unique `INSTANCE_ID`.
3. Keep the same Pair API URL.
4. Do not put Supabase credentials in the Bot.

Each bot instance therefore has its own WhatsApp session while sharing the centralized backend.

## Media API contract

The downloader commands intentionally use an adapter layer instead of scraping third-party sites from the bot.

Each provider is called with `POST` JSON.

Example video payload:

```json
{
  "url": "https://example.com/video",
  "quality": "720p",
  "output": "video"
}
```

Example song payload:

```json
{
  "url": "https://example.com/video",
  "bitrate": 320,
  "output": "audio",
  "format": "mp3"
}
```

Accepted successful response examples:

```json
{
  "url": "https://cdn.example.com/file.mp4",
  "title": "Example",
  "mimeType": "video/mp4",
  "fileName": "example.mp4"
}
```

or:

```json
{
  "data": {
    "url": "https://cdn.example.com/file.mp4"
  }
}
```

Base64 media is also supported, but direct HTTPS media URLs are preferred for large files.

## Important

The movie and media command framework is ready, but the actual provider URLs are intentionally not hard-coded. Add only APIs/services that you are authorized to use and that permit the requested content.
