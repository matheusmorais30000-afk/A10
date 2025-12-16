const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { embedErro, embedInfo } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filas')
        .setDescription('Configurar categorias de filas de partida (Admin)'),

    async execute(interaction) {
        // Verificar permissão
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                embeds: [embedErro('Sem Permissão', 'Apenas administradores podem configurar filas.')],
                ephemeral: true
            });
        }

        // Criar select menu com modalidades
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('filas_modalidade')
                .setPlaceholder('Selecione a modalidade')
                .addOptions([
                    {
                        label: 'Mobile',
                        description: 'Partidas para jogadores de celular',
                        value: 'Mobile',
                        emoji: '📱'
                    },
                    {
                        label: 'Emulador',
                        description: 'Partidas para jogadores de emulador',
                        value: 'Emulador',
                        emoji: '💻'
                    },
                    {
                        label: 'Tático',
                        description: 'Partidas no modo tático',
                        value: 'Tático',
                        emoji: '🎯'
                    },
                    {
                        label: 'Misto',
                        description: 'Partidas mistas (Mobile + Emulador)',
                        value: 'Misto',
                        emoji: '🔀'
                    }
                ])
        );

        await interaction.reply({
            embeds: [embedInfo('🎮 Configurar Filas', 
                'Selecione a modalidade para criar os canais de fila.\n\n' +
                '**Atenção:** Antes de usar este comando, certifique-se de:\n' +
                '• Ter configurado os valores de aposta em `/config`\n' +
                '• Ter uma categoria do Discord pronta para os canais\n\n' +
                'O bot irá criar automaticamente canais para cada tipo (1v1, 2v2, 3v3, 4v4) e cada valor configurado.'
            )],
            components: [row],
            ephemeral: true
        });
    }
};
