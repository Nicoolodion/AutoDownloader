import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { setupDatabase } from '../db/setup';
import { client } from '../bot';
import { EmbedBuilder, TextChannel } from 'discord.js';
dotenv.config();



const WORKING_DOWNLOADS = 'C:\\Users\\niki1\\OneDrive - HTL Wels\\projects\\PirateBot\\download_working';
const UPLOADING_DRIVE = process.env.UPLOADING_DRIVE || '';
const CG_ADWARE = process.env.CG_ADWARE || '';
const WINRAR_PATH = 'C:\\Program Files\\WinRAR\\WinRAR.exe'; // Set this to the full path of your WinRAR installation
const Temp_DOWNLOAD_DIR = process.env.TEMP_DIR || './temp_downloads';
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || './downloads';

//keep at false. starts the first download by moving the dlc file
let processing = false;


// Debounce settings
const DEBOUNCE_DELAY = 10000; // 5 seconds delay to wait after the last change

// Map to track the last modification time for each directory
const lastModificationTimes = new Map<string, number>();

// Set to track processed directories
const processedDirectories = new Set<string>();

export async function processNextDlc() {
    if (!processing) {
        const files = await fs.readdir(Temp_DOWNLOAD_DIR);
        const dlcFiles = files.filter((file) => file.endsWith('.dlc'));
        if (dlcFiles.length === 0) {
            return;
        }
        const dlcFile = dlcFiles[0];
        const newFilePath = path.join(DOWNLOAD_DIR, dlcFile);
        await fs.rename(path.join(Temp_DOWNLOAD_DIR, dlcFile), newFilePath);
        processing = true;
        console.log(`Moved .dlc file to ${DOWNLOAD_DIR}: ${dlcFile}`);

        // Remove the moved file from the list to prevent it from being processed again
        const index = dlcFiles.indexOf(dlcFile);
        if (index > -1) {
            dlcFiles.splice(index, 1);
        }

    }
}


export function setupFileWatcher(exportedThread: any) {
    const watcher = chokidar.watch(WORKING_DOWNLOADS, { persistent: true, ignoreInitial: true, depth: 1 });

    watcher.on('all', async (event, dirPath) => {
        if (event === 'addDir' || event === 'unlinkDir') {
            const now = Date.now();
            lastModificationTimes.set(dirPath, now);

            // Schedule processing after the debounce delay
            setTimeout(async () => {
                if (lastModificationTimes.get(dirPath) === now) {

                    await processDirectory(dirPath, exportedThread);
                }
            }, DEBOUNCE_DELAY);
        }
    });
}

async function processDirectory(dirPath: string, exportedThread: any) {
    // Check if the directory has already been processed
    if (processedDirectories.has(dirPath)) {
        //console.log(`Directory ${dirPath} has already been processed.`);
        return;
    }

    try {
        if (!dirPath.startsWith(WORKING_DOWNLOADS)) return;

        // Check if the directory still exists
        try {
            await fs.access(dirPath);
        } catch {
            //console.log(`Directory ${dirPath} does not exist.`);
            return;
        }

        const folderName = path.basename(dirPath);
        if (folderName === '.git') return;

        const files = await fs.readdir(dirPath);

        // Check if the folder is empty
        if (files.length === 0) {
            console.log(`Directory ${dirPath} is empty. Skipping.`);
            return; // Skip empty directories
        }

        const partFiles = files.filter(file => file.endsWith('.part'));
        if (partFiles.length > 0) {
            setTimeout(async () => {
                await processDirectory(dirPath, exportedThread);
            }, 30000);
            return;
        }

        const partFiles2 = files.filter(file => file.endsWith('.rar'));
        if (partFiles2.length > 0) {
            setTimeout(async () => {
                await processDirectory(dirPath, exportedThread);
            }, 250000);
            return;
        }

        

        const isoFiles = files.filter(file => file.endsWith('.iso'));
        if (isoFiles.length > 0) {
            for (const isoFile of isoFiles) {
                const isoPath = path.join(dirPath, isoFile);
                const newIsoPath = path.join(dirPath, `${folderName}.iso`);
                await fs.rename(isoPath, newIsoPath);
                await fs.rename(newIsoPath, path.join(UPLOADING_DRIVE, `${folderName}.iso`));

                await new Promise(resolve => setTimeout(resolve, 7000));
                const db = await setupDatabase();
    
                const row = await db.get('SELECT id FROM request_thread WHERE thread_id = ?', exportedThread.id);
                console.log("exported: \n" + exportedThread.id)
                console.log("rowID \n" +row.id)
                if (row) {
                    await db.run('UPDATE request_thread SET rar_name = ? WHERE id = ?', folderName, row.id);
                } else {
                    console.error('No thread found with the latest id');
                }

            try {
                await deleteDirectoryWithRetry(dirPath);
                processedDirectories.add(dirPath);

                processing = false;
                processNextDlc()

                const row = await db.get('SELECT * FROM request_thread WHERE rar_name = ?', folderName);
                if (row) {
                    const channel = await client.channels.fetch(row.thread_id);
                    if (channel && channel.isTextBased()) {
                        const message = await channel.messages.fetch(row.message_id);
                        if (message) {
                            if (channel.isThread()) {
                                const parentMessage = await channel.fetchStarterMessage(); // For threads, this fetches the original message
                                // React to the parent message with the uploading emoji
                                if (parentMessage) {
                                    // Replace with your actual uploading emoji
                                    await parentMessage.reactions.removeAll();
                                    await parentMessage.react('✅');
                                }
                            }

                            const row = await db.get('SELECT user_id FROM request_thread WHERE thread_id = ?', channel.id);
                            if (row) {
                                const user = await client.users.fetch(row.user_id);
                                if (user) {
                                    await message.edit({
                                        embeds: [new EmbedBuilder()
                                            .setDescription(`${message.content}\n\n**Uploaded!**\n${user} your game has been uploaded and is now available for download.`)
                                            .setColor('#00FF00') // Green
                                            .setTimestamp()]
                                    });
                                    if (message.channel.isTextBased()) {
                                        const textChannel = message.channel as TextChannel;
                                        const pingMessage = await textChannel.send(`<@${row.user_id}>`);
                                        setTimeout(async () => {
                                          await pingMessage.delete();
                                        }, 10);
                                      }
                                }
                            }
                        }
                    }
                }
            } catch (deleteError) {
                console.error(`Error deleting directory ${dirPath}:`, deleteError);
            }
            try {
                await deleteDirectoryWithRetry(dirPath);
                processedDirectories.add(dirPath);
                console.log(`Directory ${dirPath} processed and cleaned up.`);
            } catch (deleteError) {
                console.error(`Error deleting directory ${dirPath}:`, deleteError);
            }
    


            }
        } else if (files.length > 0) {
            const wwwFile = files.find(file => file.toUpperCase() === 'WWW.OVAGAMES.COM' || file.toUpperCase() === 'WWW.OVAGAMES.COM.URL');
            const readmeFile = files.find(file => file.toUpperCase() === 'README.TXT');

            if (wwwFile) {
                await fs.unlink(path.join(dirPath, wwwFile));
            }

            if (readmeFile) {
                await fs.unlink(path.join(dirPath, readmeFile));
            }

            try {
                const adwareFiles = await fs.readdir(CG_ADWARE);
                if (adwareFiles.length === 0) {
                    console.log(`No files found in CG_ADWARE`);
                }

                for (const adwareFile of adwareFiles) {
                    const adwareFilePath = path.join(CG_ADWARE, adwareFile);
                    const destinationPath = path.join(path.dirname(dirPath), adwareFile);
                    await fs.copyFile(adwareFilePath, destinationPath);
                }
            } catch (error) {
                console.error(`Error reading or moving files from CG_ADWARE: ${error}`);
            }
            const rarFilePath = path.join(UPLOADING_DRIVE, `${folderName}.rar`);
            const rarCommand = `"${WINRAR_PATH}" a -ep1 -r -m1 -ibck "${rarFilePath}" "${path.dirname(dirPath)}\\*"`;
            // TODO: PRODUCTION
            await new Promise(resolve => setTimeout(resolve, 7000));
            const db = await setupDatabase();
            const row = await db.get('SELECT id FROM request_thread WHERE thread_id = ?', exportedThread.id);
            console.log("exported: \n" + exportedThread.id)
            console.log("rowID \n" +row.id)
            if (row) {
                await db.run('UPDATE request_thread SET rar_name = ? WHERE id = ?', folderName, row.id);
            } else {
                console.error('No thread found with the latest id');
            }

            exec(rarCommand, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error creating RAR: ${stderr}`);
                } else {
                    console.log(`RAR created successfully: ${stdout}`);
                }

                try {
                    await deleteDirectoryWithRetry(dirPath);
                    processedDirectories.add(dirPath);

                    processing = false;
                    processNextDlc();

                    const row = await db.get('SELECT * FROM request_thread WHERE rar_name = ?', folderName);
                    console.log("ROW: \n" +row)
                    if (row) {
                        const channel = await client.channels.fetch(row.thread_id);
                        if (channel && channel.isTextBased()) {
                            const message = await channel.messages.fetch(row.message_id);
                            if (message) {
                                if (channel.isThread()) {
                                    const parentMessage = await channel.fetchStarterMessage(); // For threads, this fetches the original message
                                    // React to the parent message with the uploading emoji
                                    if (parentMessage) {
                                        // Replace with your actual uploading emoji
                                        await parentMessage.reactions.removeAll();
                                        await parentMessage.react('✅');
                                    }
                                }

                                const row = await db.get('SELECT user_id FROM request_thread WHERE thread_id = ?', exportedThread.id);
                                if (row) {
                                    const user = await client.users.fetch(row.user_id);
                                    if (user) {
                                        console.log("\n MESSAGE\n" + message)
                                        await message.edit({
                                            embeds: [new EmbedBuilder()
                                                .setDescription(`${message.content}\n\n**Uploaded!**\n${user} your game has been uploaded and is now available for download.`)
                                                .setColor('#00FF00') // Green
                                                .setTimestamp()]
                                        });
                                        if (message.channel.isTextBased()) {
                                            const textChannel = message.channel as TextChannel;
                                            const pingMessage = await textChannel.send(`<@${row.user_id}>`);
                                            setTimeout(async () => {
                                              await pingMessage.delete();
                                            }, 10);
                                          }
                                    }
                                }
                            }
                        }
                    }
                } catch (deleteError) {
                    console.error(`Error deleting directory ${dirPath}:`, deleteError);
                }
                try {
                    await deleteDirectoryWithRetry(dirPath);
                    processedDirectories.add(dirPath);
                    console.log(`Directory ${dirPath} processed and cleaned up.`);
                } catch (deleteError) {
                    console.error(`Error deleting directory ${dirPath}:`, deleteError);
                }
            });
        }
    } catch (error) {
        console.error(`Error processing folder ${dirPath}:`, error);
    }
}

async function deleteDirectoryWithRetry(dirPath: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            await new Promise((resolve) => setTimeout(resolve, 20000));
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`Directory deleted: ${dirPath}`);
            processedDirectories.delete(dirPath);
            break;
        } catch (error) {
            const typedError = error as NodeJS.ErrnoException;
            // Rest of the code
        }
    }
}
