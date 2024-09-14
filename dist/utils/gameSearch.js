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
exports.searchGame = searchGame;
const axios_1 = __importDefault(require("axios"));
const discord_js_1 = require("discord.js");
const fuse_js_1 = __importDefault(require("fuse.js"));
const permissions_1 = require("./permissions");
const downloadHandler_1 = require("./downloadHandler"); // Adjust the path according to your project structure
const setup_1 = require("../db/setup");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Function to parse the HTML and extract game titles and links within specific structure
function parseSearchResults(html) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!html || typeof html !== 'string') {
            throw new Error('Invalid HTML content received');
        }
        const gameResults = [];
        // Regular expression to match the relevant sections of the HTML
        const regex = /<a\s+href="([^"]+)"\s+title="Permanent Link to\s+([^"]+)"[^>]*>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const link = match[1].trim();
            const title = match[2].trim().replace(/ - .+$/, ''); // Remove any extra description after the main title
            gameResults.push({ title, link });
        }
        return gameResults;
    });
}
function searchGame(gameName, thread, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const searchUrl = `https://www.ovagames.com/?s=${encodeURIComponent(gameName)}&x=0&y=0`;
        try {
            const response = yield axios_1.default.get(searchUrl, {
                headers: {
                    'Accept': 'text/html',
                },
            });
            let html = response.data;
            const start = html.indexOf('<div class="home-post-titles">');
            const end = html.indexOf('</div>', start);
            if (start !== -1 && end !== -1) {
                html = html.substring(start, end + 6);
            }
            else {
                console.error('Error: Failed to extract relevant HTML');
                yield thread.send(':x: Failed to fetch search results.');
                return;
            }
            const gameResults = yield parseSearchResults(html);
            if (gameResults.length === 0) {
                yield thread.send(':x: No matching game found.');
                return;
            }
            const fuse = new fuse_js_1.default(gameResults, {
                keys: ['title'],
                threshold: 0.3,
            });
            const result = fuse.search(gameName);
            const db = yield (0, setup_1.setupDatabase)();
            const existingRow = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
            if (existingRow) {
                yield db.run('UPDATE request_thread SET link = ? WHERE id = ?', result[0].item.link, existingRow.id);
            }
            else {
                yield db.run('INSERT INTO request_thread (thread_name, thread_id, link) VALUES (?, ?, ?)', thread.name, thread.id, result[0].item.link);
            }
            if (result.length > 0) {
                const bestMatch = result[0].item;
                // Create embed with game details and buttons
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('Found a possible match!')
                    .setColor('#0099ff');
                const dmButton = new discord_js_1.ButtonBuilder()
                    .setCustomId('send_dm')
                    .setLabel('Send Details')
                    .setStyle(discord_js_1.ButtonStyle.Primary);
                const uploadButton = new discord_js_1.ButtonBuilder()
                    .setCustomId('start_upload')
                    .setLabel('Start Upload')
                    .setStyle(discord_js_1.ButtonStyle.Success);
                const deleteButton = new discord_js_1.ButtonBuilder()
                    .setCustomId('delete_message')
                    .setLabel('Delete Message')
                    .setStyle(discord_js_1.ButtonStyle.Danger);
                let sentMessage = yield thread.send({
                    embeds: [embed],
                    components: [{
                            type: discord_js_1.ComponentType.ActionRow,
                            components: [dmButton, uploadButton, deleteButton]
                        }]
                });
                try {
                    yield db.run('UPDATE request_thread SET message_id = ? WHERE thread_id = ?', sentMessage.id, thread.id);
                }
                catch (error) {
                    console.error('Error updating database:', error);
                }
                // Function to refresh buttons
                function refreshButtons() {
                    return __awaiter(this, void 0, void 0, function* () {
                        const updatedEmbed = new discord_js_1.EmbedBuilder()
                            .setTitle('Found a possible match!')
                            .setColor('#0099ff');
                        const refreshedMessage = yield sentMessage.edit({
                            embeds: [updatedEmbed],
                            components: [{
                                    type: discord_js_1.ComponentType.ActionRow,
                                    components: [dmButton, uploadButton, deleteButton]
                                }]
                        });
                        sentMessage = refreshedMessage; // Update sentMessage reference
                    });
                }
                // Create a collector for interactions with buttons
                const collector = thread.createMessageComponentCollector({
                    componentType: discord_js_1.ComponentType.Button,
                    time: 300000 // Collect for 5 minutes
                });
                collector.on('collect', (interaction) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    if (!interaction.isButton())
                        return;
                    // Defer the update if needed to avoid interaction timeout
                    yield interaction.deferUpdate();
                    const userRoles = (_a = interaction.member) === null || _a === void 0 ? void 0 : _a.roles;
                    const { adminUserId } = require('../data/permissions.json');
                    if ((!(0, permissions_1.checkPermissions)(userRoles, (_b = process.env.admin) !== null && _b !== void 0 ? _b : '') && !(0, permissions_1.checkPermissions)(userRoles, (_c = process.env.uploader) !== null && _c !== void 0 ? _c : '') && interaction.user.id !== adminUserId)) {
                        const embed = new discord_js_1.EmbedBuilder()
                            .setColor('#FF0000')
                            .setDescription('You don\'t have permission to use this command.');
                        yield interaction.followUp({ embeds: [embed], ephemeral: true });
                        return;
                    }
                    if (interaction.customId === 'send_dm') {
                        // Send an ephemeral message to the same channel
                        const dmEmbed = new discord_js_1.EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('Game Details')
                            .setDescription(`Game Name: ${bestMatch.title}\nLink: ${bestMatch.link}`);
                        // Respond to interaction with ephemeral message
                        yield interaction.followUp({ embeds: [dmEmbed], ephemeral: true });
                    }
                    else if (interaction.customId === 'start_upload') {
                        // Start the uploading process and update the message
                        const uploadEmbed = new discord_js_1.EmbedBuilder()
                            .setColor('#ffff00')
                            .setTitle('Uploading...')
                            .setDescription('I need your help to Upload it. Please check your DMs...');
                        yield interaction.followUp({ embeds: [uploadEmbed], ephemeral: true });
                        // Update the original message to show the uploading status and remove buttons
                        yield sentMessage.edit({
                            embeds: [new discord_js_1.EmbedBuilder()
                                    .setTitle('Uploading...')
                                    .setColor('#ffff00')
                                    .setDescription('Currently Uploading the Game...'),
                            ],
                            components: [], // Remove buttons
                        });
                        // Fetch the parent message (top message) of the thread
                        const parentMessage = yield thread.fetchStarterMessage(); // For threads, this fetches the original message
                        // React to the parent message with the uploading emoji
                        if (parentMessage) {
                            // Replace with your actual uploading emoji
                            yield parentMessage.react('🔄');
                        }
                        yield (0, downloadHandler_1.downloadHandler)(client, bestMatch.link, interaction.user.id);
                    }
                    else if (interaction.customId === 'delete_message') {
                        // Send a confirmation message with a button
                        const confirmEmbed = new discord_js_1.EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Confirm Deletion')
                            .setDescription('Are you sure you want to delete the message?');
                        const confirmButton = new discord_js_1.ButtonBuilder()
                            .setCustomId('confirm_delete')
                            .setLabel('Confirm')
                            .setStyle(discord_js_1.ButtonStyle.Danger);
                        const row = {
                            type: discord_js_1.ComponentType.ActionRow,
                            components: [confirmButton],
                        };
                        const confirmMessage = yield interaction.followUp({ embeds: [confirmEmbed], components: [row], ephemeral: true });
                        // Collect button interactions
                        const confirmCollector = interaction.channel.createMessageComponentCollector({
                            componentType: discord_js_1.ComponentType.Button,
                            time: 10000,
                        });
                        confirmCollector.on('collect', (i) => __awaiter(this, void 0, void 0, function* () {
                            if (i.customId === 'confirm_delete') {
                                // Delete the message
                                yield sentMessage.delete();
                                const deleteEmbed = new discord_js_1.EmbedBuilder()
                                    .setColor('#ff0000')
                                    .setTitle('Message Deleted')
                                    .setDescription('The message has been deleted.');
                                // Send a follow-up message to the interaction
                                yield i.editReply({ embeds: [deleteEmbed], components: [] });
                                confirmCollector.stop();
                            }
                        }));
                    }
                }));
                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        console.log('Collector timed out.');
                        // Refresh buttons to keep them active
                        refreshButtons();
                    }
                });
            }
            else {
                yield thread.send(':x: No matching game found.');
            }
        }
        catch (error) {
            console.error('Error searching for game:', error);
            yield thread.send(':x: An error occurred while searching.');
        }
    });
}
