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
exports.setupDatabase = setupDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
function setupDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield (0, sqlite_1.open)({
            filename: './request_threads.db',
            driver: sqlite3_1.default.Database
        });
        yield db.exec(`
        CREATE TABLE IF NOT EXISTS request_thread (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_name TEXT,
            thread_id TEXT UNIQUE,
            link TEXT,
            password TEXT CHECK(LENGTH(password) = 3),
            message_id TEXT
        )
    `);
        yield db.exec(`
        CREATE TABLE IF NOT EXISTS archived_thread (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_name TEXT,
            thread_id TEXT UNIQUE,
            link TEXT,
            password TEXT CHECK(LENGTH(password) = 3),
            message_id TEXT,
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
        return db;
    });
}
