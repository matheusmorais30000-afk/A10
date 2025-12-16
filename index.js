// Carregar variáveis de ambiente do arquivo .env (se existir)
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const path = require('path');
const fs = require('fs');
const db = require('./src/database/db');

// Criar cliente Discord com todas as intents necessárias
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

// Coleções para comandos e cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();
client.activeMatches = new Collection();
client.activeQueues = new Collection();

// Carregar comandos
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[COMANDO] ${command.data.name} carregado com sucesso!`);
    }
}

// Carregar eventos
const eventsPath = path.join(__dirname, 'src/events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log(`[EVENTO] ${event.name} carregado com sucesso!`);
}

// Tratamento de erros global
process.on('unhandledRejection', (error) => {
    console.error('[ERRO] Promessa não tratada:', error);
});

process.on('uncaughtException', (error) => {
    console.error('[ERRO] Exceção não capturada:', error);
});

// Login do bot
client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('[BOT] Conectando ao Discord...'))
    .catch(err => console.error('[ERRO] Falha ao conectar:', err));
