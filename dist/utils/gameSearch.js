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
const fileWatcher_1 = require("./fileWatcher");
dotenv_1.default.config();
let exportedThread;
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
            const title = match[2].trim().replace(/ - .+$/, '');
            gameResults.push({ title, link });
        }
        return gameResults;
    });
}
function fetchGameDate(gameLink) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.get(gameLink, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                },
            });
            // Extract the date from the JSON-like response data
            const dateMatch = response.data.match(/"dateModified":"([^"]+)"/);
            const dateString = dateMatch ? dateMatch[1].trim() : null;
            let formattedDate = null;
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
                return { date: null };
            }
            return { date: formattedDate };
        }
        catch (error) {
            console.error(`Error fetching game date from ${gameLink}:`, error);
            return { date: null };
        }
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
                const gameDate = yield fetchGameDate(bestMatch.link);
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
                    const threadMembers = yield (yield thread.fetch()).members.fetch();
                    const threadCreator = threadMembers.first();
                    if (threadCreator) {
                        yield db.run('UPDATE request_thread SET message_id = ?, user_id = ? WHERE thread_id = ?', sentMessage.id, threadCreator.id, thread.id);
                    }
                    else {
                        console.error('No thread creator found');
                    }
                }
                catch (error) {
                    console.error('Error updating database:', error);
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
                    // Inside the message collector setup
                    collector.on('end', () => __awaiter(this, void 0, void 0, function* () {
                        const db = yield (0, setup_1.setupDatabase)();
                        const existingRow = yield db.get('SELECT buttons_inactive FROM request_thread WHERE thread_id = ?', thread.id);
                        if (existingRow && existingRow.buttons_inactive !== 1) {
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
                            yield sentMessage.edit({
                                components: [{
                                        type: discord_js_1.ComponentType.ActionRow,
                                        components: [dmButton, uploadButton, deleteButton]
                                    }]
                            });
                        }
                    }));
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
                            .setDescription(`Game Name: ${bestMatch.title}\nLink: ${bestMatch.link}\nDate: ${gameDate.date}`);
                        // Respond to interaction with ephemeral message
                        yield interaction.followUp({ embeds: [dmEmbed], ephemeral: true });
                    }
                    else if (interaction.customId === 'start_upload') {
                        // Start the uploading process and update the message
                        const uploadEmbed = new discord_js_1.EmbedBuilder()
                            .setColor('#ffff00')
                            .setTitle('Starting Upload...')
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
                        const db = yield (0, setup_1.setupDatabase)();
                        const existingRow = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
                        if (existingRow) {
                            yield db.run('UPDATE request_thread SET uploader_id = ?, buttons_inactive = 1 WHERE id = ?', interaction.user.id, existingRow.id);
                        }
                        else {
                            yield db.run('INSERT INTO request_thread (thread_name, thread_id, uploader_id, buttons_inactive) VALUES (?, ?, ?, 1)', thread.name, thread.id, interaction.user.id);
                        }
                        yield (0, downloadHandler_1.downloadHandler)(client, bestMatch.link, interaction.user.id, gameName, thread.id);
                        (0, fileWatcher_1.setupFileWatcher)(thread);
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
                        const confirmCollector = interaction.channel.createMessageComponentCollector({
                            componentType: discord_js_1.ComponentType.Button,
                            time: 10000,
                        });
                        confirmCollector.on('collect', (i) => __awaiter(this, void 0, void 0, function* () {
                            if (i.customId === 'confirm_delete') {
                                const db = yield (0, setup_1.setupDatabase)();
                                const messageIdRow = yield db.get('SELECT message_id FROM request_thread WHERE thread_id = ?', thread.id);
                                if (messageIdRow) {
                                    const messageId = messageIdRow.message_id;
                                    let message;
                                    try {
                                        message = yield thread.messages.fetch(messageId);
                                    }
                                    catch (error) {
                                        console.error('Error fetching the original message:', error);
                                        return; // Exit if the message cannot be fetched
                                    }
                                    if (message) {
                                        try {
                                            yield message.delete();
                                        }
                                        catch (error) {
                                            console.error('Error deleting the message:', error);
                                            return; // Exit if the message cannot be deleted
                                        }
                                    }
                                    try {
                                        const confirmEmbed = new discord_js_1.EmbedBuilder()
                                            .setColor('#ff0000')
                                            .setTitle('Confirmation')
                                            .setDescription('The message has been deleted.');
                                        // Use the interaction to edit the ephemeral reply
                                        yield i.editReply({ embeds: [confirmEmbed], components: [] });
                                    }
                                    catch (error) {
                                        console.error('Error editing the confirmation message:', error);
                                    }
                                }
                                confirmCollector.stop();
                            }
                        }));
                    }
                }));
            }
        }
        catch (error) {
            console.error('Error searching for game:', error);
        }
    });
}
