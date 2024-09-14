# Discord Bot for Game Threads Management

This Discord bot is designed to manage a request channel by automaticly searching for the game on ovagames and then loading them into a folder. It asks the user for help to bypass a Captcha but in the rest it can work completly indepently.

## Features

- **Thread Management**: Monitors thread creation and deletion.
- **Game Search**: Searches for games using Ovagames website.
- **Game Details**: Provides game details and handles user interactions.
- **File Handling**: Manages file uploads and downloads, including using `.dlc` files for download.
- **Database Integration**: Uses SQLite for storing thread information and game data.

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
    UPLOAD_DIR=your-upload-folder (To be added)
    ```

4. **Setup the database**

    The bot will automatically create and manage the SQLite database upon startup.

## Usage

1. **Run the bot**

    ```bash
    npm start
    ```

2. **Bot Functionality**

    - **Thread Creation**: When a new thread is created in the specified request channel, the bot will save its details and start searching for game information.
    - **Thread Deletion**: When a thread is deleted, it will be archived for record-keeping.
    - **Game Search**: Searches for game details and updates the thread with relevant information.
    - **File Uploads**: Users can upload `.dlc` files via DM, which the bot will save and process. Every Information needed is provided by the Bot.