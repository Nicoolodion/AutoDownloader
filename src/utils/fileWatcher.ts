import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { setupDatabase } from '../db/setup';
import { client } from '../bot';
dotenv.config();

const WORKING_DOWNLOADS = 'C:\\Users\\niki1\\OneDrive - HTL Wels\\projects\\PirateBot\\download_working';
const UPLOADING_DRIVE = process.env.UPLOADING_DRIVE || '';
const CG_ADWARE = process.env.CG_ADWARE || '';
const WINRAR_PATH = 'C:\\Program Files\\WinRAR\\WinRAR.exe'; // Set this to the full path of your WinRAR installation

export function setupFileWatcher() {
    const watcher = chokidar.watch(WORKING_DOWNLOADS, { persistent: true, ignoreInitial: true, depth: 1 });

    watcher.on('addDir', async (dirPath) => {
        try {
            // Ensure we're only processing directories within WORKING_DOWNLOADS
            if (!dirPath.startsWith(WORKING_DOWNLOADS)) return;

            const folderName = path.basename(dirPath);
            if (folderName === '.git') return;

            const files = await fs.readdir(dirPath);
            const isoFiles = files.filter(file => file.endsWith('.iso'));

            if (isoFiles.length > 0) {
                for (const isoFile of isoFiles) {
                    const isoPath = path.join(dirPath, isoFile);
                    const newIsoPath = path.join(dirPath, `${folderName}.iso`);
                    await fs.rename(isoPath, newIsoPath);

                    await fs.rename(newIsoPath, path.join(UPLOADING_DRIVE, `${folderName}.iso`));
                }
            } else if (files.length > 0) {
                const wwwFile = files.find(file => file.toUpperCase() === 'WWW.OVAGAMES.COM');
                const readmeFile = files.find(file => file.toUpperCase() === 'README.TXT');

                if (wwwFile) {
                    await fs.unlink(path.join(dirPath, wwwFile));
                }

                if (readmeFile) {
                    await fs.unlink(path.join(dirPath, readmeFile));
                }

                // Check if CG_ADWARE exists and is readable
                try {
                    const adwareFiles = await fs.readdir(CG_ADWARE);
                    if (adwareFiles.length === 0) {
                        console.log(`No files found in CG_ADWARE`);
                    }
                    
                    for (const adwareFile of adwareFiles) {
                        const adwareFilePath = path.join(CG_ADWARE, adwareFile);
                        const destinationPath = path.join(path.dirname(dirPath), adwareFile); // Move to parent folder
                        await fs.copyFile(adwareFilePath, destinationPath);
                    }
                } catch (error) {
                    console.error(`Error reading or moving files from CG_ADWARE: ${error}`);
                }

                // Use the full path to WinRAR
                const rarFilePath = path.join(UPLOADING_DRIVE, `${folderName}.rar`);
                const rarCommand = `"${WINRAR_PATH}" a -ep1 -r -m1 -ibck "${rarFilePath}" "${path.dirname(dirPath)}\\*"`;

                exec(rarCommand, async (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error creating RAR: ${stderr}`);
                    } else {
                        try {
                            await fs.rmdir(dirPath, { recursive: true });

                            // Fetch message_id from database
                            const db = await setupDatabase();
                            const row = await db.get('SELECT * FROM request_thread WHERE thread_name = ?', folderName);
                            if (row) {
                                const channel = await client.channels.fetch(row.thread_id);
                                if (channel && channel.isTextBased()) {
                                    const message = await channel.messages.fetch(row.message_id);
                                    if (message) {
                                        await message.reactions.removeAll(); // Remove old reactions
                                        await message.react('✅'); // React with "done" emoji
                                    }
                                }
                            }
                        } catch (deleteError) {
                            console.error(`Error deleting directory ${dirPath}:`, deleteError);
                        }



                    }
                });
            }
        } catch (error) {
            console.error(`Error processing folder ${dirPath}:`, error);
        }
    });
}
