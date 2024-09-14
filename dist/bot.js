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
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const setup_1 = require("./db/setup");
const gameSearch_1 = require("./utils/gameSearch");
const downloadHandler_1 = require("./utils/downloadHandler");
dotenv_1.default.config();
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.DirectMessages
    ],
    partials: [discord_js_1.Partials.Channel] // Correct way to specify partials
});
client.once('ready', () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log(`Logged in as ${(_a = client.user) === null || _a === void 0 ? void 0 : _a.tag}`);
    const db = yield (0, setup_1.setupDatabase)();
    const lastRow = yield db.get('SELECT thread_name FROM request_thread ORDER BY id DESC LIMIT 1');
    if (lastRow) {
        const gameName = lastRow ? lastRow.thread_name : '';
        (0, downloadHandler_1.setupMessageListener)(client, gameName);
    }
}));
const checkForNewThreads = (thread) => __awaiter(void 0, void 0, void 0, function* () {
    // TODO Add tag selection and only choose games tag
    if (thread.name.includes('MP') || thread.name.includes('Multiplayer')) {
        console.log('Multiplayer request detected, skipping...');
        return;
    }
    const db = yield (0, setup_1.setupDatabase)();
    const existingThread = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
    if (!existingThread) {
        yield db.run('INSERT INTO request_thread (thread_name, thread_id) VALUES (?, ?)', thread.name, thread.id);
        console.log(`Thread ${thread.name} has been saved.`);
        yield (0, gameSearch_1.searchGame)(thread.name, thread, client);
    }
});
client.on('threadCreate', (thread) => {
    if (thread.parentId === process.env.REQUEST_CHANNEL_ID) {
        checkForNewThreads(thread);
    }
});
client.on('threadDelete', (thread) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, setup_1.setupDatabase)();
    // Move the thread to the archived table
    const threadData = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
    if (threadData) {
        yield db.run(`
            INSERT INTO archived_thread (thread_name, thread_id, link, password)
            VALUES (?, ?, ?, ?)
        `, threadData.thread_name, threadData.thread_id, threadData.link, threadData.password);
        yield db.run('DELETE FROM request_thread WHERE thread_id = ?', thread.id);
        console.log(`Thread ${thread.name} has been archived.`);
    }
}));
client.login(process.env.DISCORD_TOKEN);
