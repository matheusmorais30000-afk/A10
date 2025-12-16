const { InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');
const { embedErro, embedSucesso, embedInfo, embedPartida, embedConfirmacao, embedPix, embedMediador, embedTicket, embedRanking, embedPerfil, embedBlacklist, getMaxJogadores } = require('../utils/embeds');
const { isAdmin, isMediador, isAnalista, isBlacklisted, hasPix } = require('../utils/permissions');
const { gerarQRCodeBuffer } = require('../utils/qrcode');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        try {
            // Comandos Slash
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction, client);
                } catch (error) {
                    console.error(`[ERRO] Comando ${interaction.commandName}:`, error);
                    const reply = { embeds: [embedErro('Erro', 'Ocorreu um erro ao executar este comando.')], ephemeral: true };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply).catch(() => {});
                    } else {
                        await interaction.reply(reply).catch(() => {});
                    }
                }
                return;
            }

            // Botões
            if (interaction.isButton()) {
                await handleButton(interaction, client);
                return;
            }

            // Select Menus
            if (interaction.isStringSelectMenu()) {
                await handleSelectMenu(interaction, client);
                return;
            }

            // Modais
            if (interaction.type === InteractionType.ModalSubmit) {
                await handleModal(interaction, client);
                return;
            }

        } catch (error) {
            console.error('[ERRO] InteractionCreate:', error);
        }
    }
};

// Handler de botões
async function handleButton(interaction, client) {
    const customId = interaction.customId;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // ========== BOTÕES DE VOLTAR (VISUAL EDITOR) ==========
    
    if (customId === 'visual_back_main') {
        const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('visual_main')
                .setPlaceholder('Escolha o que quer editar')
                .addOptions([
                    { label: 'Embeds', value: 'embeds', description: 'Editar as embeds (partida, mediador, ticket, ranking)' },
                    { label: 'Botões', value: 'botoes', description: 'Editar botões (por embed/fila, mediador, ranking)' }
                ])
        );
        await interaction.update({ embeds: [embedInfo('Visual Editor', 'Selecione se quer editar Embeds ou Botões.')], components: [menu] });
        return;
    }

    if (customId === 'visual_back_embeds') {
        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('visual_embeds_target').setPlaceholder('Escolha a embed').addOptions([
                { label: 'Partida', value: 'partida', description: 'Editar embed de partidas' },
                { label: 'Mediador', value: 'mediador', description: 'Editar painel do mediador' },
                { label: 'Ticket', value: 'ticket', description: 'Editar embed de tickets' },
                { label: 'Ranking', value: 'ranking', description: 'Editar embed de ranking' }
            ])
        );
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('visual_back_main').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        );
        await interaction.update({ embeds: [embedInfo('Visual Editor - Embeds', 'Escolha qual embed deseja editar.')], components: [menu, backRow] });
        return;
    }

    if (customId === 'visual_back_buttons') {
        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('visual_buttons_target').setPlaceholder('Escolha o tipo de botões').addOptions([
                { label: 'Partida (Filas)', value: 'partida', description: 'Editar botões das filas (selecione a fila em seguida)' },
                { label: 'Mediador', value: 'mediador', description: 'Editar botões do painel do mediador' },
                { label: 'Ranking', value: 'ranking', description: 'Editar botões do ranking' }
            ])
        );
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('visual_back_main').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        );
        await interaction.update({ embeds: [embedInfo('Visual Editor - Botões', 'Escolha qual tipo de botões deseja editar.')], components: [menu, backRow] });
        return;
    }

    if (customId === 'visual_back_buttons_partida') {
        const filas = db.getFilasByGuild(guildId);
        if (!filas || filas.length === 0) {
            return interaction.reply({ embeds: [embedErro('Nenhuma Fila', 'Nenhuma fila configurada neste servidor.')], ephemeral: true });
        }

        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        let options = filas.map(f => ({ label: `${f.modalidade} ${f.tipo} - R$${f.preco}`, value: `fila:${f.id}`, description: `Canal de fila` }));
        if (options.length > 25) {
            options = options.slice(0, 25);
        }
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('visual_select_fila').setPlaceholder('Escolha a fila para editar os botões').addOptions(options)
        );
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('visual_back_buttons').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        );
        await interaction.update({ embeds: [embedInfo('Selecionar Fila', 'Escolha a fila que deseja editar os botões.')], components: [menu, backRow] });
        return;
    }

    // ========== BOTÕES DE VOLTAR (CONFIG) ==========
    
    if (customId === 'config_back_main') {
        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
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

        await interaction.update({ embeds: [embed], components: [menu] });
        return;
    }

    // ========== BOTÕES DO CONFIG ==========
    
    // Botão Valores
    if (customId === 'config_valores') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar isso.')], ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('valor_adicionar').setLabel('Adicionar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('valor_remover').setLabel('Remover').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('valor_limpar').setLabel('Limpar Todos').setStyle(ButtonStyle.Secondary)
        );

        const valores = db.getValores(guildId);
        await interaction.reply({
            embeds: [embedInfo('Gerenciar Valores', `**Valores atuais:** ${valores.length > 0 ? valores.map(v => `R$ ${v}`).join(', ') : 'Nenhum'}\n\nEscolha uma ação:`)],
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (customId === 'valor_adicionar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_valor_adicionar')
            .setTitle('Adicionar Valor');

        const input = new TextInputBuilder()
            .setCustomId('valor_input')
            .setLabel('Valor da aposta (apenas números)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 10')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    if (customId === 'valor_remover') {
        const modal = new ModalBuilder()
            .setCustomId('modal_valor_remover')
            .setTitle('Remover Valor');

        const input = new TextInputBuilder()
            .setCustomId('valor_input')
            .setLabel('Valor para remover')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 10')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    if (customId === 'valor_limpar') {
        db.clearValores(guildId);
        await interaction.update({ embeds: [embedSucesso('Valores Limpos', 'Todos os valores foram removidos.')], components: [] });
        return;
    }

    // Botão Cargos
    if (customId === 'config_cargos') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar isso.')], ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cargo_analista').setLabel('Analista').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cargo_mediador').setLabel('Mediador').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cargo_suporte').setLabel('Suporte').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cargo_blacklist').setLabel('Blacklist').setStyle(ButtonStyle.Danger)
        );

        const config = db.getConfig(guildId);
        await interaction.reply({
            embeds: [embedInfo('Gerenciar Cargos', `**Analista:** ${config.cargo_analista ? `<@&${config.cargo_analista}>` : 'Não definido'}\n**Mediador:** ${config.cargo_mediador ? `<@&${config.cargo_mediador}>` : 'Não definido'}\n**Suporte:** ${config.cargo_suporte ? `<@&${config.cargo_suporte}>` : 'Não definido'}\n**Blacklist:** ${config.cargo_blacklist ? `<@&${config.cargo_blacklist}>` : 'Não definido'}`)],
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (customId.startsWith('cargo_')) {
        const tipo = customId.replace('cargo_', '');
        const modal = new ModalBuilder()
            .setCustomId(`modal_cargo_${tipo}`)
            .setTitle(`Definir Cargo ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

        const input = new TextInputBuilder()
            .setCustomId('cargo_id')
            .setLabel('ID do cargo')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Cole o ID do cargo aqui')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    // Botão Logs
    if (customId === 'config_logs') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar isso.')], ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('log_geral').setLabel('Log Geral').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('log_partidas').setLabel('Log Partidas').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('log_mediador').setLabel('Log Mediador').setStyle(ButtonStyle.Primary)
        );

        const config = db.getConfig(guildId);
        await interaction.reply({
            embeds: [embedInfo('Gerenciar Logs', `**Geral:** ${config.log_geral ? `<#${config.log_geral}>` : 'Não definido'}\n**Partidas:** ${config.log_partidas ? `<#${config.log_partidas}>` : 'Não definido'}\n**Mediador:** ${config.log_mediador ? `<#${config.log_mediador}>` : 'Não definido'}`)],
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (customId.startsWith('log_')) {
        const tipo = customId.replace('log_', '');
        const modal = new ModalBuilder()
            .setCustomId(`modal_log_${tipo}`)
            .setTitle(`Definir Canal de Log`);

        const input = new TextInputBuilder()
            .setCustomId('canal_id')
            .setLabel('ID do canal')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Cole o ID do canal aqui')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    // Botão Embed Mediador
    if (customId === 'config_mediador') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar isso.')], ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mediador_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('mediador_preview').setLabel('Preview').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('mediador_postar').setLabel('Postar').setStyle(ButtonStyle.Success)
        );

        await interaction.reply({
            embeds: [embedInfo('Painel do Mediador', 'Configure a embed do painel de mediador.')],
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (customId === 'mediador_editar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_embed_mediador')
            .setTitle('Editar Embed Mediador');

        const titulo = new TextInputBuilder().setCustomId('embed_titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Título da embed');
        const descricao = new TextInputBuilder().setCustomId('embed_descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Descrição da embed');
        const footer = new TextInputBuilder().setCustomId('embed_footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Texto do footer');
        const cor = new TextInputBuilder().setCustomId('embed_cor').setLabel('Cor (Hex, ex: #FF5733)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('#5865F2');
        const imagem = new TextInputBuilder().setCustomId('embed_imagem').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://...');

        modal.addComponents(
            new ActionRowBuilder().addComponents(titulo),
            new ActionRowBuilder().addComponents(descricao),
            new ActionRowBuilder().addComponents(footer),
            new ActionRowBuilder().addComponents(cor),
            new ActionRowBuilder().addComponents(imagem)
        );
        await interaction.showModal(modal);
        return;
    }

    if (customId === 'mediador_preview') {
        const config = db.getConfig(guildId);
        const embed = embedMediador(config);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    if (customId === 'mediador_postar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_mediador_postar')
            .setTitle('Postar Painel do Mediador');

        const input = new TextInputBuilder()
            .setCustomId('canal_id')
            .setLabel('ID do canal para postar')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    // Visual editor quick actions for fila buttons (edit/remove)
    if (customId.startsWith('visual_button_edit_')) {
        const parts = customId.split('_');
        // customId format: visual_button_edit_<filaId>_<index>
        const filaId = parts[3];
        const index = parseInt(parts[4], 10);
        const fila = db.getFila(filaId);
        if (!fila) return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });

        let botoes = [];
        try { botoes = JSON.parse(fila.botoes || '[]'); } catch (e) { botoes = []; }
        const btn = botoes[index] || {};

        const modal = new ModalBuilder().setCustomId(`modal_visual_edit_button_${filaId}_${index}`).setTitle('Editar Botão - Fila');
        const labelInput = new TextInputBuilder().setCustomId('label').setLabel('Label do botão').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(btn.label || 'Texto do botão');
        const styleInput = new TextInputBuilder().setCustomId('style').setLabel('Estilo (primary, secondary, success, danger)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder((btn.style || 'primary'));

        modal.addComponents(new ActionRowBuilder().addComponents(labelInput), new ActionRowBuilder().addComponents(styleInput));
        await interaction.showModal(modal);
        return;
    }

    if (customId.startsWith('visual_button_remove_')) {
        const parts = customId.split('_');
        const filaId = parts[3];
        const index = parseInt(parts[4], 10);
        const fila = db.getFila(filaId);
        if (!fila) return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });

        let botoes = [];
        try { botoes = JSON.parse(fila.botoes || '[]'); } catch (e) { botoes = []; }
        if (index < 0 || index >= botoes.length) return interaction.reply({ embeds: [embedErro('Erro', 'Botão não encontrado.')], ephemeral: true });

        botoes.splice(index, 1);
        db.updateFila(fila.id, 'botoes', JSON.stringify(botoes));

        // Try to update posted message
        try {
            const canal = interaction.guild.channels.cache.get(fila.canal_id);
            const msg = canal ? await canal.messages.fetch(fila.message_id).catch(() => null) : null;
            if (msg) {
                const config = db.getConfig(guildId);
                const embedMsg = embedPartida(config, fila.modalidade, fila.tipo, fila.preco, JSON.parse(fila.jogadores || '[]'));
                const buttons = getFilaButtons(guildId, fila.modalidade, fila.tipo, fila.canal_id, fila.preco);
                await msg.edit({ embeds: [embedMsg], components: buttons }).catch(() => {});
            }
        } catch (e) {}

        await interaction.reply({ embeds: [embedSucesso('Botão Removido', 'O botão foi removido com sucesso.')], ephemeral: true });
        return;
    }

    // Botão Embeds de Partida
    if (customId === 'config_embeds') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar isso.')], ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('partida_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('partida_preview').setLabel('Preview').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            embeds: [embedInfo('Embed de Partidas', 'Configure a embed das filas de partida.\n\n**Variáveis disponíveis:**\n`{{MODALIDADE}}` - Mobile, Emulador, etc\n`{{TIPO}}` - 1v1, 2v2, etc\n`{{PREÇO}}` - Valor da aposta')],
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (customId === 'partida_editar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_embed_partida')
            .setTitle('Editar Embed Partida');

        const titulo = new TextInputBuilder().setCustomId('embed_titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Use {{MODALIDADE}}, {{TIPO}}, {{PREÇO}}');
        const descricao = new TextInputBuilder().setCustomId('embed_descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false);
        const footer = new TextInputBuilder().setCustomId('embed_footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false);
        const cor = new TextInputBuilder().setCustomId('embed_cor').setLabel('Cor (Hex)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('#00FF7F');
        const thumbnail = new TextInputBuilder().setCustomId('embed_thumbnail').setLabel('URL do Thumbnail').setStyle(TextInputStyle.Short).setRequired(false);

        // Discord modals suportam no máximo 5 componentes (action rows), cada um com 1 TextInput.
        modal.addComponents(
            new ActionRowBuilder().addComponents(titulo),
            new ActionRowBuilder().addComponents(descricao),
            new ActionRowBuilder().addComponents(footer),
            new ActionRowBuilder().addComponents(cor),
            new ActionRowBuilder().addComponents(thumbnail)
        );
        await interaction.showModal(modal);
        return;
    }

    if (customId === 'partida_preview') {
        const config = db.getConfig(guildId);
        const embed = embedPartida(config, 'Mobile', '1v1', 10, []);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // Botão Ticket
    if (customId === 'config_ticket') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar isso.')], ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_categoria').setLabel('Definir Categoria').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_postar').setLabel('Postar').setStyle(ButtonStyle.Success)
        );

        await interaction.reply({
            embeds: [embedInfo('Sistema de Tickets', 'Configure o sistema de tickets.')],
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (customId === 'ticket_editar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_embed_ticket')
            .setTitle('Editar Embed Ticket');

        const titulo = new TextInputBuilder().setCustomId('embed_titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(false);
        const descricao = new TextInputBuilder().setCustomId('embed_descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false);
        const footer = new TextInputBuilder().setCustomId('embed_footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false);
        const cor = new TextInputBuilder().setCustomId('embed_cor').setLabel('Cor (Hex)').setStyle(TextInputStyle.Short).setRequired(false);
        const imagem = new TextInputBuilder().setCustomId('embed_imagem').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titulo),
            new ActionRowBuilder().addComponents(descricao),
            new ActionRowBuilder().addComponents(footer),
            new ActionRowBuilder().addComponents(cor),
            new ActionRowBuilder().addComponents(imagem)
        );
        await interaction.showModal(modal);
        return;
    }

    if (customId === 'ticket_categoria') {
        const modal = new ModalBuilder()
            .setCustomId('modal_ticket_categoria')
            .setTitle('Definir Categoria de Tickets');

        const input = new TextInputBuilder()
            .setCustomId('categoria_id')
            .setLabel('ID da categoria')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    if (customId === 'ticket_postar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_ticket_postar')
            .setTitle('Postar Sistema de Tickets');

        const input = new TextInputBuilder()
            .setCustomId('canal_id')
            .setLabel('ID do canal')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    // Botão Ranking
    if (customId === 'config_ranking') {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Apenas administradores podem usar isso.')], ephemeral: true });
        }

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ranking_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ranking_postar').setLabel('Postar').setStyle(ButtonStyle.Success)
        );

        await interaction.reply({
            embeds: [embedInfo('Sistema de Ranking', 'Configure o sistema de ranking.')],
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (customId === 'ranking_editar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_embed_ranking')
            .setTitle('Editar Embed Ranking');

        const titulo = new TextInputBuilder().setCustomId('embed_titulo').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(false);
        const descricao = new TextInputBuilder().setCustomId('embed_descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false);
        const footer = new TextInputBuilder().setCustomId('embed_footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false);
        const cor = new TextInputBuilder().setCustomId('embed_cor').setLabel('Cor (Hex)').setStyle(TextInputStyle.Short).setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titulo),
            new ActionRowBuilder().addComponents(descricao),
            new ActionRowBuilder().addComponents(footer),
            new ActionRowBuilder().addComponents(cor)
        );
        await interaction.showModal(modal);
        return;
    }

    if (customId === 'ranking_postar') {
        const modal = new ModalBuilder()
            .setCustomId('modal_ranking_postar')
            .setTitle('Postar Sistema de Ranking');

        const input = new TextInputBuilder()
            .setCustomId('canal_id')
            .setLabel('ID do canal')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    // ========== BOTÕES DO RANKING ==========
    
    if (customId === 'ranking_perfil') {
        const dados = db.getUsuario(userId, guildId);
        const embed = embedPerfil(interaction.user, dados);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    if (customId === 'ranking_top10') {
        const topPlayers = db.getTop10(guildId);
        const config = db.getConfig(guildId);
        const embed = embedRanking(topPlayers, interaction.guild, config);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // ========== BOTÕES DO MEDIADOR ==========
    
    if (customId === 'mediador_entrar') {
        const config = db.getConfig(guildId);
        
        if (!isMediador(interaction.member, guildId) && !isAnalista(interaction.member, guildId)) {
            return interaction.reply({ embeds: [embedErro('Sem Permissão', 'Você não tem permissão para mediar partidas.')], ephemeral: true });
        }

        if (!hasPix(userId, guildId)) {
            return interaction.reply({ embeds: [embedErro('PIX Não Cadastrado', 'Você precisa cadastrar sua chave PIX usando `/pix` antes de mediar partidas.')], ephemeral: true });
        }

        // Log de entrada
        if (config.log_mediador) {
            const logChannel = interaction.guild.channels.cache.get(config.log_mediador);
            if (logChannel) {
                logChannel.send({ embeds: [embedInfo('Mediador Entrou', `<@${userId}> entrou no painel de mediação.`)] }).catch(() => {});
            }
        }

        // Atualizar lista de mediadores ativos e atualizar a mensagem do painel
        try {
            const mediadores = db.getMediadoresAtivos(guildId);
            if (!mediadores.includes(userId)) {
                mediadores.push(userId);
                db.setMediadoresAtivos(guildId, mediadores);
            }

            const messageId = config.mensagem_mediador;
            if (messageId) {
                const canal = interaction.guild.channels.cache.get(config.canal_mediador);
                const msg = canal ? await canal.messages.fetch(messageId).catch(() => null) : null;
                if (msg) {
                    const preview = embedMediador(config, mediadores);
                    await msg.edit({ embeds: [preview], components: msg.components, allowedMentions: { users: mediadores } }).catch(() => {});
                }
            }
        } catch (e) {
            // ignorar erros de atualização
        }

        await interaction.reply({ embeds: [embedSucesso('Modo Mediador', 'Você está agora no modo de mediação! Aguarde partidas para mediar.')], ephemeral: true });
        return;
    }

    if (customId === 'mediador_sair') {
        const config = db.getConfig(guildId);

        // Log de saída
        if (config.log_mediador) {
            const logChannel = interaction.guild.channels.cache.get(config.log_mediador);
            if (logChannel) {
                logChannel.send({ embeds: [embedInfo('Mediador Saiu', `<@${userId}> saiu do painel de mediação.`)] }).catch(() => {});
            }
        }

        // Remover o mediador da lista ativa e atualizar mensagem do painel
        try {
            const mediadores = db.getMediadoresAtivos(guildId).filter(id => id !== userId);
            db.setMediadoresAtivos(guildId, mediadores);

            const messageId = config.mensagem_mediador;
            if (messageId) {
                const canal = interaction.guild.channels.cache.get(config.canal_mediador);
                const msg = canal ? await canal.messages.fetch(messageId).catch(() => null) : null;
                if (msg) {
                    const preview = embedMediador(config, mediadores);
                    await msg.edit({ embeds: [preview], components: msg.components, allowedMentions: { users: mediadores } }).catch(() => {});
                }
            }
        } catch (e) {
            // ignorar erros de atualização
        }

        await interaction.reply({ embeds: [embedSucesso('Modo Mediador', 'Você saiu do modo de mediação.')], ephemeral: true });
        return;
    }

    // ========== BOTÕES DE FILA/PARTIDA ==========
    
    // Entrar na fila
    if (customId.startsWith('fila_entrar_') || customId.startsWith('fila_gelo_infinito_') || customId.startsWith('fila_gelo_normal_') || customId.startsWith('fila_full_ump_') || customId.startsWith('fila_1emu_') || customId.startsWith('fila_2emu_') || customId.startsWith('fila_3emu_')) {
        await handleFilaEntrar(interaction, client);
        return;
    }

    // Sair da fila
    if (customId.startsWith('fila_sair_')) {
        await handleFilaSair(interaction, client);
        return;
    }

    // Confirmar partida
    if (customId.startsWith('partida_confirmar_')) {
        await handlePartidaConfirmar(interaction, client);
        return;
    }

    // Encerrar partida
    if (customId.startsWith('partida_encerrar_')) {
        await handlePartidaEncerrar(interaction, client);
        return;
    }

    // Análise
    if (customId.startsWith('partida_analise_')) {
        const modal = new ModalBuilder()
            .setCustomId(`modal_analise_${customId.split('_')[2]}`)
            .setTitle('Solicitar Análise');

        const usuario = new TextInputBuilder().setCustomId('analise_usuario').setLabel('@ do usuário').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('@usuario ou ID');
        const motivo = new TextInputBuilder().setCustomId('analise_motivo').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true);
        const tipo = new TextInputBuilder().setCustomId('analise_tipo').setLabel('Tipo de análise').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Hack, Bug, Outro...');

        modal.addComponents(
            new ActionRowBuilder().addComponents(usuario),
            new ActionRowBuilder().addComponents(motivo),
            new ActionRowBuilder().addComponents(tipo)
        );
        await interaction.showModal(modal);
        return;
    }

    // Fechar ticket
    if (customId === 'ticket_fechar') {
        await interaction.reply({ embeds: [embedInfo('Fechando...', 'Este ticket será fechado em 5 segundos.')], ephemeral: false });
        setTimeout(async () => {
            try {
                db.closeTicket(interaction.channel.id);
                await interaction.channel.delete().catch(() => {});
            } catch (e) {
                console.error('[ERRO] Fechar ticket:', e);
            }
        }, 5000);
        return;
    }
}

// Handler de Select Menus
async function handleSelectMenu(interaction, client) {
    const customId = interaction.customId;
    const guildId = interaction.guild.id;
    const selected = interaction.values[0];

    // Select de Ticket
    if (customId === 'ticket_select') {
        const config = db.getConfig(guildId);
        
        if (!config.categoria_ticket) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Categoria de tickets não configurada.')], ephemeral: true });
        }

        try {
            const categoria = interaction.guild.channels.cache.get(config.categoria_ticket);
            if (!categoria || categoria.type !== ChannelType.GuildCategory) {
                return interaction.reply({ embeds: [embedErro('Erro', 'Categoria de tickets não configurada ou inválida.')], ephemeral: true });
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: config.categoria_ticket,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    ...(config.cargo_suporte ? [{ id: config.cargo_suporte, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
                ]
            });

            db.createTicket(guildId, interaction.user.id, ticketChannel.id, selected);

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_fechar').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [embedInfo(`Ticket - ${selected}`, `Olá <@${interaction.user.id}>!\n\nVocê abriu um ticket de **${selected}**.\nAguarde um membro da equipe atendê-lo.`)],
                components: [row]
            });

            await interaction.reply({ embeds: [embedSucesso('Ticket Criado', `Seu ticket foi criado em <#${ticketChannel.id}>`)], ephemeral: true });
        } catch (error) {
            console.error('[ERRO] Criar ticket:', error);
            return interaction.reply({ embeds: [embedErro('Erro', 'Não foi possível criar o ticket.')], ephemeral: true });
        }
    }

    // ========== NOVO: MENU /config (seletor) ==========
    if (customId === 'config_menu') {
        const escolha = selected; // 'valores' | 'cargos' | 'logs'

        if (escolha === 'valores') {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('valor_adicionar').setLabel('Adicionar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('valor_remover').setLabel('Remover').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('valor_limpar').setLabel('Limpar Todos').setStyle(ButtonStyle.Secondary)
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('config_back_main').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );

            const valores = db.getValores(guildId);
            return interaction.update({ embeds: [embedInfo('Gerenciar Valores', `**Valores atuais:** ${valores.length > 0 ? valores.map(v => `R$ ${v}`).join(', ') : 'Nenhum'}\n\nEscolha uma ação:`)], components: [row, backRow] });
        }

        if (escolha === 'cargos') {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cargo_analista').setLabel('Analista').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cargo_mediador').setLabel('Mediador').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cargo_suporte').setLabel('Suporte').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cargo_blacklist').setLabel('Blacklist').setStyle(ButtonStyle.Danger)
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('config_back_main').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );

            const config = db.getConfig(guildId);
            return interaction.update({ embeds: [embedInfo('Gerenciar Cargos', `**Analista:** ${config.cargo_analista ? `<@&${config.cargo_analista}>` : 'Não definido'}\n**Mediador:** ${config.cargo_mediador ? `<@&${config.cargo_mediador}>` : 'Não definido'}\n**Suporte:** ${config.cargo_suporte ? `<@&${config.cargo_suporte}>` : 'Não definido'}\n**Blacklist:** ${config.cargo_blacklist ? `<@&${config.cargo_blacklist}>` : 'Não definido'}`)], components: [row, backRow] });
        }

        if (escolha === 'logs') {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('log_geral').setLabel('Log Geral').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('log_partidas').setLabel('Log Partidas').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('log_mediador').setLabel('Log Mediador').setStyle(ButtonStyle.Primary)
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('config_back_main').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );

            const config = db.getConfig(guildId);
            return interaction.update({ embeds: [embedInfo('Gerenciar Logs', `**Geral:** ${config.log_geral ? `<#${config.log_geral}>` : 'Não definido'}\n**Partidas:** ${config.log_partidas ? `<#${config.log_partidas}>` : 'Não definido'}\n**Mediador:** ${config.log_mediador ? `<#${config.log_mediador}>` : 'Não definido'}`)], components: [row, backRow] });
        }

        return interaction.reply({ embeds: [embedErro('Erro', 'Opção inválida.')], ephemeral: true });
    }

    // Select de modalidade (filas)
    if (customId === 'filas_modalidade') {
        const modal = new ModalBuilder()
            .setCustomId(`modal_filas_${selected}`)
            .setTitle(`Configurar Filas - ${selected}`);

        const input = new TextInputBuilder()
            .setCustomId('categoria_id')
            .setLabel('ID da Categoria')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Cole o ID da categoria aqui')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    // ========== VISUAL EDITOR (NEW) ==========
    // Step 1: chose Embeds or Buttons
    if (customId === 'visual_main') {
        if (selected === 'embeds') {
            const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('visual_embeds_target').setPlaceholder('Escolha a embed').addOptions([
                    { label: 'Partida', value: 'partida', description: 'Editar embed de partidas' },
                    { label: 'Mediador', value: 'mediador', description: 'Editar painel do mediador' },
                    { label: 'Ticket', value: 'ticket', description: 'Editar embed de tickets' },
                    { label: 'Ranking', value: 'ranking', description: 'Editar embed de ranking' }
                ])
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('visual_back_main').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );
            await interaction.update({ embeds: [embedInfo('Visual Editor - Embeds', 'Escolha qual embed deseja editar.')], components: [menu, backRow] });
            return;
        }

        if (selected === 'botoes' || selected === 'buttons') {
            const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('visual_buttons_target').setPlaceholder('Escolha o tipo de botões').addOptions([
                    { label: 'Partida (Filas)', value: 'partida', description: 'Editar botões das filas (selecione a fila em seguida)' },
                    { label: 'Mediador', value: 'mediador', description: 'Editar botões do painel do mediador' },
                    { label: 'Ranking', value: 'ranking', description: 'Editar botões do ranking' }
                ])
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('visual_back_main').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );
            await interaction.update({ embeds: [embedInfo('Visual Editor - Botões', 'Escolha qual tipo de botões deseja editar.')], components: [menu, backRow] });
            return;
        }
    }

    // Step 2a: For embeds -> show edit options
    if (customId === 'visual_embeds_target') {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        if (selected === 'partida') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('partida_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('partida_preview').setLabel('Preview').setStyle(ButtonStyle.Secondary)
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('visual_back_embeds').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );
            await interaction.update({ embeds: [embedInfo('Embed de Partidas', 'Configure a embed das filas de partida.\n\n**Variáveis disponíveis:**\n`{{MODALIDADE}}` - Mobile, Emulador, etc\n`{{TIPO}}` - 1v1, 2v2, etc\n`{{PREÇO}}` - Valor da aposta')], components: [row, backRow] });
            return;
        }
        
        if (selected === 'mediador') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('mediador_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('mediador_preview').setLabel('Preview').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('mediador_postar').setLabel('Postar').setStyle(ButtonStyle.Success)
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('visual_back_embeds').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );
            await interaction.update({ embeds: [embedInfo('Painel do Mediador', 'Configure a embed do painel de mediador.')], components: [row, backRow] });
            return;
        }
        
        if (selected === 'ticket') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_categoria').setLabel('Definir Categoria').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket_postar').setLabel('Postar').setStyle(ButtonStyle.Success)
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('visual_back_embeds').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );
            await interaction.update({ embeds: [embedInfo('Sistema de Tickets', 'Configure o sistema de tickets.')], components: [row, backRow] });
            return;
        }
        
        if (selected === 'ranking') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ranking_editar').setLabel('Editar Embed').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ranking_postar').setLabel('Postar').setStyle(ButtonStyle.Success)
            );
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('visual_back_embeds').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
            );
            await interaction.update({ embeds: [embedInfo('Sistema de Ranking', 'Configure o sistema de ranking.')], components: [row, backRow] });
            return;
        }
    }

    // Step 2b: For buttons -> choose specific target (e.g., partida -> choose fila)
    if (customId === 'visual_buttons_target' && selected === 'partida') {
        const filas = db.getFilasByGuild(guildId);
        if (!filas || filas.length === 0) {
            return interaction.reply({ embeds: [embedErro('Nenhuma Fila', 'Nenhuma fila configurada neste servidor.')], ephemeral: true });
        }

        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        let options = filas.map(f => ({ label: `${f.modalidade} ${f.tipo} - R$${f.preco}`, value: `fila:${f.id}`, description: `Canal de fila` }));
        if (options.length > 25) {
            const moreCount = options.length - 25;
            options = options.slice(0, 25);
            options.push({ label: `... e mais ${moreCount} filas`, value: 'visual_filas_more', description: 'Existem muitas filas - use /config para filtrar' });
        }
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('visual_select_fila').setPlaceholder('Escolha a fila para editar os botões').addOptions(options)
        );
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('visual_back_buttons').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        );
        await interaction.update({ embeds: [embedInfo('Selecionar Fila', 'Escolha a fila que deseja editar os botões.')], components: [menu, backRow] });
        return; 
    }

    // Step 3: After selecting a fila, show its buttons and options to add/edit/remove
    if (customId === 'visual_select_fila') {
        const value = selected; // e.g., 'fila:12'
        if (value === 'visual_filas_more') {
            return interaction.reply({ embeds: [embedErro('Limite de opções', 'Existem muitas filas para mostrar. Use o painel de configuração para filtrar ou remover filas antigas.')], ephemeral: true });
        }
        if (!value.startsWith('fila:')) return interaction.reply({ embeds: [embedErro('Erro', 'Valor inválido.')], ephemeral: true });
        const filaId = value.split(':')[1];
        const fila = db.getFila(filaId);
        if (!fila) return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });

        let botoes = [];
        try { botoes = JSON.parse(fila.botoes || '[]'); } catch (e) { botoes = []; }

        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const menu = new ActionRowBuilder();
        let options = [];

        for (let i = 0; i < botoes.length; i++) {
            const b = botoes[i];
            options.push({ label: b.label || `Botão ${i + 1}`, value: `fila_btn:${fila.id}:${i}`, description: `${(b.style || 'PRIMARY').toLowerCase()}` });
        }

        const maxOptions = 25;
        const reserved = 2;
        if (options.length > maxOptions - reserved) {
            const moreCount = options.length - (maxOptions - reserved);
            options = options.slice(0, maxOptions - reserved);
            options.push({ label: `... e mais ${moreCount} botões`, value: 'visual_btns_more', description: 'Remova alguns botões para ver todos' });
        }

        options.push({ label: '➕ Adicionar novo botão', value: `fila_add:${fila.id}`, description: 'Adicionar um botão nesta fila' });
        options.push({ label: '🗑️ Remover todos os botões', value: `fila_remove_all:${fila.id}`, description: 'Remover todos os botões desta fila' });

        menu.addComponents(new StringSelectMenuBuilder().setCustomId('visual_select_fila_button').setPlaceholder('Escolha uma ação').addOptions(options));
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('visual_back_buttons_partida').setLabel('Voltar').setStyle(ButtonStyle.Secondary).setEmoji('◀️')
        );
        await interaction.update({ embeds: [embedInfo('Editar Botões - Fila', `Fila selecionada: **${fila.modalidade} ${fila.tipo} - R$${fila.preco}**`)], components: [menu, backRow] });
        return;
    }

    // Step 4: Handle actions on fila buttons
    if (customId === 'visual_select_fila_button') {
        const value = selected; // e.g., 'fila_btn:12:0' or 'fila_add:12'
        if (value === 'visual_btns_more') {
            return interaction.reply({ embeds: [embedErro('Limite de opções', 'Existem muitos botões nesta fila para mostrar. Remova alguns para continuar.')], ephemeral: true });
        }
        if (value.startsWith('fila_add:')) {
            const filaId = value.split(':')[1];
            const modal = new ModalBuilder().setCustomId(`modal_visual_add_button_${filaId}`).setTitle('Adicionar Botão - Fila');
            const labelInput = new TextInputBuilder().setCustomId('label').setLabel('Label do botão').setStyle(TextInputStyle.Short).setRequired(true);
            const styleInput = new TextInputBuilder().setCustomId('style').setLabel('Estilo (primary, secondary, success, danger)').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(labelInput), new ActionRowBuilder().addComponents(styleInput));
            await interaction.showModal(modal);
            return;
        }

        if (value.startsWith('fila_btn:')) {
            const parts = value.split(':');
            const filaId = parts[1];
            const index = parseInt(parts[2], 10);
            const fila = db.getFila(filaId);
            if (!fila) return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });

            let botoes = [];
            try { botoes = JSON.parse(fila.botoes || '[]'); } catch (e) { botoes = []; }
            const btn = botoes[index];

            // Show quick action buttons: Edit or Remove
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`visual_button_edit_${fila.id}_${index}`).setLabel('Editar').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`visual_button_remove_${fila.id}_${index}`).setLabel('Remover').setStyle(ButtonStyle.Danger)
            );

            await interaction.reply({ embeds: [embedInfo('Ação de Botão', `Botão: **${btn ? btn.label : `Botão ${index + 1}`}**
Escolha Editar para alterar label/estilo, ou Remover para deletar este botão.`)], components: [row], ephemeral: true });
            return;
        }

        if (value.startsWith('fila_remove_all:')) {
            const filaId = value.split(':')[1];
            const fila = db.getFila(filaId);
            if (!fila) return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });
            db.updateFila(fila.id, 'botoes', JSON.stringify([]));

            // Try to update posted message
            try {
                const canal = interaction.guild.channels.cache.get(fila.canal_id);
                const msg = canal ? await canal.messages.fetch(fila.message_id).catch(() => null) : null;
                if (msg) {
                    const config = db.getConfig(guildId);
                    const embedMsg = embedPartida(config, fila.modalidade, fila.tipo, fila.preco, JSON.parse(fila.jogadores || '[]'));
                    const buttons = getFilaButtons(guildId, fila.modalidade, fila.tipo, fila.canal_id, fila.preco);
                    await msg.edit({ embeds: [embedMsg], components: buttons }).catch(() => {});
                }
            } catch (e) {}

            await interaction.reply({ embeds: [embedSucesso('Botões Removidos', 'Todos os botões desta fila foram removidos.')], ephemeral: true });
            return;
        }
    }
}

// Handler de Modais
async function handleModal(interaction, client) {
    const customId = interaction.customId;
    const guildId = interaction.guild.id;

    // Modal de valor
    if (customId === 'modal_valor_adicionar') {
        const valor = parseFloat(interaction.fields.getTextInputValue('valor_input'));
        if (isNaN(valor) || valor <= 0) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Digite um valor numérico válido.')], ephemeral: true });
        }
        db.addValor(guildId, valor);
        await interaction.reply({ embeds: [embedSucesso('Valor Adicionado', `R$ ${valor} foi adicionado aos valores de aposta.`)], ephemeral: true });
        return;
    }

    if (customId === 'modal_valor_remover') {
        const valor = parseFloat(interaction.fields.getTextInputValue('valor_input'));
        db.removeValor(guildId, valor);
        await interaction.reply({ embeds: [embedSucesso('Valor Removido', `R$ ${valor} foi removido dos valores de aposta.`)], ephemeral: true });
        return;
    }

    // Modal de cargos
    if (customId.startsWith('modal_cargo_')) {
        const tipo = customId.replace('modal_cargo_', '');
        const cargoId = interaction.fields.getTextInputValue('cargo_id');
        
        const cargo = interaction.guild.roles.cache.get(cargoId);
        if (!cargo) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Cargo não encontrado. Verifique o ID.')], ephemeral: true });
        }

        db.updateConfig(guildId, `cargo_${tipo}`, cargoId);
        await interaction.reply({ embeds: [embedSucesso('Cargo Definido', `Cargo de ${tipo} definido para <@&${cargoId}>`)], ephemeral: true });
        return;
    }

    // Modal de logs
    if (customId.startsWith('modal_log_')) {
        const tipo = customId.replace('modal_log_', '');
        const canalId = interaction.fields.getTextInputValue('canal_id');
        
        const canal = interaction.guild.channels.cache.get(canalId);
        if (!canal) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Canal não encontrado. Verifique o ID.')], ephemeral: true });
        }

        db.updateConfig(guildId, `log_${tipo}`, canalId);
        await interaction.reply({ embeds: [embedSucesso('Log Definido', `Canal de log ${tipo} definido para <#${canalId}>`)], ephemeral: true });
        return;
    }

    // Modal de embed mediador
    if (customId === 'modal_embed_mediador') {
        // Fazer merge parcial: não sobrescrever campos não fornecidos
        const config = db.getConfig(guildId);
        const existing = JSON.parse(config.embed_mediador || '{}');

        const tituloVal = interaction.fields.getTextInputValue('embed_titulo');
        const descricaoVal = interaction.fields.getTextInputValue('embed_descricao');
        const footerVal = interaction.fields.getTextInputValue('embed_footer');
        const corVal = interaction.fields.getTextInputValue('embed_cor');
        const imagemVal = interaction.fields.getTextInputValue('embed_imagem');

        const merged = { ...existing };
        if (tituloVal && tituloVal.trim() !== '') merged.titulo = tituloVal;
        if (descricaoVal && descricaoVal.trim() !== '') merged.descricao = descricaoVal;
        if (footerVal && footerVal.trim() !== '') merged.footer = footerVal;
        if (imagemVal && imagemVal.trim() !== '') merged.imagem = imagemVal;

        if (corVal && corVal.trim() !== '') {
            const parsed = parseInt(corVal.replace('#', ''), 16);
            if (!isNaN(parsed)) merged.cor = parsed;
        }

        db.updateConfig(guildId, 'embed_mediador', JSON.stringify(merged));
        await interaction.reply({ embeds: [embedSucesso('Embed Atualizada', 'A embed do mediador foi atualizada.')], ephemeral: true });

        // Mostrar preview da embed atualizada
        try {
            const refreshed = db.getConfig(guildId);
            const preview = embedMediador(refreshed);
            await interaction.followUp({ embeds: [preview], ephemeral: true });
        } catch (e) {
            // Ignorar falha no preview
        }
        return;
    }

    // Modal postar mediador
    if (customId === 'modal_mediador_postar') {
        const canalId = interaction.fields.getTextInputValue('canal_id');
        const canal = interaction.guild.channels.cache.get(canalId);
        
        if (!canal) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Canal não encontrado.')], ephemeral: true });
        }

        const config = db.getConfig(guildId);
        const embed = embedMediador(config);

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mediador_entrar').setLabel('Entrar').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('mediador_sair').setLabel('Sair').setStyle(ButtonStyle.Danger).setEmoji('🚪')
        );

        // Enviar painel e salvar messageId em config para atualizações futuras
        const message = await canal.send({ embeds: [embed], components: [row], allowedMentions: { parse: ['users'] } });
        db.updateConfig(guildId, 'canal_mediador', canalId);
        db.updateConfig(guildId, 'mensagem_mediador', message.id);
        await interaction.reply({ embeds: [embedSucesso('Painel Postado', `Painel do mediador postado em <#${canalId}>`)], ephemeral: true });
        return;
    }

    // Modal de embed partida
    if (customId === 'modal_embed_partida') {
        const config = db.getConfig(guildId);
        const existing = JSON.parse(config.embed_partida || '{}');

        const tituloVal = interaction.fields.getTextInputValue('embed_titulo');
        const descricaoVal = interaction.fields.getTextInputValue('embed_descricao');
        const footerVal = interaction.fields.getTextInputValue('embed_footer');
        const corVal = interaction.fields.getTextInputValue('embed_cor');
        const thumbnailVal = interaction.fields.getTextInputValue('embed_thumbnail');

        const merged = { ...existing };
        if (tituloVal && tituloVal.trim() !== '') merged.titulo = tituloVal;
        if (descricaoVal && descricaoVal.trim() !== '') merged.descricao = descricaoVal;
        if (footerVal && footerVal.trim() !== '') merged.footer = footerVal;
        if (thumbnailVal && thumbnailVal.trim() !== '') merged.thumbnail = thumbnailVal;

        if (corVal && corVal.trim() !== '') {
            const parsed = parseInt(corVal.replace('#', ''), 16);
            if (!isNaN(parsed)) merged.cor = parsed;
        }

        db.updateConfig(guildId, 'embed_partida', JSON.stringify(merged));
        await interaction.reply({ embeds: [embedSucesso('Embed Atualizada', 'A embed de partidas foi atualizada.')], ephemeral: true });

        // Mostrar preview com um exemplo (usar primeiro valor configurado ou 10)
        try {
            const refreshed = db.getConfig(guildId);
            const valores = db.getValores(guildId);
            const samplePreco = valores.length > 0 ? valores[0] : 10;
            const preview = embedPartida(refreshed, 'Mobile', '1v1', samplePreco, []);
            await interaction.followUp({ embeds: [preview], ephemeral: true });
        } catch (e) {}
        return;
    }

    // ========== MODAIS DO VISUAL EDITOR ==========
    if (customId.startsWith('modal_visual_add_button_')) {
        const filaId = customId.replace('modal_visual_add_button_', '');
        const label = interaction.fields.getTextInputValue('label');
        const styleRaw = interaction.fields.getTextInputValue('style') || 'primary';
        const style = styleRaw.toUpperCase();
        const fila = db.getFila(filaId);
        if (!fila) return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });

        let botoes = [];
        try { botoes = JSON.parse(fila.botoes || '[]'); } catch (e) { botoes = []; }

        const newCustomId = `fila_btn_${fila.id}_${Date.now()}`;
        botoes.push({ customId: newCustomId, label, style });
        db.updateFila(fila.id, 'botoes', JSON.stringify(botoes));

        // Try to update posted message
        try {
            const canal = interaction.guild.channels.cache.get(fila.canal_id);
            const msg = canal ? await canal.messages.fetch(fila.message_id).catch(() => null) : null;
            if (msg) {
                const config = db.getConfig(guildId);
                const embedMsg = embedPartida(config, fila.modalidade, fila.tipo, fila.preco, JSON.parse(fila.jogadores || '[]'));
                const buttons = getFilaButtons(guildId, fila.modalidade, fila.tipo, fila.canal_id, fila.preco);
                await msg.edit({ embeds: [embedMsg], components: buttons }).catch(() => {});
            }
        } catch (e) {}

        await interaction.reply({ embeds: [embedSucesso('Botão Adicionado', 'O botão foi adicionado com sucesso.')], ephemeral: true });
        return;
    }

    if (customId.startsWith('modal_visual_edit_button_')) {
        const idPart = customId.replace('modal_visual_edit_button_', '');
        const [filaId, idxStr] = idPart.split('_');
        const index = parseInt(idxStr, 10);
        const label = interaction.fields.getTextInputValue('label');
        const style = (interaction.fields.getTextInputValue('style') || 'primary').toUpperCase();

        const fila = db.getFila(filaId);
        if (!fila) return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });

        let botoes = [];
        try { botoes = JSON.parse(fila.botoes || '[]'); } catch (e) { botoes = []; }
        if (index < 0 || index >= botoes.length) return interaction.reply({ embeds: [embedErro('Erro', 'Botão não encontrado.')], ephemeral: true });

        botoes[index].label = label;
        botoes[index].style = style;
        db.updateFila(fila.id, 'botoes', JSON.stringify(botoes));

        // Try to update posted message
        try {
            const canal = interaction.guild.channels.cache.get(fila.canal_id);
            const msg = canal ? await canal.messages.fetch(fila.message_id).catch(() => null) : null;
            if (msg) {
                const config = db.getConfig(guildId);
                const embedMsg = embedPartida(config, fila.modalidade, fila.tipo, fila.preco, JSON.parse(fila.jogadores || '[]'));
                const buttons = getFilaButtons(guildId, fila.modalidade, fila.tipo, fila.canal_id, fila.preco);
                await msg.edit({ embeds: [embedMsg], components: buttons }).catch(() => {});
            }
        } catch (e) {}

        await interaction.reply({ embeds: [embedSucesso('Botão Atualizado', 'O botão foi atualizado com sucesso.')], ephemeral: true });
        return;
    }

    // Modal de embed ticket
    if (customId === 'modal_embed_ticket') {
        const config = db.getConfig(guildId);
        const existing = JSON.parse(config.embed_ticket || '{}');

        const tituloVal = interaction.fields.getTextInputValue('embed_titulo');
        const descricaoVal = interaction.fields.getTextInputValue('embed_descricao');
        const footerVal = interaction.fields.getTextInputValue('embed_footer');
        const corVal = interaction.fields.getTextInputValue('embed_cor');
        const imagemVal = interaction.fields.getTextInputValue('embed_imagem');

        const merged = { ...existing };
        if (tituloVal && tituloVal.trim() !== '') merged.titulo = tituloVal;
        if (descricaoVal && descricaoVal.trim() !== '') merged.descricao = descricaoVal;
        if (footerVal && footerVal.trim() !== '') merged.footer = footerVal;
        if (imagemVal && imagemVal.trim() !== '') merged.imagem = imagemVal;

        if (corVal && corVal.trim() !== '') {
            const parsed = parseInt(corVal.replace('#', ''), 16);
            if (!isNaN(parsed)) merged.cor = parsed;
        }

        db.updateConfig(guildId, 'embed_ticket', JSON.stringify(merged));
        await interaction.reply({ embeds: [embedSucesso('Embed Atualizada', 'A embed de tickets foi atualizada.')], ephemeral: true });

        try {
            const refreshed = db.getConfig(guildId);
            const preview = embedTicket(refreshed);
            await interaction.followUp({ embeds: [preview], ephemeral: true });
        } catch (e) {}
        return;
    }

    // Modal categoria ticket
    if (customId === 'modal_ticket_categoria') {
        const categoriaId = interaction.fields.getTextInputValue('categoria_id');
        const categoria = interaction.guild.channels.cache.get(categoriaId);
        
        if (!categoria || categoria.type !== ChannelType.GuildCategory) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Categoria não encontrada.')], ephemeral: true });
        }

        db.updateConfig(guildId, 'categoria_ticket', categoriaId);
        await interaction.reply({ embeds: [embedSucesso('Categoria Definida', `Categoria de tickets definida.`)], ephemeral: true });
        return;
    }

    // Modal postar ticket
    if (customId === 'modal_ticket_postar') {
        const canalId = interaction.fields.getTextInputValue('canal_id');
        const canal = interaction.guild.channels.cache.get(canalId);
        
        if (!canal) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Canal não encontrado.')], ephemeral: true });
        }

        const config = db.getConfig(guildId);
        const embed = embedTicket(config);

        const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Selecione uma opção')
                .addOptions([
                    { label: 'Parcerias', value: 'Parcerias', emoji: '🤝' },
                    { label: 'Suporte', value: 'Suporte', emoji: '🎫' },
                    { label: 'Virar Influencer', value: 'Influencer', emoji: '⭐' }
                ])
        );

        await canal.send({ embeds: [embed], components: [row] });
        db.updateConfig(guildId, 'canal_ticket', canalId);
        await interaction.reply({ embeds: [embedSucesso('Ticket Postado', `Sistema de tickets postado em <#${canalId}>`)], ephemeral: true });
        return;
    }

    // Modal de embed ranking
    if (customId === 'modal_embed_ranking') {
        const config = db.getConfig(guildId);
        const existing = JSON.parse(config.embed_ranking || '{}');

        const tituloVal = interaction.fields.getTextInputValue('embed_titulo');
        const descricaoVal = interaction.fields.getTextInputValue('embed_descricao');
        const footerVal = interaction.fields.getTextInputValue('embed_footer');
        const corVal = interaction.fields.getTextInputValue('embed_cor');

        const merged = { ...existing };
        if (tituloVal && tituloVal.trim() !== '') merged.titulo = tituloVal;
        if (descricaoVal && descricaoVal.trim() !== '') merged.descricao = descricaoVal;
        if (footerVal && footerVal.trim() !== '') merged.footer = footerVal;

        if (corVal && corVal.trim() !== '') {
            const parsed = parseInt(corVal.replace('#', ''), 16);
            if (!isNaN(parsed)) merged.cor = parsed;
        }

        db.updateConfig(guildId, 'embed_ranking', JSON.stringify(merged));
        await interaction.reply({ embeds: [embedSucesso('Embed Atualizada', 'A embed de ranking foi atualizada.')], ephemeral: true });

        try {
            const topPlayers = db.getTop10(guildId);
            const refreshed = db.getConfig(guildId);
            const preview = embedRanking(topPlayers, interaction.guild, refreshed);
            await interaction.followUp({ embeds: [preview], ephemeral: true });
        } catch (e) {}
        return;
    }

    // Modal postar ranking
    if (customId === 'modal_ranking_postar') {
        const canalId = interaction.fields.getTextInputValue('canal_id');
        const canal = interaction.guild.channels.cache.get(canalId);
        
        if (!canal) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Canal não encontrado.')], ephemeral: true });
        }

        const topPlayers = db.getTop10(guildId);
        const config = db.getConfig(guildId);
        const embed = embedRanking(topPlayers, interaction.guild, config);

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ranking_perfil').setLabel('Meu Perfil').setStyle(ButtonStyle.Primary).setEmoji('👤'),
            new ButtonBuilder().setCustomId('ranking_top10').setLabel('Top 10').setStyle(ButtonStyle.Success).setEmoji('🏆')
        );

        await canal.send({ embeds: [embed], components: [row] });
        db.updateConfig(guildId, 'canal_ranking', canalId);
        await interaction.reply({ embeds: [embedSucesso('Ranking Postado', `Sistema de ranking postado em <#${canalId}>`)], ephemeral: true });
        return;
    }

    // Modal de filas (criar canais)
    if (customId.startsWith('modal_filas_')) {
        const modalidade = customId.replace('modal_filas_', '');
        const categoriaId = interaction.fields.getTextInputValue('categoria_id');
        
        const categoria = interaction.guild.channels.cache.get(categoriaId);
        if (!categoria || categoria.type !== ChannelType.GuildCategory) {
            return interaction.reply({ embeds: [embedErro('Erro', 'Categoria não encontrada.')], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const tipos = ['1v1', '2v2', '3v3', '4v4'];
            const valores = db.getValores(guildId);
            const config = db.getConfig(guildId);

            if (valores.length === 0) {
                return interaction.editReply({ embeds: [embedErro('Erro', 'Nenhum valor de aposta configurado. Use /config para adicionar valores.')] });
            }

            for (const tipo of tipos) {
                // Criar apenas um canal por tipo (sem adicionar o preço no nome)
                const canalNome = `${tipo}-${modalidade.toLowerCase()}`;
                const canal = await interaction.guild.channels.create({
                    name: canalNome,
                    type: ChannelType.GuildText,
                    parent: categoriaId
                });

                // Para cada valor, postar uma mensagem (embed) separada dentro do mesmo canal
                for (const valor of valores) {
                    const embed = embedPartida(config, modalidade, tipo, valor, []);
                    const buttons = getFilaButtons(guildId, modalidade, tipo, canal.id, valor);

                    const message = await canal.send({ embeds: [embed], components: buttons });

                    // Salvar fila por mensagem (cada embed representa uma fila com preço específico)
                    db.createFila(guildId, modalidade, categoriaId, canal.id, tipo, valor, message.id);
                }
            }

            await interaction.editReply({ embeds: [embedSucesso('Filas Criadas', `Canais de fila para ${modalidade} foram criados na categoria.`)] });
        } catch (error) {
            console.error('[ERRO] Criar filas:', error);
            await interaction.editReply({ embeds: [embedErro('Erro', 'Ocorreu um erro ao criar as filas.')] });
        }
        return;
    }

    // Modal de análise
    if (customId.startsWith('modal_analise_')) {
        const config = db.getConfig(guildId);
        
        const usuario = interaction.fields.getTextInputValue('analise_usuario');
        const motivo = interaction.fields.getTextInputValue('analise_motivo');
        const tipo = interaction.fields.getTextInputValue('analise_tipo');

        if (config.log_geral) {
            const logChannel = interaction.guild.channels.cache.get(config.log_geral);
            if (logChannel) {
                const embed = embedInfo('📋 Solicitação de Análise', 
                    `**Solicitante:** <@${interaction.user.id}>\n**Usuário Reportado:** ${usuario}\n**Tipo:** ${tipo}\n**Motivo:** ${motivo}`);
                logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }

        await interaction.reply({ embeds: [embedSucesso('Análise Enviada', 'Sua solicitação foi enviada para os analistas.')], ephemeral: true });
        return;
    }
}

// ========== FUNÇÕES AUXILIARES DE FILA ==========

function getFilaButtons(guildId, modalidade, tipo, canalId, preco = null) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const rows = [];

    // Sanitize price to keep customId safe (replace decimal point with 'p')
    const precoId = preco !== null ? String(preco).replace('.', 'p') : '0';

    // Try to use custom button config from DB (per fila)
    try {
        const fila = preco !== null ? db.getFilaByCanalAndPreco(guildId, canalId, preco) : db.getFilaByCanal(canalId);
        if (fila && fila.botoes) {
            let botoes = [];
            try {
                botoes = JSON.parse(fila.botoes || '[]');
            } catch (e) { botoes = []; }

            // Build buttons from config, chunk into rows of max 5 buttons
            const chunk = (arr, size) => {
                const res = [];
                for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
                return res;
            };

            const rowsCfg = chunk(botoes, 5);
            for (const rowCfg of rowsCfg) {
                const row = new ActionRowBuilder();
                for (const btn of rowCfg) {
                    const styleMap = {
                        PRIMARY: ButtonStyle.Primary,
                        SECONDARY: ButtonStyle.Secondary,
                        SUCCESS: ButtonStyle.Success,
                        DANGER: ButtonStyle.Danger
                    };
                    const style = styleMap[(btn.style || '').toUpperCase()] || ButtonStyle.Primary;
                    row.addComponents(new ButtonBuilder().setCustomId(btn.customId).setLabel(btn.label || 'Botão').setStyle(style));
                }
                rows.push(row);
            }

            if (rows.length > 0) return rows;
        }
    } catch (e) {
        // ignore DB read errors and fallback to defaults
    }

    // Fallback legacy buttons
    if (modalidade === 'Mobile') {
        if (tipo === '1v1') {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_gelo_infinito_${canalId}_${precoId}`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_gelo_normal_${canalId}_${precoId}`).setLabel('Gelo Normal').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        } else {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_entrar_${canalId}_${precoId}`).setLabel('Entrar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`fila_full_ump_${canalId}_${precoId}`).setLabel('Full UMP XM8').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        }
    } else if (modalidade === 'Emulador') {
        if (tipo === '1v1') {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_gelo_infinito_${canalId}_${precoId}`).setLabel('Gelo Infinito').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_gelo_normal_${canalId}_${precoId}`).setLabel('Gelo Normal').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        } else {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_entrar_${canalId}_${precoId}`).setLabel('Entrar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`fila_full_ump_${canalId}_${precoId}`).setLabel('Full UMP XM8').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        }
    } else if (modalidade === 'Tático') {
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fila_entrar_${canalId}_${precoId}`).setLabel('Entrar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
        ));
    } else if (modalidade === 'Misto') {
        if (tipo === '2v2') {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_1emu_${canalId}_${precoId}`).setLabel('1 Emu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        } else if (tipo === '3v3') {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_1emu_${canalId}_${precoId}`).setLabel('1 Emu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_2emu_${canalId}_${precoId}`).setLabel('2 Emu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        } else if (tipo === '4v4') {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_1emu_${canalId}_${precoId}`).setLabel('1 Emu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_2emu_${canalId}_${precoId}`).setLabel('2 Emu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_3emu_${canalId}_${precoId}`).setLabel('3 Emu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        } else {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`fila_entrar_${canalId}_${precoId}`).setLabel('Entrar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`fila_sair_${canalId}_${precoId}`).setLabel('Sair').setStyle(ButtonStyle.Danger)
            ));
        }
    }

    return rows;
}

async function handleFilaEntrar(interaction, client) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const parts = interaction.customId.split('_');
    const precoStr = parts.pop();
    const canalId = parts.pop();
    const preco = parseFloat(precoStr.replace('p', '.'));

    // Verificar blacklist
    if (isBlacklisted(userId, guildId)) {
        return interaction.reply({ embeds: [embedErro('Bloqueado', 'Você está na blacklist e não pode entrar em filas.')], ephemeral: true });
    }

    const fila = db.getFilaByCanalAndPreco(guildId, canalId, preco);
    if (!fila) {
        return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });
    }

    let jogadores = JSON.parse(fila.jogadores || '[]');
    const maxJogadores = getMaxJogadores(fila.tipo);

    // Verificar se já está na fila
    if (jogadores.includes(userId)) {
        return interaction.reply({ embeds: [embedErro('Erro', 'Você já está nesta fila!')], ephemeral: true });
    }

    // Verificar se a fila está cheia
    if (jogadores.length >= maxJogadores) {
        return interaction.reply({ embeds: [embedErro('Fila Cheia', 'Esta fila já está cheia!')], ephemeral: true });
    }

    // Adicionar jogador
    jogadores.push(userId);
    db.updateFila(fila.id, 'jogadores', JSON.stringify(jogadores));

    // Atualizar embed com preço correto da fila
    const config = db.getConfig(guildId);
    const precoFila = fila.preco || 10;
    const embed = embedPartida(config, fila.modalidade, fila.tipo, precoFila, jogadores);
    const buttons = getFilaButtons(guildId, fila.modalidade, fila.tipo, canalId, precoFila);

    try {
        await interaction.update({ embeds: [embed], components: buttons, allowedMentions: { users: jogadores } });
    } catch (e) {
        await interaction.reply({ embeds: [embedSucesso('Entrou', 'Você entrou na fila!')], ephemeral: true });
    }

    // Verificar se a fila encheu para iniciar partida
    if (jogadores.length >= maxJogadores) {
        await iniciarPartida(interaction, fila, jogadores, client);
    }
}

async function handleFilaSair(interaction, client) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const parts = interaction.customId.split('_');
    const precoStr = parts.pop();
    const canalId = parts.pop();
    const preco = parseFloat(precoStr.replace('p', '.'));

    const fila = db.getFilaByCanalAndPreco(guildId, canalId, preco);
    if (!fila) {
        return interaction.reply({ embeds: [embedErro('Erro', 'Fila não encontrada.')], ephemeral: true });
    }

    let jogadores = JSON.parse(fila.jogadores || '[]');

    // Verificar se está na fila
    if (!jogadores.includes(userId)) {
        return interaction.reply({ embeds: [embedErro('Erro', 'Você não está nesta fila!')], ephemeral: true });
    }

    // Remover jogador
    jogadores = jogadores.filter(j => j !== userId);
    db.updateFila(fila.id, 'jogadores', JSON.stringify(jogadores));

    // Atualizar embed com preço correto da fila
    const config = db.getConfig(guildId);
    const precoFila = fila.preco || 10;
    const embed = embedPartida(config, fila.modalidade, fila.tipo, precoFila, jogadores);
    const buttons = getFilaButtons(guildId, fila.modalidade, fila.tipo, canalId, precoFila);

    try {
        await interaction.update({ embeds: [embed], components: buttons, allowedMentions: { users: jogadores } });
    } catch (e) {
        await interaction.reply({ embeds: [embedSucesso('Saiu', 'Você saiu da fila!')], ephemeral: true });
    }
}

async function iniciarPartida(interaction, fila, jogadores, client) {
    const guildId = interaction.guild.id;
    const config = db.getConfig(guildId);

    try {
        // Criar canal privado da partida
        const partidaChannel = await interaction.guild.channels.create({
            name: `partida-${Date.now().toString(36)}`,
            type: ChannelType.GuildText,
            parent: fila.categoria_id,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                ...jogadores.map(j => ({ id: j, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })),
                ...(config.cargo_mediador ? [{ id: config.cargo_mediador, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
            ]
        });

        // Criar partida no banco com preço da fila
        const preco = fila.preco || 10;
        const result = db.createPartida(guildId, partidaChannel.id, fila.categoria_id, fila.modalidade, fila.tipo, preco, null);
        const partidaId = result.lastInsertRowid;

        // Embed de confirmação
        const embed = embedConfirmacao(jogadores, preco);

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`partida_confirmar_${partidaId}`).setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`partida_encerrar_${partidaId}`).setLabel('Encerrar').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        await partidaChannel.send({
            content: jogadores.map(j => `<@${j}>`).join(' '),
            embeds: [embed],
            components: [row]
        });

        // Limpar fila
        db.updateFila(fila.id, 'jogadores', '[]');

        // Log
        if (config.log_partidas) {
            const logChannel = interaction.guild.channels.cache.get(config.log_partidas);
            if (logChannel) {
                logChannel.send({ embeds: [embedInfo('🎮 Partida Iniciada', `**Modalidade:** ${fila.modalidade}\n**Tipo:** ${fila.tipo}\n**Jogadores:** ${jogadores.map(j => `<@${j}>`).join(', ')}`)] }).catch(() => {});
            }
        }
    } catch (error) {
        console.error('[ERRO] Iniciar partida:', error);
    }
}

async function handlePartidaConfirmar(interaction, client) {
    const partidaId = interaction.customId.split('_')[2];
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const partida = db.getPartida(partidaId);
    if (!partida) {
        return interaction.reply({ embeds: [embedErro('Erro', 'Partida não encontrada.')], ephemeral: true });
    }

    let confirmados = JSON.parse(partida.confirmados || '[]');
    const jogadores = JSON.parse(partida.jogadores || '[]');

    // Verificar se o usuário é um dos jogadores (verificação simplificada)
    if (confirmados.includes(userId)) {
        return interaction.reply({ embeds: [embedErro('Erro', 'Você já confirmou!')], ephemeral: true });
    }

    confirmados.push(userId);
    db.updatePartida(partidaId, 'confirmados', JSON.stringify(confirmados));

    const maxJogadores = getMaxJogadores(partida.tipo);

    // Verificar se todos confirmaram
    if (confirmados.length >= maxJogadores) {
        const config = db.getConfig(guildId);
        
        // Buscar mediador com PIX
        const mediadores = interaction.guild.members.cache.filter(m => 
            config.cargo_mediador && m.roles.cache.has(config.cargo_mediador) && hasPix(m.id, guildId)
        );

        if (mediadores.size > 0) {
            const mediador = mediadores.random();
            const chavePix = db.getPixKey(mediador.id, guildId);
            
            db.updatePartida(partidaId, 'mediador_id', mediador.id);
            db.updatePartida(partidaId, 'status', 'confirmada');

            // Gerar QR Code
            const qrBuffer = await gerarQRCodeBuffer(chavePix);
            const attachment = new AttachmentBuilder(qrBuffer, { name: 'pix-qrcode.png' });

            const embed = embedPix(chavePix, partida.preco, null);

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`partida_analise_${partidaId}`).setLabel('Solicitar Análise').setStyle(ButtonStyle.Secondary).setEmoji('📋')
            );

            await interaction.update({ embeds: [embed], components: [row], files: [attachment] });
        } else {
            await interaction.reply({ embeds: [embedErro('Sem Mediador', 'Nenhum mediador disponível no momento.')], ephemeral: true });
        }
    } else {
        await interaction.reply({ embeds: [embedSucesso('Confirmado', `Você confirmou! (${confirmados.length}/${maxJogadores})`)], ephemeral: true });
    }
}

async function handlePartidaEncerrar(interaction, client) {
    const partidaId = interaction.customId.split('_')[2];
    const guildId = interaction.guild.id;
    const config = db.getConfig(guildId);

    const partida = db.getPartida(partidaId);
    if (!partida) {
        return interaction.reply({ embeds: [embedErro('Erro', 'Partida não encontrada.')], ephemeral: true });
    }

    // Log
    if (config.log_partidas) {
        const logChannel = interaction.guild.channels.cache.get(config.log_partidas);
        if (logChannel) {
            logChannel.send({ embeds: [embedInfo('❌ Partida Encerrada', `A partida foi encerrada por <@${interaction.user.id}>`)] }).catch(() => {});
        }
    }

    db.deletePartida(partidaId);

    await interaction.reply({ embeds: [embedInfo('Encerrando', 'Canal será deletado em 5 segundos...')] });
    
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (e) {
            console.error('[ERRO] Deletar canal:', e);
        }
    }, 5000);
}
