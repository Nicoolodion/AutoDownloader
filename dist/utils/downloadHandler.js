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
exports.downloadHandler = downloadHandler;
exports.setupMessageListener = setupMessageListener;
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const setup_1 = require("../db/setup");
const axios_1 = __importDefault(require("axios"));
const discord_js_1 = require("discord.js");
const fileWatcher_1 = require("./fileWatcher");
(0, dotenv_1.config)(); // Load .env variables
const Temp_DOWNLOAD_DIR = process.env.TEMP_DIR || './temp_downloads';
function downloadHandler(client, gameLink, userId, gameName, thread) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const downloadUrl = `${gameLink}#link_download`;
        const response = yield axios_1.default.get(downloadUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            },
        });
        const password = ((_a = response.data.match(/Filecrypt folder password:\s*(\d{3})/)) === null || _a === void 0 ? void 0 : _a[1]) || null;
        if (!password) {
            console.error('Password not found on the page.');
            return;
        }
        // Save the password in the SQLite database
        const db = yield (0, setup_1.setupDatabase)();
        const lastRow = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread);
        if (lastRow) {
            yield db.run('UPDATE request_thread SET password = ? WHERE id = ?', password, lastRow.id);
        }
        else {
            yield db.run('INSERT INTO request_thread (password) VALUES (?)', password);
        }
        // Search for Google Drive link
        const googleDriveLink = ((_b = response.data.match(/<a\s+href="([^"]+)"\s+data-wpel-link="external"\s+target="_blank"\s+rel="nofollow noopener">GOOGLE DRIVE<\/a>/)) === null || _b === void 0 ? void 0 : _b[1]) || null;
        if (!googleDriveLink) {
            console.error('Google Drive link not found.');
            return;
        }
        // Send DM to the user with the password and Google Drive link
        const user = yield client.users.fetch(userId);
        if (user) {
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Please download and send back the .dlc file')
                .setDescription(`Link: ${googleDriveLink}\nPassword: ${password}`)
                .setFooter({ text: 'Thanks for your contribution' })
                .setTimestamp();
            yield user.send({ embeds: [embed] });
            console.log("client" + client);
            console.log("threadID" + thread);
            console.log("gameLink" + gameName);
            setupMessageListener(client, thread, gameName);
        }
    });
}
// Global message listener for the bot to detect DM file uploads
function setupMessageListener(client, threadId, gameName) {
    const downloadedFiles = new Set();
    client.on('messageCreate', (message) => __awaiter(this, void 0, void 0, function* () {
        if (message.channel.type === discord_js_1.ChannelType.DM && message.attachments.size > 0) {
            const dlcAttachment = message.attachments.find((attachment) => { var _a; return (_a = attachment.name) === null || _a === void 0 ? void 0 : _a.endsWith('.dlc'); });
            if (dlcAttachment && dlcAttachment.size < 7 * 1024) {
                const date = new Date();
                const day = `0${date.getDate()}`.slice(-2);
                const month = `0${date.getMonth() + 1}`.slice(-2);
                const username = message.author.username;
                const newFileName = `${gameName}_${username}_${day}_${month}.dlc`;
                const filePath = path_1.default.join(Temp_DOWNLOAD_DIR, newFileName);
                if (downloadedFiles.has(newFileName)) {
                    console.log(`DLC file ${newFileName} has already been downloaded.`);
                    return;
                }
                downloadedFiles.add(newFileName);
                const writer = fs_1.default.createWriteStream(filePath);
                const dlcResponse = yield (0, axios_1.default)({
                    url: dlcAttachment.url,
                    method: 'GET',
                    responseType: 'stream',
                });
                dlcResponse.data.pipe(writer);
                writer.on('finish', () => __awaiter(this, void 0, void 0, function* () {
                    (0, fileWatcher_1.processNextDlc)();
                    console.log('DLC file downloaded successfully.');
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('DLC File Uploaded')
                        .setDescription('The DLC file has been successfully uploaded and saved.')
                        .setFooter({ text: 'Thanks for your contribution' })
                        .setTimestamp();
                    message.author.send({ embeds: [embed] });
                }));
                writer.on('error', (error) => {
                    console.error('Error downloading the DLC file:', error);
                    message.author.send('An error occurred while downloading the DLC file.');
                });
            }
            else if (dlcAttachment && dlcAttachment.size > 7 * 1024) {
                message.author.send('The DLC file is larger than 7KB. Please report this issue to @nicoolodion. Although I am pretty sure that these files never go that large ;)');
            }
        }
    }));
}
