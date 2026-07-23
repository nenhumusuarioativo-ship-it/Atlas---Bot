require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, REST } = require('discord.js');
const { Player } = require('discord-player');
const { loadCommands } = require('./src/handlers/commandHandler');
const { loadEvents } = require('./src/handlers/eventHandler');
const { errorCodes, logError } = require('./src/data/errorCodes');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN não está definido no .env.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
client.rest = rest;
client.on('error', (error) => {
  logError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Erro emitido pelo cliente Discord', error);
});

const commandsPath = path.join(__dirname, 'src', 'commands');
const eventsPath = path.join(__dirname, 'src', 'events');

client.commandsData = loadCommands(client, commandsPath);
client.player = new Player(client, {
  leaveOnEmpty: true,
  leaveOnEnd: true,
  leaveOnStop: true,
  connectionTimeout: 20000,
  selfDeaf: true,
  onBeforeCreateStream: async () => null
});

loadEvents(client, eventsPath);

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Erro ao logar o bot:', error);
});
