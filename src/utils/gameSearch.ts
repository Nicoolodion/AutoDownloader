
import axios from 'axios';
import { ThreadChannel, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType, Client, DMChannel, GuildTextBasedChannel, MessageFlags } from 'discord.js';
import Fuse from 'fuse.js';
import { checkPermissions } from './permissions';
import { downloadHandler } from './downloadHandler'; // Adjust the path according to your project structure
import { setupDatabase } from '../db/setup';
import dotenv from 'dotenv';
import { threadId } from 'worker_threads';
import { setupFileWatcher } from './fileWatcher';

dotenv.config();
interface GameResult {
    title: string;
    link: string;
}
let exportedThread: ThreadChannel;



// Function to parse the HTML and extract game titles and links within specific structure
async function parseSearchResults(html: string): Promise<GameResult[]> {
    if (!html || typeof html !== 'string') {
        throw new Error('Invalid HTML content received');
    }

    const gameResults: GameResult[] = [];

    // Regular expression to match the relevant sections of the HTML
    const regex = /<a\s+href="([^"]+)"\s+title="Permanent Link to\s+([^"]+)"[^>]*>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
        const link = match[1].trim();
        const title = match[2].trim().replace(/ - .+$/, '')
        gameResults.push({ title, link});
    }

    return gameResults;
}

async function fetchGameDate(gameLink: string): Promise<{ date: string | null}> {
    try {

        const response = await axios.get(gameLink, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            },
        });

        // Extract the date from the JSON-like response data
        const dateMatch = response.data.match(/"dateModified":"([^"]+)"/);
        const dateString = dateMatch ? dateMatch[1].trim() : null;

        let formattedDate: string | null = null;
        if (dateString) {
            // Parse the date string to a Date object
            const date = new Date(dateString);

            // Format the date as "dd-mm-yyyy"
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
            const year = date.getFullYear();

            formattedDate = `${day}-${month}-${year}`;
        }

        if (!formattedDate) {
            console.error('Date not found on the page.');
            return { date: null};
        }

        return { date: formattedDate };
    } catch (error) {
        console.error(`Error fetching game date from ${gameLink}:`, error);
        return { date: null};
    }
}






export async function searchGame(gameName: string, thread: ThreadChannel, client: Client) {
    const searchUrl = `https://www.ovagames.com/?s=${encodeURIComponent(gameName)}&x=0&y=0`;
    try {
        const response = await axios.get(searchUrl, {
            headers: {
                'Accept': 'text/html',
            },
        });

        let html = response.data;

        const start = html.indexOf('<div class="home-post-titles">');
        const end = html.indexOf('</div>', start);

        if (start !== -1 && end !== -1) {
            html = html.substring(start, end + 6);
        } else {
            console.error('Error: Failed to extract relevant HTML');
            await thread.send(':x: Failed to fetch search results.');
            return;
        }

        const gameResults = await parseSearchResults(html);

        if (gameResults.length === 0) {
            await thread.send(':x: No matching game found.');
            return;
        }

        const fuse = new Fuse(gameResults, {
            keys: ['title'],
            threshold: 0.3,
        });

        const result = fuse.search(gameName);
        const db = await setupDatabase();
        const existingRow = await db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
        if (existingRow) {
            await db.run('UPDATE request_thread SET link = ? WHERE id = ?', result[0].item.link, existingRow.id);
        } else {
            await db.run('INSERT INTO request_thread (thread_name, thread_id, link) VALUES (?, ?, ?)', thread.name, thread.id, result[0].item.link);
        }

        if (result.length > 0) {
            const bestMatch = result[0].item;
            const gameDate = await fetchGameDate(bestMatch.link);
            

            // Create embed with game details and buttons
            const embed = new EmbedBuilder()
                .setTitle('Found a possible match!')
                .setColor('#0099ff');

            const dmButton = new ButtonBuilder()
                .setCustomId('send_dm')
                .setLabel('Send Details')
                .setStyle(ButtonStyle.Primary);

            const uploadButton = new ButtonBuilder()
                .setCustomId('start_upload')
                .setLabel('Start Upload')
                .setStyle(ButtonStyle.Success);

            const deleteButton = new ButtonBuilder()
                .setCustomId('delete_message')
                .setLabel('Delete Message')
                .setStyle(ButtonStyle.Danger);

            let sentMessage = await thread.send({
                embeds: [embed],
                components: [{
                    type: ComponentType.ActionRow,
                    components: [dmButton, uploadButton, deleteButton]
                }]
            });

            try {
                const threadMembers = await (await thread.fetch()).members.fetch();
                const threadCreator = threadMembers.first();
                if (threadCreator) {
                    await db.run('UPDATE request_thread SET message_id = ?, user_id = ? WHERE thread_id = ?', sentMessage.id, threadCreator.id, thread.id);
                } else {
                    console.error('No thread creator found');
                }
            } catch (error) {
                console.error('Error updating database:', error);
            }


            // Create a collector for interactions with buttons
            const collector = thread.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // Collect for 5 minutes
            });

            collector.on('collect', async interaction => {
                if (!interaction.isButton()) return;

                // Defer the update if needed to avoid interaction timeout
                await interaction.deferUpdate();

                // Inside the message collector setup
collector.on('end', async () => {
    const db = await setupDatabase();
    const existingRow = await db.get('SELECT buttons_inactive FROM request_thread WHERE thread_id = ?', thread.id);

    if (existingRow && existingRow.buttons_inactive !== 1) {
        const dmButton = new ButtonBuilder()
            .setCustomId('send_dm')
            .setLabel('Send Details')
            .setStyle(ButtonStyle.Primary);

        const uploadButton = new ButtonBuilder()
            .setCustomId('start_upload')
            .setLabel('Start Upload')
            .setStyle(ButtonStyle.Success);

        const deleteButton = new ButtonBuilder()
            .setCustomId('delete_message')
            .setLabel('Delete Message')
            .setStyle(ButtonStyle.Danger);

        await sentMessage.edit({
            components: [{
                type: ComponentType.ActionRow,
                components: [dmButton, uploadButton, deleteButton]
            }]
        });
    }
});


                const userRoles = interaction.member?.roles as any;
                const { adminUserId } = require('../data/permissions.json');
        
                if ((!checkPermissions(userRoles, process.env.admin ?? '') && !checkPermissions(userRoles, process.env.uploader ?? '') && interaction.user.id !== adminUserId)) {
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription('You don\'t have permission to use this command.');
                    await interaction.followUp({ embeds: [embed], ephemeral: true });
                    return;
                }

                if (interaction.customId === 'send_dm') {
                    // Send an ephemeral message to the same channel
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Game Details')
                        .setDescription(`Game Name: ${bestMatch.title}\nLink: ${bestMatch.link}\nDate: ${gameDate.date}`);
                    
                    // Respond to interaction with ephemeral message
                    await interaction.followUp({ embeds: [dmEmbed], ephemeral: true });

                } else if (interaction.customId === 'start_upload') {
                    // Start the uploading process and update the message
                    const uploadEmbed = new EmbedBuilder()
                        .setColor('#ffff00')
                        .setTitle('Starting Upload...')
                        .setDescription('I need your help to Upload it. Please check your DMs...');
                    await interaction.followUp({ embeds: [uploadEmbed], ephemeral: true });

                    // Update the original message to show the uploading status and remove buttons
                    await sentMessage.edit({
                        embeds: [new EmbedBuilder()
                            .setTitle('Uploading...')
                            .setColor('#ffff00')
                            .setDescription('Currently Uploading the Game...'),
                          ],
                          components: [], // Remove buttons
                        });

                        // Fetch the parent message (top message) of the thread
                        const parentMessage = await thread.fetchStarterMessage(); // For threads, this fetches the original message

                        // React to the parent message with the uploading emoji
                        if (parentMessage) {
                            // Replace with your actual uploading emoji
                            await parentMessage.react('🔄');
                        }
                        const db = await setupDatabase();
                        const existingRow = await db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
                        if (existingRow) {
                            await db.run('UPDATE request_thread SET uploader_id = ?, buttons_inactive = 1 WHERE id = ?', interaction.user.id, existingRow.id);
                        } else {
                            await db.run('INSERT INTO request_thread (thread_name, thread_id, uploader_id, buttons_inactive) VALUES (?, ?, ?, 1)', thread.name, thread.id, interaction.user.id);
                        }
                        await downloadHandler(client, bestMatch.link, interaction.user.id, gameName, thread.id);
                        setupFileWatcher(thread);

                } else if (interaction.customId === 'delete_message') {
                    // Send a confirmation message with a button
                    const confirmEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Confirm Deletion')
                        .setDescription('Are you sure you want to delete the message?');
                    const confirmButton = new ButtonBuilder()
                        .setCustomId('confirm_delete')
                        .setLabel('Confirm')
                        .setStyle(ButtonStyle.Danger)
                    const row = {
                        type: ComponentType.ActionRow,
                        components: [confirmButton], 
                    };
                    const confirmMessage = await interaction.followUp({ embeds: [confirmEmbed], components: [row], ephemeral: true });

                    const confirmCollector = (interaction.channel as GuildTextBasedChannel | DMChannel).createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 10000,
                    });
                    
                    confirmCollector.on('collect', async (i) => {
                        if (i.customId === 'confirm_delete') {
                            const db = await setupDatabase();
                            const messageIdRow = await db.get('SELECT message_id FROM request_thread WHERE thread_id = ?', thread.id);
                    
                            if (messageIdRow) {
                                const messageId = messageIdRow.message_id;
                                let message;
                    
                                try {
                                    message = await thread.messages.fetch(messageId);
                                } catch (error) {
                                    console.error('Error fetching the original message:', error);
                                    return; // Exit if the message cannot be fetched
                                }
                    
                                if (message) {
                                    try {
                                        await message.delete();
                                    } catch (error) {
                                        console.error('Error deleting the message:', error);
                                        return; // Exit if the message cannot be deleted
                                    }
                                }
                    
                                try {
                                    const confirmEmbed = new EmbedBuilder()
                                        .setColor('#ff0000')
                                        .setTitle('Confirmation')
                                        .setDescription('The message has been deleted.');
                                    
                                    // Use the interaction to edit the ephemeral reply
                                    await i.editReply({ embeds: [confirmEmbed], components: []});
                                } catch (error) {
                                    console.error('Error editing the confirmation message:', error);
                                }
                            }
                    
                            confirmCollector.stop();
                        }
                    });
                    
                }
            });

        }
    } catch (error) {
        console.error('Error searching for game:', error);
    }

    
}