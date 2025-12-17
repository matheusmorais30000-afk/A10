const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { embedErro, embedSucesso, embedInfo } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('visual')
        .setDescription('Editar visuais (embeds e botões) do servidor (Apenas Admins)'),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar este comando.')], ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('visual_main')
            .setPlaceholder('Escolha o que quer editar')
            .addOptions([
                { label: 'Embeds', value: 'embeds', description: 'Editar as embeds (partida, mediador, ticket, ranking)' }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);
        await interaction.reply({ embeds: [embedInfo('Visual Editor', 'Selecione a embed que deseja editar.')], components: [row], ephemeral: true });
    }
};