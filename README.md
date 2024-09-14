# Discord Bot for Game Threads Management

This Discord bot is designed to manage a request channel by automatically searching for games on Ovagames and then loading them into a folder. It handles file downloads, user interactions, and more, with some manual steps required to bypass Captchas.

## Features

- **Thread Management**: Monitors thread creation and deletion.
- **Game Search**: Searches for games using the Ovagames website.
- **Game Details**: Provides game details and handles user interactions.
- **File Handling**: Manages file uploads and downloads, including using `.dlc` files for download.
- **Database Integration**: Uses SQLite for storing thread information and game data.
- **File Watching and Processing**: uses jdownloader to download the games to a folder, renames and moves `.iso` files, processes and zips if there are multiple files, and deletes the original directory.
- **Message Updating**: Updates the original message with a status, reacts with a 'done' emoji after uploading, and handles message editing and deletion.

## Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/Nicoolodion/AutoDownloader.git
    cd AutoDownloader
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Create a `.env` file**

    Create a `.env` file in the root directory and add the following variables:

    ```env
    DISCORD_TOKEN=your-discord-bot-token
    REQUEST_CHANNEL_ID=your-request-channel-id
    DOWNLOAD_DIR=./downloads
    ADMIN_ROLE_ID=your-admin-role-id
    UPLOADER_ROLE_ID=your-uploader-role-id
    UPLOAD_DIR=your-upload-folder
    WORKING_DOWNLOADS=your-working-downloads-folder
    CG_ADWARE=your-cg-adware-folder
    UPLOADING_DRIVE=your-uploading-drive
    ```

4. **Setup the database**

    The bot will automatically create and manage the SQLite database upon startup.

## Usage

1. **Run the bot**

    ```bash
    npm start
    ```
