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
            message_id TEXT
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
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    return db;
}
