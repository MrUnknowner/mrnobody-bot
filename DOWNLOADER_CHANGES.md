# Downloader integration changes

Base: MRNOBODY_MD_Phase1_Phase2_Complete_v2.zip

## Changed
- Added npm dependencies:
  - yt-search
  - @pontalabs/ytdl
  - cinesubz-scraper
  - dark-yasiya-sinhalasub.lk
- Added services/youtube-service.js for YouTube search/video/audio.
- Added services/movie-service.js for Cinesubz + SinhalaSub.
- Reworked commands/movie.js, commands/video.js and commands/song.js to use the packages directly.
- Removed downloader API variables from .env.example.
- Kept Railway deployment configuration SESSION_ID-only.
- Added downloader numeric-selection routing in index.js.

## Not changed
- Pair repository.
- Supabase schema.
- Existing owner/admin, rate-limit and heavy-queue architecture.
- TikTok, Instagram and Facebook downloader commands (deferred).
