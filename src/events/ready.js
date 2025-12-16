const { REST, Routes, ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`[BOT] ${client.user.tag} está online!`);
        console.log(`[BOT] Conectado em ${client.guilds.cache.size} servidor(es)`);

        // Definir status do bot
        client.user.setPresence({
            activities: [{ name: '⚔️ Partidas FF', type: ActivityType.Watching }],
            status: 'online'
        });

        // Registrar comandos slash
        const commands = [];
        client.commands.forEach(command => {
            commands.push(command.data.toJSON());
        });

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log('[BOT] Registrando comandos slash...');

            // Registrar globalmente (pode demorar até 1 hora para propagar)
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );

            console.log(`[BOT] ${commands.length} comando(s) registrado(s) com sucesso!`);
        } catch (error) {
            console.error('[ERRO] Falha ao registrar comandos:', error);
        }

        // Limpar QR Codes antigos a cada hora
        const { limparQRCodesAntigos } = require('../utils/qrcode');
        setInterval(limparQRCodesAntigos, 60 * 60 * 1000);
    }
};
