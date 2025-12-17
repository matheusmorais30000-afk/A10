const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { embedErro } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filas')
        .setDescription('Configurar categorias de filas (Admin)'),

    async execute(interaction) {
        try {
            // Verificar permissão
            if (!isAdmin(interaction.member)) {
                return interaction.reply({
                    embeds: [embedErro('Sem Permissão', 'Apenas administradores podem configurar filas.')],
                    ephemeral: true
                });
            }

            // Embed com 5 botões
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('⚙️ Configurar Filas')
                .setDescription('Selecione qual categoria deseja configurar:')
                .addFields(
                    { name: '🎮 Categoria de Partidas', value: 'Categoria onde as partidas confirmadas serão criadas', inline: true },
                    { name: '📱 Mobile', value: 'Categoria das filas Mobile', inline: true },
                    { name: '🖥️ Emulador', value: 'Categoria das filas Emulador', inline: true },
                    { name: '🎪 Misto', value: 'Categoria das filas Misto', inline: true },
                    { name: '⚔️ Tático', value: 'Categoria das filas Tático', inline: true }
                )
                .setFooter({ text: 'Bot Xenon' })
                .setTimestamp();

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('config_categoria_partida')
                    .setLabel('Categoria')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎮'),
                new ButtonBuilder()
                    .setCustomId('config_filas_mobile')
                    .setLabel('Mobile')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📱'),
                new ButtonBuilder()
                    .setCustomId('config_filas_emulador')
                    .setLabel('Emulador')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🖥️'),
                new ButtonBuilder()
                    .setCustomId('config_filas_misto')
                    .setLabel('Misto')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎪'),
                new ButtonBuilder()
                    .setCustomId('config_filas_tatico')
                    .setLabel('Tático')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚔️')
            );

            await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
        } catch (error) {
            console.error('[ERRO] Comando filas:', error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [embedErro('Erro', 'Ocorreu um erro.')], ephemeral: true });
                } else {
                    await interaction.reply({ embeds: [embedErro('Erro', 'Ocorreu um erro.')], ephemeral: true });
                }
            } catch (e) {
                console.error('[ERRO] Falha ao responder:', e);
            }
        }
    }
};
