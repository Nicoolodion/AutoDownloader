"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadGame = downloadGame;
exports.handleDownloadedFiles = handleDownloadedFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
function downloadGame(link) {
    (0, child_process_1.exec)(`${process.env.JDOWNLOADER_PATH} --add-link ${link}`, (err) => {
        if (err) {
            console.error('Error with JDownloader:', err);
        }
        else {
            console.log('Download started.');
        }
    });
}
function handleDownloadedFiles(gameName) {
    const downloadDir = process.env.DOWNLOAD_DIR;
    const uploadDir = process.env.UPLOAD_DIR;
    const gameFolder = path_1.default.join(uploadDir, gameName);
    if (!fs_1.default.existsSync(gameFolder)) {
        fs_1.default.mkdirSync(gameFolder);
    }
    const isoFile = findIsoFile(downloadDir);
    if (isoFile) {
        fs_1.default.renameSync(isoFile, path_1.default.join(gameFolder, path_1.default.basename(isoFile)));
        console.log(`Moved ISO to: ${gameFolder}`);
    }
}
function findIsoFile(dir) {
    const files = fs_1.default.readdirSync(dir);
    return files.find(file => file.endsWith('.iso')) || null;
}
