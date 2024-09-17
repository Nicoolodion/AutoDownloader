import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function setupDatabase() {
    const db = await open({
        filename: './request_threads.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS request_thread (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_name TEXT,
            thread_id TEXT UNIQUE,
            link TEXT,
            password TEXT CHECK(LENGTH(password) = 3),
            rar_name TEXT,
            message_id TEXT,
            user_id TEXT,
            uploader_id TEXT,
            folder_path TEXT
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS archived_thread (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_name TEXT,
            thread_id TEXT UNIQUE,
            link TEXT,
            password TEXT CHECK(LENGTH(password) = 3),
            message_id TEXT,
            rar_name TEXT,
            user_id TEXT,
            folder_path TEXT,
            uploader_id TEXT,
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    return db;
}
