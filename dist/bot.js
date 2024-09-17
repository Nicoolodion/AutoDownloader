"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const setup_1 = require("./db/setup");
const gameSearch_1 = require("./utils/gameSearch");
const worker_threads_1 = require("worker_threads");
//TODO: Add Folder System back in. Make sure it searches if a folder already exists.
//TODO: Try a different approach not using Jdownloader... Priority low
//TODO: Make The Buttons not time out
//TODO: Optimize
//TODO: Got Problems, type Help over DM. Explain what things to use for redirects.
dotenv_1.default.config();
exports.client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.DirectMessages
    ],
    partials: [discord_js_1.Partials.Channel] // Correct way to specify partials
});
exports.client.once('ready', (thread_id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log(`Logged in as ${(_a = exports.client.user) === null || _a === void 0 ? void 0 : _a.tag}`);
    const db = yield (0, setup_1.setupDatabase)();
    // TODO Make sure it actually works since it is just undefined at start?
    const lastRow = yield db.get('SELECT thread_name FROM request_thread WHERE thread_id = ?', worker_threads_1.threadId);
    if (lastRow) {
        const gameName = lastRow ? lastRow.thread_name : '';
    }
    // Fetch all active threads where buttons_inactive is 0
    const activeThreads = yield db.all('SELECT * FROM request_thread WHERE buttons_inactive IS NULL');
    for (const threadData of activeThreads) {
        const thread = yield exports.client.channels.fetch(threadData.thread_id);
        if (thread) {
            const message = yield thread.messages.fetch(threadData.message_id);
            if (message) {
                yield message.edit({
                    components: [{
                            type: discord_js_1.ComponentType.ActionRow,
                            components: [new discord_js_1.ButtonBuilder()
                                    .setCustomId('send_dm')
                                    .setLabel('Send Details')
                                    .setStyle(discord_js_1.ButtonStyle.Primary),
                                new discord_js_1.ButtonBuilder()
                                    .setCustomId('start_upload')
                                    .setLabel('Start Upload')
                                    .setStyle(discord_js_1.ButtonStyle.Success),
                                new discord_js_1.ButtonBuilder()
                                    .setCustomId('delete_message')
                                    .setLabel('Delete Message')
                                    .setStyle(discord_js_1.ButtonStyle.Danger)]
                        }]
                });
                const filter = (interaction) => interaction.customId === 'send_dm' || interaction.customId === 'start_upload' || interaction.customId === 'delete_message' && interaction.user.id === threadData.user_id;
                const collector = message.createMessageComponentCollector({ filter, time: 120000 }); // 2 minutes
                collector.on('collect', (interaction) => __awaiter(void 0, void 0, void 0, function* () {
                    if (interaction.customId === 'send_dm') {
                        yield interaction.reply({ content: 'DM sent', ephemeral: true });
                    }
                    else if (interaction.customId === 'start_upload') {
                        yield interaction.reply({ content: 'Starting Upload...', ephemeral: true });
                        yield (0, gameSearch_1.searchGame)(threadData.thread_name, thread, exports.client);
                    }
                    else if (interaction.customId === 'delete_message') {
                        yield interaction.reply({ content: 'Deleting message...', ephemeral: true });
                        yield message.delete();
                    }
                }));
            }
        }
    }
}));
const checkForNewThreads = (thread) => __awaiter(void 0, void 0, void 0, function* () {
    const excludedTags = ['MP', 'Multiplayer', 'weitere Nachricht', 'DLC Unlocker', 'Unlocker'];
    if (excludedTags.some(tag => thread.name.includes(tag))) {
        console.log('Multiplayer request detected, skipping...');
        return;
    }
    const requiredTagId = process.env.GAMES_TAG;
    if (!requiredTagId) {
        console.error('REQUIRED_TAG_ID is not defined in the environment variables.');
        return;
    }
    // Check if the thread has the required tag
    if (!thread.appliedTags.includes(requiredTagId)) {
        return;
    }
    const db = yield (0, setup_1.setupDatabase)();
    const existingThread = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
    console.log(thread.id);
    if (!existingThread) {
        yield db.run('INSERT INTO request_thread (thread_name, thread_id) VALUES (?, ?)', thread.name, thread.id);
        yield (0, gameSearch_1.searchGame)(thread.name, thread, exports.client);
    }
});
exports.client.on('threadCreate', (thread) => {
    if (thread.parentId === process.env.REQUEST_CHANNEL_ID) {
        checkForNewThreads(thread);
    }
});
exports.client.on('threadDelete', (thread) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, setup_1.setupDatabase)();
    // Move the thread to the archived table
    const threadData = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
    if (threadData) {
        yield db.run(`
            INSERT INTO archived_thread (
                thread_name, thread_id, link, password, message_id, rar_name, user_id, folder_path, uploader_id, buttons_inactive
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, threadData.thread_name, threadData.thread_id, threadData.link, threadData.password, threadData.message_id, threadData.rar_name, threadData.user_id, threadData.folder_path, threadData.uploader_id, threadData.buttons_inactive);
        yield db.run('DELETE FROM request_thread WHERE thread_id = ?', thread.id);
    }
}));
exports.client.login(process.env.DISCORD_TOKEN);
