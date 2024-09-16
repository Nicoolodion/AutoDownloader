import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { setupDatabase } from '../db/setup';
import axios from 'axios';
import { Client, ChannelType, EmbedBuilder } from 'discord.js';
import { threadId } from 'worker_threads';
import { processNextDlc } from './fileWatcher';

config(); // Load .env variables

const Temp_DOWNLOAD_DIR = process.env.TEMP_DIR || './temp_downloads';

export async function downloadHandler(client: Client, gameLink: string, userId: string, gameName: string, thread: any) {
    const downloadUrl = `${gameLink}#link_download`;

    const response = await axios.get(downloadUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        },
    });

    const password = response.data.match(/Filecrypt folder password:\s*(\d{3})/)?.[1] || null;
    if (!password) {
        console.error('Password not found on the page.');
        return;
    }

    // Save the password in the SQLite database
    const db = await setupDatabase();
    const lastRow = await db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread);
    if (lastRow) {
        await db.run('UPDATE request_thread SET password = ? WHERE id = ?', password, lastRow.id);
    } else {
        await db.run('INSERT INTO request_thread (password) VALUES (?)', password);
    }

    // Search for Google Drive link
    const googleDriveLink = response.data.match(/<a\s+href="([^"]+)"\s+data-wpel-link="external"\s+target="_blank"\s+rel="nofollow noopener">GOOGLE DRIVE<\/a>/)?.[1] || null;
    if (!googleDriveLink) {
        console.error('Google Drive link not found.');
        return;
    }
    
    // Send DM to the user with the password and Google Drive link
    const user = await client.users.fetch(userId);
    if (user) {
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('Please download and send back the .dlc file')
            .setDescription(`Link: ${googleDriveLink}\nPassword: ${password}`)
            .setFooter({ text: 'Thanks for your contribution' })
            .setTimestamp();
        await user.send({ embeds: [embed] });
        console.log("client" + client);
        console.log("threadID" + thread);
        console.log("gameLink" + gameName);
        setupMessageListener(client, thread, gameName);
    }
}

// Global message listener for the bot to detect DM file uploads
export function setupMessageListener(client: Client, threadId: string, gameName: string) {
    const downloadedFiles = new Set<string>();
    client.on('messageCreate', async (message) => {
        if (message.channel.type === ChannelType.DM && message.attachments.size > 0) {
            const dlcAttachment = message.attachments.find((attachment) => attachment.name?.endsWith('.dlc'));

            if (dlcAttachment && dlcAttachment.size < 7 * 1024) {
                const date = new Date();
                const day = `0${date.getDate()}`.slice(-2);
                const month = `0${date.getMonth() + 1}`.slice(-2);
                const username = message.author.username;
                const newFileName = `${gameName}_${username}_${day}_${month}.dlc`;
                const filePath = path.join(Temp_DOWNLOAD_DIR, newFileName);

                if (downloadedFiles.has(newFileName)) {
                    console.log(`DLC file ${newFileName} has already been downloaded.`);
                    return;
                }

                downloadedFiles.add(newFileName);

                const writer = fs.createWriteStream(filePath);
                const dlcResponse = await axios({
                    url: dlcAttachment.url,
                    method: 'GET',
                    responseType: 'stream',
                });

                dlcResponse.data.pipe(writer);

                writer.on('finish', async () => {
                    processNextDlc()
                    console.log('DLC file downloaded successfully.');

                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('DLC File Uploaded')
                        .setDescription('The DLC file has been successfully uploaded and saved.')
                        .setFooter({ text: 'Thanks for your contribution' })
                        .setTimestamp();

                    message.author.send({ embeds: [embed] });
                });

                writer.on('error', (error) => {
                    console.error('Error downloading the DLC file:', error);
                    message.author.send('An error occurred while downloading the DLC file.');
                });
            } else if (dlcAttachment && dlcAttachment.size > 7 * 1024) {
                message.author.send('The DLC file is larger than 7KB. Please report this issue to @nicoolodion. Although I am pretty sure that these files never go that large ;)')
            }
        }
    });
}
