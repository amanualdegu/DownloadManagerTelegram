require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const express = require('express');
const os = require('os');
const app = express();

// Constants
const BOT_TOKEN = process.env.BOT_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SEARCH_EMOJI = '🔍';
const DOWNLOAD_EMOJI = '⬇️';
const UPLOAD_EMOJI = '📤';
const ERROR_EMOJI = '❌';
const SUCCESS_EMOJI = '✅';
const PROGRESS_FRAMES = ['⏳', '⌛️'];

// Initialize stats
const stats = {
    startTime: Date.now(),
    totalDownloads: 0,
    activeUsers: new Set(),
    isOnline: true
};

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Initialize YouTube API
const youtube = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY
});

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Store user search results
const userSearchResults = new Map();
const userVideoSelections = new Map();

// Track user subscription steps
const userSubscriptionSteps = new Map();

// Store user caption requests
const userCaptionRequests = new Map();

// Update stats when downloads occur
function updateStats(chatId) {
    stats.totalDownloads++;
    stats.activeUsers.add(chatId);
}

// Send subscription message with direct links
async function sendSubscriptionMessage(chatId) {
    try {
        // Initialize or reset user's subscription steps
        userSubscriptionSteps.set(chatId, {
            channelClicked: false,
            groupClicked: false,
            timestamp: new Date()
        });

        console.log(`[${new Date().toISOString()}] Initializing subscription steps for user ${chatId}:`, userSubscriptionSteps.get(chatId));

        // Create two rows of buttons for each link - one for URL, one for tracking
        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '📢 Join Our Channel',
                        url: process.env.CHANNEL_URL
                    }
                ],
                [
                    {
                        text: '✅ I Joined Channel',
                        callback_data: 'join_channel'
                    }
                ],
                [
                    {
                        text: '👥 Join Our Group',
                        url: process.env.GROUP_URL
                    }
                ],
                [
                    {
                        text: '✅ I Joined Group',
                        callback_data: 'join_group'
                    }
                ],
                [
                    {
                        text: '🔄 Check My Subscription',
                        callback_data: 'check_subscription'
                    }
                ]
            ]
        };

        const message = await bot.sendMessage(
            chatId,
            '❗️ Please follow these steps:\n\n' +
            '1. Click "Join Our Channel"\n' +
            '2. Click "I Joined Channel"\n' +
            '3. Click "Join Our Group"\n' +
            '4. Click "I Joined Group"\n' +
            '5. Click "Check My Subscription"\n\n' +
            'Make sure to click the buttons in order!',
            {
                reply_markup: keyboard,
                parse_mode: 'HTML'
            }
        );
        
        console.log(`[${new Date().toISOString()}] Subscription message sent to user ${chatId}:`, {
            messageId: message.message_id
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error sending subscription message to user ${chatId}:`, error);
        await bot.sendMessage(chatId, '❌ Error: Could not send subscription message. Please try again later.');
    }
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[${new Date().toISOString()}] Start command received from:`, chatId);
    await sendSubscriptionMessage(chatId);
});

// Handle /language command
bot.onText(/\/language/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`[${new Date().toISOString()}] Language command received from:`, chatId);
    
    const languageKeyboard = {
        inline_keyboard: [
            [
                { text: '🇺🇸 English', callback_data: 'lang_english' },
                { text: '🇪🇹 አማርኛ', callback_data: 'lang_amharic' },
                { text: '🇪🇹 ትግርኛ', callback_data: 'lang_tigrigna' }
            ]
        ]
    };

    await bot.sendMessage(
        chatId,
        'Select your language / ቋንቋ ይምረጡ / ቋንቋኹም ምረጹ:',
        {
            reply_markup: languageKeyboard
        }
    );
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    console.log(`[${new Date().toISOString()}] Callback received:`, {
        chatId,
        data,
        messageId
    });

    // Get user's subscription progress
    let userSteps = userSubscriptionSteps.get(chatId) || {
        channelClicked: false,
        groupClicked: false,
        timestamp: new Date()
    };

    if (data === 'join_channel') {
        userSteps.channelClicked = true;
        userSteps.channelClickTime = new Date();
        userSubscriptionSteps.set(chatId, userSteps);
        console.log(`[${new Date().toISOString()}] User ${chatId} clicked channel button:`, userSteps);
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'join_group') {
        userSteps.groupClicked = true;
        userSteps.groupClickTime = new Date();
        userSubscriptionSteps.set(chatId, userSteps);
        console.log(`[${new Date().toISOString()}] User ${chatId} clicked group button:`, userSteps);
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'check_subscription') {
        console.log(`[${new Date().toISOString()}] User ${chatId} clicked check button. Current steps:`, userSteps);

        // Show language selection
        const languageKeyboard = {
            inline_keyboard: [
                [
                    { text: '🇺🇸 English', callback_data: 'lang_english' },
                    { text: '🇪🇹 አማርኛ', callback_data: 'lang_amharic' },
                    { text: '🇪🇹 ትግርኛ', callback_data: 'lang_tigrigna' }
                ]
            ]
        };

        await bot.editMessageText(
            'Please select your language / ቋንቋ ይምረጡ / ቋንቋኹም ምረጹ:',
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: languageKeyboard
            }
        );

        console.log(`[${new Date().toISOString()}] Showing language selection to user ${chatId}`);

        // Clear user's subscription steps
        userSubscriptionSteps.delete(chatId);
        console.log(`[${new Date().toISOString()}] Cleared subscription steps for user ${chatId}`);
    }
    else if (data.startsWith('lang_')) {
        // Handle language selection
        const language = data.split('_')[1];
        console.log(`[${new Date().toISOString()}] User ${chatId} selected language: ${language}`);
        
        await bot.editMessageText(
            welcomeMessages[language],
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML'
            }
        );
    }
    else if (data.startsWith('video_')) {
        const videoId = data.split('_')[1];
        console.log(`[${new Date().toISOString()}] User ${chatId} selected video: ${videoId}`);

        const processingMsg = await bot.sendMessage(
            chatId,
            `${PROGRESS_FRAMES[0]} Getting available qualities...`
        );

        try {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            
            // First verify video is accessible
            try {
                await ytdl.getInfo(url);
            } catch (e) {
                if (e.message.includes('Video unavailable')) {
                    throw new Error('This video is no longer available.');
                }
            }

            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    const availableQualities = await getAvailableFormats(url);
                    
                    if (!availableQualities || availableQualities.length === 0) {
                        throw new Error('No download options available for this video.');
                    }

                    userVideoSelections.set(chatId, {
                        url,
                        availableQualities
                    });

                    await bot.editMessageText(
                        '📥 Select download quality:\n\n' +
                        '• Higher quality = larger file size\n' +
                        '• MP3 = audio only',
                        {
                            chat_id: chatId,
                            message_id: processingMsg.message_id,
                            reply_markup: createQualityKeyboard(availableQualities)
                        }
                    );
                    break;
                } catch (error) {
                    retryCount++;
                    console.log(`Retry ${retryCount}/${maxRetries} for video qualities:`, error.message);
                    if (retryCount === maxRetries) {
                        throw error;
                    }
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error getting video qualities:`, error);
            let errorMessage = '❌ Failed to get video qualities.';
            
            if (error.code === 'EFATAL' || error.message.includes('network')) {
                errorMessage = '❌ Network error. Please try again.';
            } else if (error.message.includes('unavailable')) {
                errorMessage = '❌ This video is not available.';
            }
            
            await bot.editMessageText(
                errorMessage,
                {
                    chat_id: chatId,
                    message_id: processingMsg.message_id
                }
            );
        }
    }
    else if (data.startsWith('quality_')) {
        const format = data.split('_')[1];
        const videoInfo = userVideoSelections.get(chatId);

        if (!videoInfo) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '❌ Video selection expired. Please try again.',
                show_alert: true
            });
            return;
        }

        const processingMsg = await bot.sendMessage(
            chatId,
            `${PROGRESS_FRAMES[0]} Starting download...`
        );

        try {
            const outputPath = path.join(downloadsDir, `video_${Date.now()}.${format === 'mp3' ? 'mp3' : 'mp4'}`);
            
            if (format === 'mp3') {
                const audioStream = ytdl(videoInfo.url, { filter: 'audioonly' });
                const fileStream = fs.createWriteStream(outputPath);
                audioStream.pipe(fileStream);

                await new Promise((resolve, reject) => {
                    fileStream.on('finish', async () => {
                        try {
                            await sendAndDeleteFile(chatId, outputPath);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });

                    fileStream.on('error', (error) => {
                        reject(error);
                    });
                });
            } else {
                const videoStream = ytdl(videoInfo.url, { filter: format });
                const fileStream = fs.createWriteStream(outputPath);
                videoStream.pipe(fileStream);

                await new Promise((resolve, reject) => {
                    fileStream.on('finish', async () => {
                        try {
                            await sendAndDeleteFile(chatId, outputPath);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });

                    fileStream.on('error', (error) => {
                        reject(error);
                    });
                });
            }

            // Clean up
            userVideoSelections.delete(chatId);
            
            await bot.editMessageText(
                `${SUCCESS_EMOJI} Download completed! Send another URL or use /search to find more videos.`,
                {
                    chat_id: chatId,
                    message_id: processingMsg.message_id
                }
            );
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Download error:`, error);
            let errorMessage = '❌ Download failed.';
            if (error.message.includes('Too large')) {
                errorMessage = '❌ Video is too large. Please try a lower quality.';
            } else if (error.message.includes('not available')) {
                errorMessage = '❌ This quality is no longer available. Please try another.';
            }
            await bot.editMessageText(
                errorMessage,
                {
                    chat_id: chatId,
                    message_id: processingMsg.message_id
                }
            );
        }
    }
});

// Handle search command
bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchQuery = match[1];

    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: searchQuery,
            maxResults: 10,
            type: 'video'
        });

        if (!response.data.items || response.data.items.length === 0) {
            return bot.sendMessage(chatId, '❌ No videos found.');
        }

        // Store video information for later use
        const searchResults = response.data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));

        userSearchResults.set(chatId, searchResults);

        const message = '🔍 Search Results:\n\n' +
            searchResults.map((result, index) => 
                `${index + 1}. ${result.title}\n` +
                `🔗 ${result.url}\n`
            ).join('\n');

        await bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: searchResults.map((result, index) => [{
                    text: result.title.substring(0, 50) + (result.title.length > 50 ? '...' : ''),
                    callback_data: `video_${result.videoId}`
                }])
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        bot.sendMessage(chatId, '❌ Failed to search videos. Please try again or paste a direct YouTube URL.');
    }
});

// Handle callback queries for video selection
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    if (data.startsWith('video_')) {
        const videoId = data.split('_')[1];
        const searchResults = userSearchResults.get(chatId);
        const selectedVideo = searchResults?.find(v => v.videoId === videoId);

        if (!selectedVideo) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: selectedVideo?.url || 'Session expired. Please search again.',
                show_alert: true
            });
            return;
        }

        const processingMsg = await bot.sendMessage(
            chatId,
            `${PROGRESS_FRAMES[0]} Getting available qualities...`
        );

        try {
            const availableQualities = await getAvailableFormats(selectedVideo.url);
            
            if (!availableQualities || availableQualities.length === 0) {
                throw new Error('No download options available');
            }

            userVideoSelections.set(chatId, {
                url: selectedVideo.url,
                title: selectedVideo.title,
                availableQualities
            });

            await bot.editMessageText(
                `📥 Select quality for:\n${selectedVideo.title}\n\n` +
                `🔗 ${selectedVideo.url}\n\n` +
                '• Higher quality = larger file size\n' +
                '• MP3 = audio only',
                {
                    chat_id: chatId,
                    message_id: processingMsg.message_id,
                    reply_markup: createQualityKeyboard(availableQualities)
                }
            );
        } catch (error) {
            console.error('Error getting video qualities:', error);
            // Show URL in popup for easy copying
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: selectedVideo.url,
                show_alert: true
            });
            
            let errorMessage = '❌ Failed to get video qualities.\n\n' +
                             '💡 Copy the URL from the popup above and try pasting it directly.';
            
            if (error.message.includes('not available')) {
                errorMessage = '❌ This video is not available.\n\n' +
                             '💡 Copy the URL from the popup above and try pasting it directly.';
            }
            
            await bot.editMessageText(errorMessage, {
                chat_id: chatId,
                message_id: processingMsg.message_id
            });
        }
    } else if (data.startsWith('quality_')) {
        // ... rest of the quality selection handler
    }
});

// Handle direct URL messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    
    if (!msg.text || msg.text.startsWith('/')) return;

    // Handle caption requests
    if (userCaptionRequests.has(chatId)) {
        const videoUrl = userCaptionRequests.get(chatId);
        userCaptionRequests.delete(chatId);
        try {
            const info = await ytdl.getInfo(videoUrl);
            await bot.sendMessage(chatId, `📝 Video Caption:\n\n${info.title}\n\n${info.description || 'No description available'}`);
            // Continue with video processing
            processVideoUrl(chatId, videoUrl, info);
        } catch (error) {
            console.error('Error getting video info:', error);
            await bot.sendMessage(chatId, '❌ Failed to get video caption.\n\nTrying to process video anyway...');
            processVideoUrl(chatId, videoUrl);
        }
        return;
    }

    if (!msg.text.includes('youtube.com') && !msg.text.includes('youtu.be')) {
        return;
    }

    const videoId = extractVideoId(msg.text);
    if (!videoId) {
        return bot.sendMessage(chatId, '❌ Please send a valid YouTube URL.');
    }

    processVideoUrl(chatId, msg.text);
});

// Process video URL
async function processVideoUrl(chatId, url, existingInfo = null) {
    try {
        let info = existingInfo;
        if (!info) {
            info = await ytdl.getInfo(url);
        }

        const availableQualities = await getAvailableFormats(url);
        
        if (!availableQualities || availableQualities.length === 0) {
            throw new Error('No download options available for this video.');
        }

        userVideoSelections.set(chatId, {
            url: url,
            title: info.title,
            availableQualities
        });

        await bot.sendMessage(
            chatId,
            `📥 Select quality for:\n${info.title}\n\n` +
            `🔗 ${url}\n\n` +
            '• Higher quality = larger file size\n' +
            '• MP3 = audio only',
            {
                reply_markup: createQualityKeyboard(availableQualities)
            }
        );
    } catch (error) {
        console.error('Error getting video info:', error);
        let errorMessage = `❌ Failed to get video qualities.\n\n` +
                         `🎥 Video URL: ${url}\n\n` +
                         `Would you like to see the video caption? Reply with 'yes' if you want to see it.\n\n` +
                         `💡 Try copying and pasting this URL directly:\n${url}`;
        
        if (error.message.includes('not available')) {
            errorMessage = `❌ This video is not available.\n\n` +
                         `🎥 Video URL: ${url}\n\n` +
                         `Would you like to see the video caption? Reply with 'yes' if you want to see it.\n\n` +
                         `💡 If you think this is an error, try copying and pasting this URL:\n${url}`;
        }
        
        await bot.sendMessage(chatId, errorMessage);
        
        // Store the URL for caption request
        userCaptionRequests.set(chatId, url);
        
        // Send URL separately for easy copying
        await bot.sendMessage(chatId, url);
    }
}

// Create quality selection keyboard
function createQualityKeyboard(qualities) {
    const buttons = qualities.map(q => [{
        text: `📹 ${q.quality}${q.filesize ? ` (${formatFileSize(q.filesize)})` : ''}`,
        callback_data: `quality_${q.itag}`
    }]);

    // Add MP3 option at the bottom
    buttons.push([{
        text: '🎵 Convert to MP3',
        callback_data: 'quality_mp3'
    }]);

    return {
        inline_keyboard: buttons
    };
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// Send file and delete it after sending
async function sendAndDeleteFile(chatId, filePath, title) {
    try {
        const stats = await fs.promises.stat(filePath);
        const fileSize = stats.size;
        
        // Check if it's an audio file
        const isAudio = filePath.toLowerCase().endsWith('.mp3');
        
        // Update download stats
        updateStats(chatId);

        // If file is larger than 50MB, send as a file
        if (fileSize > 50 * 1024 * 1024) {
            await bot.sendMessage(chatId, '⚠️ File is larger than 50MB, sending as document...');
            await bot.sendDocument(chatId, filePath);
        } else {
            // Send as playable media based on type
            if (isAudio) {
                await bot.sendAudio(chatId, filePath, {
                    // Add audio metadata if available
                    title: title || path.basename(filePath, '.mp3'),
                    performer: 'YouTube Audio'
                });
            } else {
                await bot.sendVideo(chatId, filePath, {
                    supports_streaming: true, // Enable streaming
                    caption: '🎥 Enjoy your video!'
                });
            }
        }
    } catch (error) {
        console.error('Error sending file:', error);
        await bot.sendMessage(chatId, '❌ Failed to send media. Please try again.');
    } finally {
        // Clean up: delete the file
        try {
            await fs.promises.unlink(filePath);
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }
}

// Welcome messages in different languages
const welcomeMessages = {
    english: 'Welcome! Here\'s what I can do:\n\n' +
        '1. 🔍 Search YouTube videos by keywords\n' +
        '2. ⬇️ Download videos from YouTube URLs\n' +
        '3. 🎵 Convert videos to MP3\n' +
        '4. 📱 Choose from multiple video qualities\n\n' +
        'To get started:\n' +
        '• Send a YouTube URL directly\n' +
        '• Or use /search keyword to find videos\n' +
        'Example: /search music',
    
    amharic: 'እንኳን ደህና መጡ! እነሆ የምችለው:\n\n' +
        '1. 🔍 በቁልፍ ቃላት የዩቲዩብ ቪድዮዎችን ፈልግ\n' +
        '2. ⬇️ ከዩቲዩብ URLs በቀጥታ ቪድዮዎችን አውርድ\n' +
        '3. 🎵 ቪድዮዎችን ወደ MP3 ቀይር\n' +
        '4. 📱 ከበርካታ የቪድዮ ጽሬት ምረጹ\n\n' +
        'ለመጀመር:\n' +
        '• ናይ ዩቲዩብ URL ብቐጥታ ይላኣኹ\n' +
        '• ወይ ቪድዮዎችን ለመፈለግ /search ቃል ተጠቐሙ\n' +
        'ኣብነት: /search ሙዚቃ',
    
    tigrigna: 'እንቋዕ ብደሓን መጻእኩም! እነሆ ዝክእሎ:\n\n' +
        '1. 🔍 ብቑልፊ ቃላት ቪድዮታት ይድለዩ\n' +
        '2. ⬇️ ካብ ዩቱብ URLs ቀጥታ ቪድዮታት የውርድ\n' +
        '3. 🎵 ቪድዮታት ናብ MP3 ይቕይር\n' +
        '4. 📱 ካብ ብዙሓት ጽሬት ይምረጹ\n\n' +
        'ንምጅማር:\n' +
        '• ናይ ዩቱብ URL ብቐጥታ ይላኣኹ\n' +
        '• ወይ ቪድዮታት ንምድላይ /search ቃል ተጠቐሙ\n' +
        'ኣብነት: /search ሙዚቃ'
};

// Search YouTube videos
async function searchYouTubeVideos(query) {
    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: 10
        });

        const videoIds = response.data.items.map(item => item.id.videoId);
        const videoDetails = await youtube.videos.list({
            part: 'contentDetails,statistics',
            id: videoIds.join(',')
        });

        return response.data.items.map((item, index) => ({
            title: item.snippet.title,
            videoId: item.id.videoId,
            thumbnail: item.snippet.thumbnails.default.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
            duration: videoDetails.data.items[index].contentDetails.duration,
            views: parseInt(videoDetails.data.items[index].statistics.viewCount).toLocaleString()
        }));
    } catch (error) {
        console.error('YouTube search error:', error);
        throw error;
    }
}

// Function to get available formats
async function getAvailableFormats(url) {
    try {
        const info = await ytdl.getInfo(url);
        const formats = info.formats.filter(format => {
            return (format.hasVideo && format.hasAudio) || (!format.hasVideo && format.hasAudio);
        });

        const qualities = formats.map(format => ({
            itag: format.itag,
            quality: format.qualityLabel || 'Audio Only',
            container: format.container,
            hasVideo: format.hasVideo,
            hasAudio: format.hasAudio,
            contentLength: format.contentLength
        }));

        return qualities;
    } catch (error) {
        console.error('Error getting formats:', error);
        throw error;
    }
}

// Download and send video
async function downloadAndSendVideo(chatId, url, format) {
    const info = await ytdl.getInfo(url);
    const videoPath = path.join(downloadsDir, `${info.videoDetails.videoId}.${format.container}`);
    
    const stream = ytdl(url, {
        quality: format.itag,
        filter: format => format.itag === format.itag
    });

    const fileStream = fs.createWriteStream(videoPath);
    stream.pipe(fileStream);

    return new Promise((resolve, reject) => {
        fileStream.on('finish', async () => {
            try {
                await sendAndDeleteFile(chatId, videoPath, info.videoDetails.title);
                resolve();
            } catch (error) {
                reject(error);
            }
        });

        fileStream.on('error', (error) => {
            reject(error);
        });
    });
}

// Clean downloads directory on startup
function cleanDownloadsDirectory() {
    try {
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(downloadsDir);
        for (const file of files) {
            const filePath = path.join(downloadsDir, file);
            fs.unlinkSync(filePath);
            console.log(`[${new Date().toISOString()}] Cleaned up old file: ${filePath}`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error cleaning downloads directory:`, error);
    }
}

// Clean up downloads directory on startup
cleanDownloadsDirectory();

// Function to extract video ID from YouTube URL
function extractVideoId(url) {
    try {
        let videoId = null;
        
        // Handle youtube.com URLs
        if (url.includes('youtube.com')) {
            const urlObj = new URL(url);
            if (urlObj.searchParams.has('v')) {
                videoId = urlObj.searchParams.get('v');
            }
        }
        // Handle youtu.be URLs
        else if (url.includes('youtu.be')) {
            videoId = url.split('youtu.be/')[1];
            if (videoId.includes('?')) {
                videoId = videoId.split('?')[0];
            }
        }

        // Validate video ID format (11 characters)
        if (videoId && videoId.length === 11) {
            return videoId;
        }
        return null;
    } catch (error) {
        console.error('Error extracting video ID:', error);
        return null;
    }
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Stats endpoint
app.get('/api/stats', (req, res) => {
    const uptime = Math.floor((Date.now() - stats.startTime) / 3600000) + 'h';
    const memoryUsage = Math.floor((os.totalmem() - os.freemem()) / os.totalmem() * 100);
    const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
    
    res.json({
        totalDownloads: stats.totalDownloads,
        activeUsers: stats.activeUsers.size,
        uptime,
        memoryUsage: Math.floor(memoryUsage),
        cpuUsage: Math.floor(cpuUsage),
        storage: Math.floor(os.freemem() / 1024 / 1024 / 1024),
        isOnline: stats.isOnline
    });
});

// Status page
app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

// Handle root path
app.get('/', (req, res) => {
    res.send('Telegram YouTube Downloader Bot is running!');
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
