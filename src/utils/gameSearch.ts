import axios from 'axios';
import { ThreadChannel, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType, Client } from 'discord.js';
import Fuse from 'fuse.js';
import { checkPermissions } from './permissions';
import { downloadHandler } from './downloadHandler'; // Adjust the path according to your project structure
import { setupDatabase } from '../db/setup';

interface GameResult {
    title: string;
    link: string;
}

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
        const title = match[2].trim().replace(/ - .+$/, ''); // Remove any extra description after the main title
        gameResults.push({ title, link });
    }

    return gameResults;
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

            // Function to refresh buttons
            async function refreshButtons() {
                const updatedEmbed = new EmbedBuilder()
                    .setTitle('Found a possible match!')
                    .setColor('#0099ff');
                
                const refreshedMessage = await sentMessage.edit({
                    embeds: [updatedEmbed],
                    components: [{
                        type: ComponentType.ActionRow,
                        components: [dmButton, uploadButton, deleteButton]
                    }]
                });
                
                sentMessage = refreshedMessage; // Update sentMessage reference
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

                if (interaction.customId === 'send_dm') {
                    // Send an ephemeral message to the same channel
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Game Details')
                        .setDescription(`Game Name: ${bestMatch.title}\nLink: ${bestMatch.link}`);
                    
                    // Respond to interaction with ephemeral message
                    await interaction.followUp({ embeds: [dmEmbed], ephemeral: true });

                } else if (interaction.customId === 'start_upload') {
                    // Start the uploading process and react to the original message
                    await interaction.followUp({ content: 'Uploading process has started.', ephemeral: true });

                    // Fetch the parent message (top message) of the thread
                    const parentMessage = await thread.fetchStarterMessage(); // For threads, this fetches the original message
                    // React to the parent message with the uploading emoji
                    if (parentMessage) {
                        // Replace with your actual uploading emoji
                        await parentMessage.react('🔄');
                    }

                    console.log(`Game Name: ${bestMatch.title}`);
                    console.log(`Link: ${bestMatch.link}`);
                    console.log(`Thread ID: ${thread.id}`);
                    await downloadHandler(client, bestMatch.link, interaction.user.id);

                } else if (interaction.customId === 'delete_message') {
                    // Delete the message
                    await sentMessage.delete();
                    const deleteEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Message Deleted')
                        .setDescription('The message has been deleted.');
                    await interaction.followUp({ embeds: [deleteEmbed], ephemeral: true });
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    console.log('Collector timed out.');
                    // Refresh buttons to keep them active
                    refreshButtons();
                }
            });

        } else {
            await thread.send(':x: No matching game found.');
        }
    } catch (error) {
        console.error('Error searching for game:', error);
        await thread.send(':x: An error occurred while searching.');
    }
}
