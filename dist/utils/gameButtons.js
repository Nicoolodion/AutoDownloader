"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteButton = exports.uploadButton = exports.dmButton = void 0;
const discord_js_1 = require("discord.js");
exports.dmButton = new discord_js_1.ButtonBuilder()
    .setCustomId('send_dm')
    .setLabel('Send Details')
    .setStyle(discord_js_1.ButtonStyle.Primary);
exports.uploadButton = new discord_js_1.ButtonBuilder()
    .setCustomId('start_upload')
    .setLabel('Start Upload')
    .setStyle(discord_js_1.ButtonStyle.Success);
exports.deleteButton = new discord_js_1.ButtonBuilder()
    .setCustomId('delete_message')
    .setLabel('Delete Message')
    .setStyle(discord_js_1.ButtonStyle.Danger);
