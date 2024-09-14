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
dotenv_1.default.config();
const WORKING_DOWNLOADS = 'C:\\Users\\niki1\\OneDrive - HTL Wels\\projects\\PirateBot\\download_working';
const UPLOADING_DRIVE = process.env.UPLOADING_DRIVE || '';
const CG_ADWARE = process.env.CG_ADWARE || '';
const WINRAR_PATH = 'C:\\Program Files\\WinRAR\\WinRAR.exe'; // Set this to the full path of your WinRAR installation
function setupFileWatcher() {
    const watcher = chokidar_1.default.watch(WORKING_DOWNLOADS, { persistent: true, ignoreInitial: true, depth: 1 });
    watcher.on('addDir', (dirPath) => __awaiter(this, void 0, void 0, function* () {
        try {
            // Ensure we're only processing directories within WORKING_DOWNLOADS
            if (!dirPath.startsWith(WORKING_DOWNLOADS))
                return;
            const folderName = path_1.default.basename(dirPath);
            if (folderName === '.git')
                return;
            const files = yield promises_1.default.readdir(dirPath);
            const isoFiles = files.filter(file => file.endsWith('.iso'));
            if (isoFiles.length > 0) {
                for (const isoFile of isoFiles) {
                    const isoPath = path_1.default.join(dirPath, isoFile);
                    const newIsoPath = path_1.default.join(dirPath, `${folderName}.iso`);
                    yield promises_1.default.rename(isoPath, newIsoPath);
                    yield promises_1.default.rename(newIsoPath, path_1.default.join(UPLOADING_DRIVE, `${folderName}.iso`));
                }
            }
            else if (files.length > 0) {
                const wwwFile = files.find(file => file.toUpperCase() === 'WWW.OVAGAMES.COM');
                const readmeFile = files.find(file => file.toUpperCase() === 'README.TXT');
                if (wwwFile) {
                    yield promises_1.default.unlink(path_1.default.join(dirPath, wwwFile));
                }
                if (readmeFile) {
                    yield promises_1.default.unlink(path_1.default.join(dirPath, readmeFile));
                }
                // Check if CG_ADWARE exists and is readable
                try {
                    const adwareFiles = yield promises_1.default.readdir(CG_ADWARE);
                    if (adwareFiles.length === 0) {
                        console.log(`No files found in CG_ADWARE`);
                    }
                    for (const adwareFile of adwareFiles) {
                        const adwareFilePath = path_1.default.join(CG_ADWARE, adwareFile);
                        const destinationPath = path_1.default.join(path_1.default.dirname(dirPath), adwareFile); // Move to parent folder
                        yield promises_1.default.copyFile(adwareFilePath, destinationPath);
                    }
                }
                catch (error) {
                    console.error(`Error reading or moving files from CG_ADWARE: ${error}`);
                }
                // Use the full path to WinRAR
                const rarFilePath = path_1.default.join(UPLOADING_DRIVE, `${folderName}.rar`);
                const rarCommand = `"${WINRAR_PATH}" a -ep1 -r -m1 -ibck "${rarFilePath}" "${path_1.default.dirname(dirPath)}\\*"`;
                (0, child_process_1.exec)(rarCommand, (error, stdout, stderr) => __awaiter(this, void 0, void 0, function* () {
                    if (error) {
                        console.error(`Error creating RAR: ${stderr}`);
                    }
                    else {
                        try {
                            yield promises_1.default.rmdir(dirPath, { recursive: true });
                            // Fetch message_id from database
                            const db = yield (0, setup_1.setupDatabase)();
                            const row = yield db.get('SELECT * FROM request_thread WHERE thread_name = ?', folderName);
                            if (row) {
                                const channel = yield bot_1.client.channels.fetch(row.thread_id);
                                if (channel && channel.isTextBased()) {
                                    const message = yield channel.messages.fetch(row.message_id);
                                    if (message) {
                                        yield message.reactions.removeAll(); // Remove old reactions
                                        yield message.react('✅'); // React with "done" emoji
                                    }
                                }
                            }
                        }
                        catch (deleteError) {
                            console.error(`Error deleting directory ${dirPath}:`, deleteError);
                        }
                    }
                }));
            }
        }
        catch (error) {
            console.error(`Error processing folder ${dirPath}:`, error);
        }
    }));
}
