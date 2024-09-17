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
exports.parseSearchResults = parseSearchResults;
// Function to parse the HTML and extract game titles and links within a specific structure
function parseSearchResults(html) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!html || typeof html !== 'string') {
            throw new Error('Invalid HTML content received');
        }
        const gameResults = [];
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
