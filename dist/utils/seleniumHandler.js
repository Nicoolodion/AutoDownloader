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
exports.bypassCaptcha = bypassCaptcha;
const selenium_webdriver_1 = require("selenium-webdriver");
function bypassCaptcha(downloadLink) {
    return __awaiter(this, void 0, void 0, function* () {
        const driver = yield new selenium_webdriver_1.Builder().forBrowser('firefox').build();
        try {
            yield driver.get(downloadLink);
            const captchaElement = yield driver.findElement(selenium_webdriver_1.By.id('captcha'));
            if (captchaElement) {
                console.log('Bypassing Filecrypt captcha...');
                // Logic to bypass captcha, fill, and click download button
            }
            const finalDownloadLink = yield driver.findElement(selenium_webdriver_1.By.css('#link_download')).getAttribute('href');
            return finalDownloadLink;
        }
        finally {
            yield driver.quit();
        }
    });
}
