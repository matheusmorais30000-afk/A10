const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');
const { isMediador, isAnalista } = require('../utils/permissions');
const { embedErro, embedSucesso } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pix')
        .setDescription('Registrar sua chave PIX (Obrigatório para mediadores)'),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // Verificar se é mediador ou analista
        if (!isMediador(interaction.member, guildId) && !isAnalista(interaction.member, guildId)) {
            return interaction.reply({
                embeds: [embedErro('Sem Permissão', 'Apenas mediadores e analistas podem registrar chave PIX.')],
                ephemeral: true
            });
        }

        // Criar modal
        const modal = new ModalBuilder()
            .setCustomId('modal_pix')
            .setTitle('Registrar Chave PIX');

        const pixInput = new TextInputBuilder()
            .setCustomId('pix_chave')
            .setLabel('Sua chave PIX')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('CPF, E-mail, Telefone ou Chave Aleatória')
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(100);

        modal.addComponents(new ActionRowBuilder().addComponents(pixInput));

        await interaction.showModal(modal);

        // Aguardar resposta do modal
        try {
            const modalInteraction = await interaction.awaitModalSubmit({
                filter: (i) => i.customId === 'modal_pix' && i.user.id === interaction.user.id,
                time: 60000
            });

            const chavePix = modalInteraction.fields.getTextInputValue('pix_chave');
            
            // Salvar no banco
            db.setPixKey(interaction.user.id, guildId, chavePix);

            await modalInteraction.reply({
                embeds: [embedSucesso('PIX Registrado', `Sua chave PIX foi registrada com sucesso!\n\n**Chave:** \`${chavePix}\``)],
                ephemeral: true
            });

        } catch (error) {
            // Modal expirou ou erro
            if (error.code !== 'InteractionCollectorError') {
                console.error('[ERRO] Modal PIX:', error);
            }
        }
    }
};
