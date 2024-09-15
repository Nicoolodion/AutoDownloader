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
exports.setupFileWatcher = setupFileWatcher;
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
const setup_1 = require("../db/setup");
const bot_1 = require("../bot");
const discord_js_1 = require("discord.js");
dotenv_1.default.config();
const WORKING_DOWNLOADS = 'C:\\Users\\niki1\\OneDrive - HTL Wels\\projects\\PirateBot\\download_working';
const UPLOADING_DRIVE = process.env.UPLOADING_DRIVE || '';
const CG_ADWARE = process.env.CG_ADWARE || '';
const WINRAR_PATH = 'C:\\Program Files\\WinRAR\\WinRAR.exe'; // Set this to the full path of your WinRAR installation
// Debounce settings
const DEBOUNCE_DELAY = 10000; // 5 seconds delay to wait after the last change
// Map to track the last modification time for each directory
const lastModificationTimes = new Map();
// Set to track processed directories
const processedDirectories = new Set();
function setupFileWatcher() {
    const watcher = chokidar_1.default.watch(WORKING_DOWNLOADS, { persistent: true, ignoreInitial: true, depth: 1 });
    watcher.on('all', (event, dirPath) => __awaiter(this, void 0, void 0, function* () {
        if (event === 'addDir' || event === 'unlinkDir') {
            const now = Date.now();
            lastModificationTimes.set(dirPath, now);
            // Schedule processing after the debounce delay
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                if (lastModificationTimes.get(dirPath) === now) {
                    yield processDirectory(dirPath);
                }
            }), DEBOUNCE_DELAY);
        }
    }));
}
function processDirectory(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check if the directory has already been processed
        if (processedDirectories.has(dirPath)) {
            console.log(`Directory ${dirPath} has already been processed.`);
            return;
        }
        try {
            if (!dirPath.startsWith(WORKING_DOWNLOADS))
                return;
            // Check if the directory still exists
            try {
                yield promises_1.default.access(dirPath);
            }
            catch (_a) {
                console.log(`Directory ${dirPath} does not exist.`);
                return;
            }
            const folderName = path_1.default.basename(dirPath);
            if (folderName === '.git')
                return;
            const files = yield promises_1.default.readdir(dirPath);
            // Check if the folder is empty
            if (files.length === 0) {
                console.log(`Directory ${dirPath} is empty. Skipping.`);
                return; // Skip empty directories
            }
            console.log(files);
            const partFiles = files.filter(file => file.endsWith('.part'));
            if (partFiles.length > 0) {
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    yield processDirectory(dirPath);
                }), 30000);
                return;
            }
            const partFiles2 = files.filter(file => file.endsWith('.rar'));
            if (partFiles2.length > 0) {
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    yield processDirectory(dirPath);
                }), 250000);
                return;
            }
            const isoFiles = files.filter(file => file.endsWith('.iso'));
            if (isoFiles.length > 0) {
                for (const isoFile of isoFiles) {
                    const isoPath = path_1.default.join(dirPath, isoFile);
                    const newIsoPath = path_1.default.join(dirPath, `${folderName}.iso`);
                    yield promises_1.default.rename(isoPath, newIsoPath);
                    yield promises_1.default.rename(newIsoPath, path_1.default.join(UPLOADING_DRIVE, `${folderName}.iso`));
                    yield new Promise(resolve => setTimeout(resolve, 7000));
                    const db = yield (0, setup_1.setupDatabase)();
                    const row = yield db.get('SELECT id FROM request_thread WHERE thread_id = (SELECT thread_id FROM request_thread ORDER BY id DESC LIMIT 1)');
                    if (row) {
                        yield db.run('UPDATE request_thread SET rar_name = ? WHERE id = ?', folderName, row.id);
                    }
                    else {
                        console.error('No thread found with the latest id');
                    }
                    try {
                        yield deleteDirectoryWithRetry(dirPath);
                        processedDirectories.add(dirPath);
                        const row = yield db.get('SELECT * FROM request_thread WHERE rar_name = ?', folderName);
                        if (row) {
                            const channel = yield bot_1.client.channels.fetch(row.thread_id);
                            if (channel && channel.isTextBased()) {
                                const message = yield channel.messages.fetch(row.message_id);
                                if (message) {
                                    if (channel.isThread()) {
                                        const parentMessage = yield channel.fetchStarterMessage(); // For threads, this fetches the original message
                                        // React to the parent message with the uploading emoji
                                        if (parentMessage) {
                                            // Replace with your actual uploading emoji
                                            yield parentMessage.reactions.removeAll();
                                            yield parentMessage.react('✅');
                                        }
                                    }
                                    const row = yield db.get('SELECT user_id FROM request_thread WHERE thread_id = ?', channel.id);
                                    if (row) {
                                        const user = yield bot_1.client.users.fetch(row.user_id);
                                        if (user) {
                                            yield message.edit({
                                                embeds: [new discord_js_1.EmbedBuilder()
                                                        .setDescription(`${message.content}\n\n**Uploaded!**\n${user} your game has been uploaded and is now available for download.`)
                                                        .setColor('#00FF00') // Green
                                                        .setTimestamp()]
                                            });
                                            if (message.channel.isTextBased()) {
                                                const textChannel = message.channel;
                                                const pingMessage = yield textChannel.send(`<@${row.user_id}>`);
                                                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                                    yield pingMessage.delete();
                                                }), 10);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch (deleteError) {
                        console.error(`Error deleting directory ${dirPath}:`, deleteError);
                    }
                    try {
                        yield deleteDirectoryWithRetry(dirPath);
                        processedDirectories.add(dirPath);
                        console.log(`Directory ${dirPath} processed and cleaned up.`);
                    }
                    catch (deleteError) {
                        console.error(`Error deleting directory ${dirPath}:`, deleteError);
                    }
                }
            }
            else if (files.length > 0) {
                const wwwFile = files.find(file => file.toUpperCase() === 'WWW.OVAGAMES.COM' || file.toUpperCase() === 'WWW.OVAGAMES.COM.URL');
                const readmeFile = files.find(file => file.toUpperCase() === 'README.TXT');
                if (wwwFile) {
                    yield promises_1.default.unlink(path_1.default.join(dirPath, wwwFile));
                }
                if (readmeFile) {
                    yield promises_1.default.unlink(path_1.default.join(dirPath, readmeFile));
                }
                try {
                    const adwareFiles = yield promises_1.default.readdir(CG_ADWARE);
                    if (adwareFiles.length === 0) {
                        console.log(`No files found in CG_ADWARE`);
                    }
                    for (const adwareFile of adwareFiles) {
                        const adwareFilePath = path_1.default.join(CG_ADWARE, adwareFile);
                        const destinationPath = path_1.default.join(path_1.default.dirname(dirPath), adwareFile);
                        yield promises_1.default.copyFile(adwareFilePath, destinationPath);
                    }
                }
                catch (error) {
                    console.error(`Error reading or moving files from CG_ADWARE: ${error}`);
                }
                const rarFilePath = path_1.default.join(UPLOADING_DRIVE, `${folderName}.rar`);
                const rarCommand = `"${WINRAR_PATH}" a -ep1 -r -m1 -ibck "${rarFilePath}" "${path_1.default.dirname(dirPath)}\\*"`;
                // TODO: PRODUCTION
                yield new Promise(resolve => setTimeout(resolve, 7000));
                const db = yield (0, setup_1.setupDatabase)();
                const row = yield db.get('SELECT id FROM request_thread WHERE thread_id = (SELECT thread_id FROM request_thread ORDER BY id DESC LIMIT 1)');
                if (row) {
                    yield db.run('UPDATE request_thread SET rar_name = ? WHERE id = ?', folderName, row.id);
                }
                else {
                    console.error('No thread found with the latest id');
                }
                (0, child_process_1.exec)(rarCommand, (error, stdout, stderr) => __awaiter(this, void 0, void 0, function* () {
                    if (error) {
                        console.error(`Error creating RAR: ${stderr}`);
                    }
                    else {
                        console.log(`RAR created successfully: ${stdout}`);
                    }
                    try {
                        yield deleteDirectoryWithRetry(dirPath);
                        processedDirectories.add(dirPath);
                        const row = yield db.get('SELECT * FROM request_thread WHERE rar_name = ?', folderName);
                        if (row) {
                            const channel = yield bot_1.client.channels.fetch(row.thread_id);
                            if (channel && channel.isTextBased()) {
                                const message = yield channel.messages.fetch(row.message_id);
                                if (message) {
                                    if (channel.isThread()) {
                                        const parentMessage = yield channel.fetchStarterMessage(); // For threads, this fetches the original message
                                        // React to the parent message with the uploading emoji
                                        if (parentMessage) {
                                            // Replace with your actual uploading emoji
                                            yield parentMessage.reactions.removeAll();
                                            yield parentMessage.react('✅');
                                        }
                                    }
                                    const row = yield db.get('SELECT user_id FROM request_thread WHERE thread_id = ?', channel.id);
                                    if (row) {
                                        const user = yield bot_1.client.users.fetch(row.user_id);
                                        if (user) {
                                            yield message.edit({
                                                embeds: [new discord_js_1.EmbedBuilder()
                                                        .setDescription(`${message.content}\n\n**Uploaded!**\n${user} your game has been uploaded and is now available for download.`)
                                                        .setColor('#00FF00') // Green
                                                        .setTimestamp()]
                                            });
                                            if (message.channel.isTextBased()) {
                                                const textChannel = message.channel;
                                                const pingMessage = yield textChannel.send(`<@${row.user_id}>`);
                                                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                                    yield pingMessage.delete();
                                                }), 10);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch (deleteError) {
                        console.error(`Error deleting directory ${dirPath}:`, deleteError);
                    }
                    try {
                        yield deleteDirectoryWithRetry(dirPath);
                        processedDirectories.add(dirPath);
                        console.log(`Directory ${dirPath} processed and cleaned up.`);
                    }
                    catch (deleteError) {
                        console.error(`Error deleting directory ${dirPath}:`, deleteError);
                    }
                }));
            }
        }
        catch (error) {
            console.error(`Error processing folder ${dirPath}:`, error);
        }
    });
}
function deleteDirectoryWithRetry(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                yield new Promise((resolve) => setTimeout(resolve, 60000));
                yield promises_1.default.rm(dirPath, { recursive: true, force: true });
                console.log(`Directory deleted: ${dirPath}`);
                processedDirectories.delete(dirPath);
                break;
            }
            catch (error) {
                const typedError = error;
                // Rest of the code
            }
        }
    });
}
