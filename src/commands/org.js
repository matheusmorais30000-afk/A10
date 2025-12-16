const { SlashCommandBuilder } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { embedErro, embedSucesso, embedInfo } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('org')
        .setDescription('Recria a organização do servidor (apaga todos os canais e cria a estrutura). (Admin only)'),

    async execute(interaction) {
        const guild = interaction.guild;
        const member = interaction.member;

        // Permissão
        if (!isAdmin(member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem executar este comando.')], ephemeral: true });
        }

        // Verificar permissões do bot
        if (!guild.members.me.permissions.has('ManageChannels')) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Eu preciso da permissão **Manage Channels** para executar essa ação.')], ephemeral: true });
        }

        await interaction.reply({ embeds: [embedInfo('Organização', 'Iniciando exclusão dos canais...')], ephemeral: true });

        try {
            // Protege o canal onde o comando foi executado (evita Unknown Channel nos followUps)
            const protectedChannelId = interaction.channelId;

            // Delete all channels except the channel where the command was run
            const channels = [...guild.channels.cache.values()];
            for (const ch of channels) {
                if (ch.id === protectedChannelId) continue;
                await ch.delete().catch(() => {});
            }

            // Define estrutura solicitada
            const structure = [
                { category: 'Guia', channels: ['💎como jogar', '💎cargos exclusivos'] },
                { category: 'Painel do OWER', channels: ['Chat', 'alerta'] },
                { category: 'Sua Fila', channels: ['👑 events', '🔗 invites', '🎮 Partidas'] },
                { category: '📒 Boas Vindas', channels: ['📒 Regras', '📒 Regras x1'] },
                { category: '🎟️ Suporte', channels: ['🎟️ Suporte'] },
                { category: '📱 Mobile', channels: [] },
                { category: '💻 emulador', channels: [] },
                { category: '🕹️ Tático', channels: [] },
                { category: '📱💻 Misto', channels: [] },
                { category: '🔥 Mural', channels: ['🔥 Partidas', '🔥 Cargos'] },
                { category: '💎 Coins', channels: ['🪙 Ranking', '💎 Loja', '💎 Resgate'] },
                { category: '🚫 Telagem', channels: ['🚫 exposed', '🚫 blacklist', '🚫 regras análise'] },
                // Voice categories with voice channels will be created below
                { category: '📱 Tela mobile', channels: [], voice: ['📱analise 1','📱analise 2','📱analise 3','📱analise 4','📱analise 5'] },
                { category: '💻 Tela emulador', channels: [], voice: ['💻 analise 1','💻 analise 2','💻 analise 3','💻 analise 4','💻 analise 5'] },
                { category: '🕹️ Tela tático', channels: [], voice: ['🕹️ analise 1','🕹️ analise 2','🕹️ analise 3','🕹️ analise 4','🕹️ analise 5'] },
                { category: '📱💻 Tela misto', channels: [], voice: ['📱💻 analise 1','📱💻 analise 2','📱💻 analise 3','📱💻 analise 4','📱💻 analise 5'] }
            ];

            // Create categories and channels
            for (const item of structure) {
                const cat = await guild.channels.create({ name: item.category, type: 4 }).catch(() => null); // 4 = GUILD_CATEGORY
                if (!cat) continue;
                // text channels
                if (Array.isArray(item.channels)) {
                    for (const name of item.channels) {
                        if (!name) continue;
                        await guild.channels.create({ name, type: 0, parent: cat.id }).catch(() => {}); // 0 = GUILD_TEXT
                    }
                }
                // voice channels
                if (Array.isArray(item.voice)) {
                    for (const name of item.voice) {
                        if (!name) continue;
                        await guild.channels.create({ name, type: 2, parent: cat.id }).catch(() => {}); // 2 = GUILD_VOICE
                    }
                }
            }

            // Tentar enviar followUp; caso falhe (canal protegido removido), mandar DM para o usuário
            try {
                await interaction.followUp({ embeds: [embedSucesso('Concluído', 'Organização criada com sucesso.')], ephemeral: true });
            } catch (e) {
                try {
                    await interaction.user.send({ embeds: [embedSucesso('Concluído', 'Organização criada com sucesso.')]}).catch(() => {});
                } catch (e2) {}
            }
        } catch (error) {
            console.error('[ERRO] /org:', error);
            try {
                await interaction.followUp({ embeds: [embedErro('Erro', 'Ocorreu um erro ao recriar a organização.')], ephemeral: true });
            } catch (e) {
                await interaction.user.send({ embeds: [embedErro('Erro', 'Ocorreu um erro ao recriar a organização.')]}).catch(() => {});
            }
        }
    }
};