const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { isMediador, isAnalista } = require('../utils/permissions');
const { embedErro, embedSucesso } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vencedor')
        .setDescription('Definir vencedor e perdedor de uma partida (Mediador)')
        .addUserOption(option =>
            option.setName('ganhador')
                .setDescription('Usuário que venceu a partida')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('perdedor')
                .setDescription('Usuário que perdeu a partida')
                .setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // Verificar permissão
        if (!isMediador(interaction.member, guildId) && !isAnalista(interaction.member, guildId)) {
            return interaction.reply({
                embeds: [embedErro('Sem Permissão', 'Apenas mediadores e analistas podem usar este comando.')],
                ephemeral: true
            });
        }

        const ganhador = interaction.options.getUser('ganhador');
        const perdedor = interaction.options.getUser('perdedor');

        // Verificar se são usuários diferentes
        if (ganhador.id === perdedor.id) {
            return interaction.reply({
                embeds: [embedErro('Erro', 'O ganhador e perdedor devem ser usuários diferentes!')],
                ephemeral: true
            });
        }

        // Verificar se não são bots
        if (ganhador.bot || perdedor.bot) {
            return interaction.reply({
                embeds: [embedErro('Erro', 'Você não pode selecionar bots!')],
                ephemeral: true
            });
        }

        // Atualizar estatísticas
        db.addVitoria(ganhador.id, guildId);
        db.addDerrota(perdedor.id, guildId);

        // Buscar dados atualizados
        const dadosGanhador = db.getUsuario(ganhador.id, guildId);
        const dadosPerdedor = db.getUsuario(perdedor.id, guildId);

        // Log de partidas
        const config = db.getConfig(guildId);
        if (config.log_partidas) {
            const logChannel = interaction.guild.channels.cache.get(config.log_partidas);
            if (logChannel) {
                logChannel.send({
                    embeds: [embedSucesso('🏆 Partida Finalizada', 
                        `**Vencedor:** <@${ganhador.id}> (+1 vitória, +1 coin)\n` +
                        `**Perdedor:** <@${perdedor.id}> (+1 derrota)\n\n` +
                        `**Mediador:** <@${interaction.user.id}>`
                    )]
                }).catch(() => {});
            }
        }

        await interaction.reply({
            embeds: [embedSucesso('🏆 Resultado Registrado', 
                `**Vencedor:** <@${ganhador.id}>\n` +
                `• Vitórias: ${dadosGanhador.vitorias}\n` +
                `• Coins: ${dadosGanhador.coins}\n\n` +
                `**Perdedor:** <@${perdedor.id}>\n` +
                `• Derrotas: ${dadosPerdedor.derrotas}`
            )]
        });
    }
};
