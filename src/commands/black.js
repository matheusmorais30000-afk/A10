const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');
const { isMediador, isAnalista } = require('../utils/permissions');
const { embedErro, embedSucesso, embedInfo, embedBlacklist } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('black')
        .setDescription('Gerenciar blacklist (Analista/Mediador)'),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // Verificar permissão
        if (!isMediador(interaction.member, guildId) && !isAnalista(interaction.member, guildId)) {
            return interaction.reply({
                embeds: [embedErro('Sem Permissão', 'Apenas analistas e mediadores podem gerenciar a blacklist.')],
                ephemeral: true
            });
        }

        // Mostrar painel
        const blacklist = db.getBlacklist(guildId);
        let listaTexto = blacklist.length > 0 
            ? blacklist.map(b => `• <@${b.user_id}> - ${b.motivo || 'Sem motivo'}`).join('\n')
            : 'Nenhum usuário na blacklist.';

        if (listaTexto.length > 1000) {
            listaTexto = listaTexto.substring(0, 1000) + '...';
        }

        const embed = embedInfo('🚫 Gerenciar Blacklist', `**Usuários na Blacklist:**\n${listaTexto}`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('black_adicionar')
                .setLabel('Adicionar')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId('black_remover')
                .setLabel('Remover')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➖')
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        // Collector para botões
        const collector = interaction.channel.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('black_'),
            time: 60000
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'black_adicionar') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_black_adicionar')
                    .setTitle('Adicionar à Blacklist');

                const userInput = new TextInputBuilder()
                    .setCustomId('black_user')
                    .setLabel('ID do usuário')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Cole o ID do usuário aqui')
                    .setRequired(true);

                const motivoInput = new TextInputBuilder()
                    .setCustomId('black_motivo')
                    .setLabel('Motivo')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Descreva o motivo da blacklist')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(userInput),
                    new ActionRowBuilder().addComponents(motivoInput)
                );

                await i.showModal(modal);

                try {
                    const modalResponse = await i.awaitModalSubmit({
                        filter: (m) => m.customId === 'modal_black_adicionar',
                        time: 60000
                    });

                    const userId = modalResponse.fields.getTextInputValue('black_user');
                    const motivo = modalResponse.fields.getTextInputValue('black_motivo');

                    // Tentar buscar usuário
                    try {
                        const user = await i.client.users.fetch(userId);
                        
                        db.addBlacklist(userId, guildId, motivo, interaction.user.id);

                        // Log
                        const config = db.getConfig(guildId);
                        if (config.log_geral) {
                            const logChannel = i.guild.channels.cache.get(config.log_geral);
                            if (logChannel) {
                                logChannel.send({ 
                                    embeds: [embedBlacklist(user, motivo, 'adicionado', interaction.user)] 
                                }).catch(() => {});
                            }
                        }

                        // Tentar adicionar cargo de blacklist
                        if (config.cargo_blacklist) {
                            const member = await i.guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                await member.roles.add(config.cargo_blacklist).catch(() => {});
                            }
                        }

                        await modalResponse.reply({
                            embeds: [embedSucesso('Adicionado', `<@${userId}> foi adicionado à blacklist.\n**Motivo:** ${motivo}`)],
                            ephemeral: true
                        });
                    } catch (e) {
                        await modalResponse.reply({
                            embeds: [embedErro('Erro', 'Usuário não encontrado. Verifique o ID.')],
                            ephemeral: true
                        });
                    }
                } catch (e) {
                    // Modal expirou
                }

            } else if (i.customId === 'black_remover') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_black_remover')
                    .setTitle('Remover da Blacklist');

                const userInput = new TextInputBuilder()
                    .setCustomId('black_user')
                    .setLabel('ID do usuário')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Cole o ID do usuário aqui')
                    .setRequired(true);

                const motivoInput = new TextInputBuilder()
                    .setCustomId('black_motivo')
                    .setLabel('Motivo da remoção')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Por que está removendo?')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(userInput),
                    new ActionRowBuilder().addComponents(motivoInput)
                );

                await i.showModal(modal);

                try {
                    const modalResponse = await i.awaitModalSubmit({
                        filter: (m) => m.customId === 'modal_black_remover',
                        time: 60000
                    });

                    const userId = modalResponse.fields.getTextInputValue('black_user');
                    const motivo = modalResponse.fields.getTextInputValue('black_motivo');

                    try {
                        const user = await i.client.users.fetch(userId);
                        
                        db.removeBlacklist(userId, guildId);

                        // Log
                        const config = db.getConfig(guildId);
                        if (config.log_geral) {
                            const logChannel = i.guild.channels.cache.get(config.log_geral);
                            if (logChannel) {
                                logChannel.send({ 
                                    embeds: [embedBlacklist(user, motivo, 'removido', interaction.user)] 
                                }).catch(() => {});
                            }
                        }

                        // Remover cargo de blacklist
                        if (config.cargo_blacklist) {
                            const member = await i.guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                await member.roles.remove(config.cargo_blacklist).catch(() => {});
                            }
                        }

                        await modalResponse.reply({
                            embeds: [embedSucesso('Removido', `<@${userId}> foi removido da blacklist.\n**Motivo:** ${motivo}`)],
                            ephemeral: true
                        });
                    } catch (e) {
                        await modalResponse.reply({
                            embeds: [embedErro('Erro', 'Usuário não encontrado.')],
                            ephemeral: true
                        });
                    }
                } catch (e) {
                    // Modal expirou
                }
            }
        });
    }
};
