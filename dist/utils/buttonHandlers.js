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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleButtonInteractions = handleButtonInteractions;
const discord_js_1 = require("discord.js");
const downloadHandler_1 = require("./downloadHandler");
const setup_1 = require("../db/setup");
function handleButtonInteractions(interaction, bestMatch, gameDate, client, gameName, thread, sentMessage) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield (0, setup_1.setupDatabase)();
        if (interaction.customId === 'send_dm') {
            const dmEmbed = new discord_js_1.EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Game Details')
                .setDescription(`Game Name: ${bestMatch.title}\nLink: ${bestMatch.link}\nDate: ${gameDate.date}`);
            yield interaction.reply({ embeds: [dmEmbed], ephemeral: true });
        }
        else if (interaction.customId === 'start_upload') {
            const uploadEmbed = new discord_js_1.EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('Starting Upload...')
                .setDescription('I need your help to Upload it. Please check your DMs...');
            yield interaction.reply({ embeds: [uploadEmbed], ephemeral: true });
            yield sentMessage.edit({
                embeds: [new discord_js_1.EmbedBuilder()
                        .setTitle('Uploading...')
                        .setColor('#ffff00')
                        .setDescription('Currently Uploading the Game...')
                ],
                components: [], // Remove buttons
            });
            const parentMessage = yield thread.fetchStarterMessage();
            if (parentMessage) {
                yield parentMessage.react('🔄');
            }
            const existingRow = yield db.get('SELECT * FROM request_thread WHERE thread_id = ?', thread.id);
            if (existingRow) {
                yield db.run('UPDATE request_thread SET uploader_id = ? WHERE id = ?', interaction.user.id, existingRow.id);
            }
            else {
                yield db.run('INSERT INTO request_thread (thread_name, thread_id, uploader_id) VALUES (?, ?, ?)', thread.name, thread.id, interaction.user.id);
            }
            yield (0, downloadHandler_1.downloadHandler)(client, bestMatch.link, interaction.user.id, gameName, thread.id);
        }
        else if (interaction.customId === 'delete_message') {
            console.log("1");
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
            console.log("2");
            if (!interaction.deferred && !interaction.replied)
                yield interaction.deferReply();
            yield interaction.followUp({ embeds: [confirmEmbed], components: [row], ephemeral: true });
            console.log("3");
            const confirmCollector = interaction.channel.createMessageComponentCollector({
                componentType: discord_js_1.ComponentType.Button,
                time: 10000,
            });
            confirmCollector.on('collect', (i) => __awaiter(this, void 0, void 0, function* () {
                if (i.customId === 'confirm_delete') {
                    const db = yield (0, setup_1.setupDatabase)();
                    const messageIdRow = yield db.get('SELECT message_id FROM request_thread WHERE thread_id = ?', thread.id);
                    console.log("4");
                    if (messageIdRow) {
                        const messageId = messageIdRow.message_id;
                        let message;
                        console.log("5");
                        try {
                            console.log(messageIdRow);
                            if (!messageIdRow)
                                return; // Exit if the message ID cannot be found in the database
                            const messageId = messageIdRow.message_id;
                            message = yield thread.messages.fetch(messageId);
                            console.log(messageId);
                            console.log(message);
                        }
                        catch (error) {
                            console.error('Error fetching the original message:', error);
                            return; // Exit if the message cannot be fetched
                        }
                        console.log("6" + message.id);
                        if (message) {
                            try {
                                console.log("69: " + message.id);
                                yield message.delete();
                                //TODO: Make the delete work
                            }
                            catch (error) {
                                console.error('Error deleting the message:', error);
                                return; // Exit if the message cannot be deleted
                            }
                        }
                        try {
                            console.log("7");
                            const confirmEmbed = new discord_js_1.EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('Confirmation')
                                .setDescription('The message has been deleted.');
                            // Use the interaction to edit the ephemeral reply
                            yield i.reply({ embeds: [confirmEmbed], components: [], ephemeral: true });
                            console.log("8");
                        }
                        catch (error) {
                            console.error('Error editing the confirmation message:', error);
                        }
                    }
                    confirmCollector.stop();
                }
            }));
        }
    });
}
