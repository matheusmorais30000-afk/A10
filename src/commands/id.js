const { SlashCommandBuilder } = require('discord.js');
const { isMediador, isAnalista } = require('../utils/permissions');
const { embedErro, embedIdSenha } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('id')
        .setDescription('Enviar ID e senha da sala (Mediador)')
        .addStringOption(option =>
            option.setName('sala')
                .setDescription('ID da sala do Free Fire')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('senha')
                .setDescription('Senha da sala')
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

        const sala = interaction.options.getString('sala');
        const senha = interaction.options.getString('senha');

        // Criar embed bonita com ID e senha
        const embed = embedIdSenha(sala, senha);

        await interaction.reply({ embeds: [embed] });
    }
};
