import { ButtonBuilder, ButtonStyle, Client, ComponentType, GatewayIntentBits, Partials, ThreadChannel } from 'discord.js';
import dotenv from 'dotenv';
import { setupDatabase } from './db/setup';
import { searchGame } from './utils/gameSearch';
import { setupMessageListener } from './utils/downloadHandler';
import { setupFileWatcher } from './utils/fileWatcher'; // Import the file watcher
import { threadId } from 'worker_threads';

//TODO: Add Folder System back in. Make sure it searches if a folder already exists.
//TODO: Try a different approach not using Jdownloader... Priority low
//TODO: Make The Buttons not time out
//TODO: Optimize
//TODO: Make sure git doesn't upload any files
//TODO: Got Problems, type Help over DM. Explain what things to use for redirects.




dotenv.config();

export const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel] // Correct way to specify partials
  });

  client.once('ready', async (thread_id) => {
    console.log(`Logged in as ${client.user?.tag}`);
    const db = await setupDatabase();
    // TODO Make sure it actually works since it is just undefined at start?
    const lastRow = await db.get('SELECT thread_name FROM request_thread WHERE thread_id = ?', threadId);

    if (lastRow) {
        const gameName = lastRow ? lastRow.thread_name : '';
    }

});


const checkForNewThreads = async (thread: ThreadChannel) => {
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

    const db = await setupDatabase();
    const existingThread = await db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
    console.log(thread.id)


    if (!existingThread) {
        await db.run('INSERT INTO request_thread (thread_name, thread_id) VALUES (?, ?)', thread.name, thread.id);  
        await searchGame(thread.name, thread, client);
    }
};

client.on('threadCreate', (thread) => {
    if (thread.parentId === process.env.REQUEST_CHANNEL_ID) {
        checkForNewThreads(thread);
    }
});

client.on('threadDelete', async (thread) => {
    const db = await setupDatabase();

    // Move the thread to the archived table
    const threadData = await db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
    
    if (threadData) {
        await db.run(`
            INSERT INTO archived_thread (
                thread_name, thread_id, link, password, message_id, rar_name, user_id, folder_path, uploader_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, threadData.thread_name, threadData.thread_id, threadData.link, threadData.password, threadData.message_id, threadData.rar_name, threadData.user_id, threadData.folder_path, threadData.uploader_id);

        await db.run('DELETE FROM request_thread WHERE thread_id = ?', thread.id);
    }

});


client.login(process.env.DISCORD_TOKEN);

