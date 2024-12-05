# Telegram YouTube Download Bot

A multilingual Telegram bot for downloading YouTube videos with subscription-based access.

## Features

- 🌍 Multilingual Support (English, Amharic, Tigrigna)
- 🔍 Search YouTube videos by keywords
- ⬇️ Download videos in multiple qualities
- 🎵 Convert videos to MP3
- 📱 User-friendly interface
- 🔐 Subscription-based access

## Commands

- `/start` - Start the bot and check subscription
- `/language` - Change language
- `/search [query]` - Search for YouTube videos

## Environment Variables

Create a `.env` file with:

```env
BOT_TOKEN=your_telegram_bot_token
YOUTUBE_API_KEY=your_youtube_api_key
CHANNEL_URL=your_telegram_channel_url
GROUP_URL=your_telegram_group_url
```

## Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/telegram-youtube-bot.git
cd telegram-youtube-bot
```

2. Install dependencies
```bash
npm install
```

3. Start the bot
```bash
npm start
```

## Deployment

The bot is configured for Vercel deployment with:
- `vercel.json` for routing
- `package.json` with build commands
- Environment variables set in Vercel dashboard

## License

MIT License
