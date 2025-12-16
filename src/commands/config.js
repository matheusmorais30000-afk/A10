const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { embedErro } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Painel de configuração do bot (Apenas Administradores)'),

    async execute(interaction) {
        // Verificar permissão
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ 
                embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar este comando.')],
                ephemeral: true 
            });
        }

        // Criar embed principal
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚙️ Painel de Configuração')
            .setDescription('Selecione uma opção abaixo para configurar o bot.')
            .addFields(
                { name: '💰 VALORES', value: 'Gerenciar valores de apostas', inline: true },
                { name: '👥 CARGOS', value: 'Definir cargos do sistema', inline: true },
                { name: '📋 LOGS', value: 'Configurar canais de log', inline: true },
            )
            .setFooter({ text: 'Bot Xenon' })
            .setTimestamp();

        // Criar menu de seleção (substitui os botões de configuração)
        const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('config_menu')
                .setPlaceholder('Selecione uma opção de configuração')
                .addOptions([
                    { label: 'VALORES', value: 'valores', description: 'Gerenciar valores de apostas', emoji: '💰' },
                    { label: 'CARGOS', value: 'cargos', description: 'Definir cargos do sistema', emoji: '👥' },
                    { label: 'LOGS', value: 'logs', description: 'Configurar canais de log', emoji: '📋' }
                ])
        );

        await interaction.reply({
            embeds: [embed],
            components: [menu],
            ephemeral: true
        });
    }
};
