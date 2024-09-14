import { Client, GatewayIntentBits, Partials, ThreadChannel } from 'discord.js';
import dotenv from 'dotenv';
import { setupDatabase } from './db/setup';
import { searchGame } from './utils/gameSearch';
import { setupMessageListener } from './utils/downloadHandler';
import { setupFileWatcher } from './utils/fileWatcher'; // Import the file watcher

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

  client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    const db = await setupDatabase();
    const lastRow = await db.get('SELECT thread_name FROM request_thread ORDER BY id DESC LIMIT 1');
    if (lastRow) {
        const gameName = lastRow ? lastRow.thread_name : '';
        setupMessageListener(client, gameName);
    }

    setupFileWatcher();

});


const checkForNewThreads = async (thread: ThreadChannel) => {
    // TODO Add tag selection and only choose games tag
    if (thread.name.includes('MP') || thread.name.includes('Multiplayer')) {
        console.log('Multiplayer request detected, skipping...');
        return;
    }

    const db = await setupDatabase();
    const existingThread = await db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);

    if (!existingThread) {
        await db.run('INSERT INTO request_thread (thread_name, thread_id) VALUES (?, ?)', thread.name, thread.id);
        console.log(`Thread ${thread.name} has been saved.`);
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
            INSERT INTO archived_thread (thread_name, thread_id, link, password, message_id)
            VALUES (?, ?, ?, ?, ?)
        `, threadData.thread_name, threadData.thread_id, threadData.link, threadData.password, threadData.message_id);

        await db.run('DELETE FROM request_thread WHERE thread_id = ?', thread.id);
        console.log(`Thread ${thread.name} has been archived.`);
    }
});


client.login(process.env.DISCORD_TOKEN);

