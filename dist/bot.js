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
//TODO: Save who approved it -- Do this in school?
//TODO: Make The Buttons not time out
//TODO: Optimize
//TODO: Make sure git doesn't upload any files
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
    refreshButtonsOnStartup(exports.client);
    if (lastRow) {
        const gameName = lastRow ? lastRow.thread_name : '';
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
                thread_name, thread_id, link, password, message_id, rar_name, user_id, folder_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, threadData.thread_name, threadData.thread_id, threadData.link, threadData.password, threadData.message_id, threadData.rar_name, threadData.user_id, threadData.folder_path);
        yield db.run('DELETE FROM request_thread WHERE thread_id = ?', thread.id);
    }
}));
function refreshButtonsOnStartup(client) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield (0, setup_1.setupDatabase)();
        const threadsWithMessages = yield db.all('SELECT thread_id, message_id FROM request_thread WHERE message_id IS NOT NULL');
        for (const { thread_id, message_id } of threadsWithMessages) {
            try {
                const thread = yield client.channels.fetch(thread_id);
                const message = yield thread.messages.fetch(message_id);
                console.log("threadids:" + thread.id);
                console.log("messageids:" + message.id);
                // Reattach collectors for existing messages with buttons
                yield refreshButtonsForMessage(thread, message);
            }
            catch (error) {
                console.error(`Error refreshing buttons for thread ${thread_id}, message ${message_id}:`, error);
            }
        }
    });
}
function refreshButtonsForMessage(thread, sentMessage) {
    return __awaiter(this, void 0, void 0, function* () {
        // Recreate and set up button collectors for existing messages
        console.log("refreshing Buttons");
        const dmButton = new discord_js_1.ButtonBuilder()
            .setCustomId('send_dm')
            .setLabel('Send Details')
            .setStyle(discord_js_1.ButtonStyle.Primary);
        const uploadButton = new discord_js_1.ButtonBuilder()
            .setCustomId('start_upload')
            .setLabel('Start Upload')
            .setStyle(discord_js_1.ButtonStyle.Success);
        const deleteButton = new discord_js_1.ButtonBuilder()
            .setCustomId('delete_message')
            .setLabel('Delete Message')
            .setStyle(discord_js_1.ButtonStyle.Danger);
        yield sentMessage.edit({
            components: [{
                    type: discord_js_1.ComponentType.ActionRow,
                    components: [dmButton, uploadButton, deleteButton]
                }]
        });
        console.log("refreshed messages");
    });
}
exports.client.login(process.env.DISCORD_TOKEN);
