const { EmbedBuilder } = require('discord.js');

// Cores padrão
const CORES = {
    SUCESSO: 0x00FF00,
    ERRO: 0xFF0000,
    INFO: 0x00BFFF,
    AVISO: 0xFFFF00,
    PADRAO: 0x5865F2,
    OURO: 0xFFD700,
    PARTIDA: 0x00FF7F
};

// Embed de sucesso
function embedSucesso(titulo, descricao) {
    return new EmbedBuilder()
        .setColor(CORES.SUCESSO)
        .setTitle(`✅ ${titulo}`)
        .setDescription(descricao)
        .setTimestamp();
}

// Embed de erro
function embedErro(titulo, descricao) {
    return new EmbedBuilder()
        .setColor(CORES.ERRO)
        .setTitle(`❌ ${titulo}`)
        .setDescription(descricao)
        .setTimestamp();
}

// Embed de info
function embedInfo(titulo, descricao) {
    return new EmbedBuilder()
        .setColor(CORES.INFO)
        .setTitle(`ℹ️ ${titulo}`)
        .setDescription(descricao)
        .setTimestamp();
}

// Embed de aviso
function embedAviso(titulo, descricao) {
    return new EmbedBuilder()
        .setColor(CORES.AVISO)
        .setTitle(`⚠️ ${titulo}`)
        .setDescription(descricao)
        .setTimestamp();
}

// Embed de perfil do jogador
function embedPerfil(user, dados) {
    const winRate = dados.vitorias + dados.derrotas > 0 
        ? ((dados.vitorias / (dados.vitorias + dados.derrotas)) * 100).toFixed(1) 
        : 0;

    return new EmbedBuilder()
        .setColor(CORES.OURO)
        .setTitle(`🎮 Perfil de ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '🏆 Vitórias', value: `${dados.vitorias}`, inline: true },
            { name: '💀 Derrotas', value: `${dados.derrotas}`, inline: true },
            { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
            { name: '💰 Coins', value: `${dados.coins}`, inline: true }
        )
        .setFooter({ text: 'Sistema de Ranking FF' })
        .setTimestamp();
}

// Embed de ranking
function embedRanking(topPlayers, guild, config = null) {
    const medalhas = ['🥇', '🥈', '🥉'];
    let descricao = '';

    topPlayers.forEach((player, index) => {
        const medalha = medalhas[index] || `**${index + 1}.**`;
        descricao += `${medalha} <@${player.user_id}> - **${player.vitorias}** vitórias | **${player.coins}** coins\n`;
    });

    if (descricao === '') {
        descricao = 'Nenhum jogador no ranking ainda!';
    }

    // Determinar cor opcional a partir da config de ranking
    let color = CORES.OURO;
    if (config) {
        const embedConfig = JSON.parse(config.embed_ranking || '{}');
        if (typeof embedConfig.cor === 'number' && !isNaN(embedConfig.cor)) color = embedConfig.cor;
    }

    return new EmbedBuilder()
        .setColor(color)
        .setTitle('🏆 Top 10 - Ranking de Partidas')
        .setDescription(descricao)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Sistema de Ranking FF' })
        .setTimestamp();
}

// Embed de partida/fila
function embedPartida(config, modalidade, tipo, preco, jogadores = []) {
    const embedConfig = JSON.parse(config.embed_partida || '{}');
    const maxJogadores = getMaxJogadores(tipo);

    // Mostrar apenas jogadores presentes (sem slots fixos)
    let listaJogadores = '';
    if (Array.isArray(jogadores) && jogadores.length > 0) {
        listaJogadores = jogadores.map((j, idx) => `${idx + 1}. <@${j}>`).join('\n');
    }

    const titulo = (embedConfig.titulo || '🎮 Fila de Partida')
        .replace('{{MODALIDADE}}', modalidade)
        .replace('{{TIPO}}', tipo)
        .replace('{{PREÇO}}', `R$ ${preco}`);

    const descricao = (embedConfig.descricao || `**Modalidade:** ${modalidade}\n**Tipo:** ${tipo}\n**Valor:** R$ ${preco}`)
        .replace('{{MODALIDADE}}', modalidade)
        .replace('{{TIPO}}', tipo)
        .replace('{{PREÇO}}', `R$ ${preco}`);

    // Determinar cor (usar valor numérico se válido, senão fallback)
    const color = (typeof embedConfig.cor === 'number' && !isNaN(embedConfig.cor)) ? embedConfig.cor : CORES.PARTIDA;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(titulo)
        .setDescription(descricao)
        .addFields({ name: '👥 Jogadores', value: listaJogadores || 'Nenhum jogador' })
        .setFooter({ text: embedConfig.footer || `${jogadores.length}/${maxJogadores} jogadores` })
        .setTimestamp();

    if (embedConfig.imagem) {
        embed.setImage(embedConfig.imagem);
    }

    if (embedConfig.thumbnail) {
        embed.setThumbnail(embedConfig.thumbnail);
    }

    return embed;
}

// Embed de painel do mediador
function embedMediador(config, mediadores = []) {
    const embedConfig = JSON.parse(config.embed_mediador || '{}');

    const color = (typeof embedConfig.cor === 'number' && !isNaN(embedConfig.cor)) ? embedConfig.cor : CORES.PADRAO;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(embedConfig.titulo || '⚔️ Painel do Mediador')
        .setDescription(embedConfig.descricao || 'Clique no botão abaixo para entrar no painel de mediação e começar a trabalhar!')
        .setFooter({ text: embedConfig.footer || 'Sistema de Mediação FF' })
        .setImage(embedConfig.imagem || null)
        .setTimestamp();

    if (Array.isArray(mediadores) && mediadores.length > 0) {
        const mentionList = mediadores.map(id => `<@${id}>`).join('\n');
        embed.addFields({ name: '👥 Mediadores Online', value: mentionList });
    }

    return embed;
}

// Embed de ID e Senha
function embedIdSenha(sala, senha) {
    return new EmbedBuilder()
        .setColor(CORES.INFO)
        .setTitle('🔐 ID da Sala')
        .setDescription('Copie as informações abaixo para entrar na partida!')
        .addFields(
            { name: '🏠 ID da Sala', value: `\`\`\`${sala}\`\`\``, inline: true },
            { name: '🔑 Senha', value: `\`\`\`${senha}\`\`\``, inline: true }
        )
        .setFooter({ text: 'Boa sorte na partida!' })
        .setTimestamp();
}

// Embed de confirmação de partida
function embedConfirmacao(jogadores, preco) {
    const time1 = jogadores.slice(0, jogadores.length / 2);
    const time2 = jogadores.slice(jogadores.length / 2);

    return new EmbedBuilder()
        .setColor(CORES.AVISO)
        .setTitle('⚔️ Partida Encontrada!')
        .setDescription(`**Valor da Aposta:** R$ ${preco}\n\nClique em **Confirmar** para aceitar a partida.`)
        .addFields(
            { name: '🔵 Time 1', value: time1.map(j => `<@${j}>`).join('\n') || 'Vazio', inline: true },
            { name: '🔴 Time 2', value: time2.map(j => `<@${j}>`).join('\n') || 'Vazio', inline: true }
        )
        .setFooter({ text: 'Ambos os times devem confirmar!' })
        .setTimestamp();
}

// Embed de pagamento PIX
function embedPix(chavePix, valor, qrCodePath) {
    const embed = new EmbedBuilder()
        .setColor(CORES.SUCESSO)
        .setTitle('💸 Pagamento PIX')
        .setDescription(`Escaneie o QR Code ou copie a chave PIX abaixo para realizar o pagamento.`)
        .addFields(
            { name: '💰 Valor', value: `R$ ${valor}`, inline: true },
            { name: '🔑 Chave PIX', value: `\`\`\`${chavePix}\`\`\``, inline: false }
        )
        .setFooter({ text: 'Após o pagamento, aguarde a confirmação do mediador.' })
        .setTimestamp();

    return embed;
}

// Embed de ticket
function embedTicket(config) {
    const embedConfig = JSON.parse(config.embed_ticket || '{}');

    const color = (typeof embedConfig.cor === 'number' && !isNaN(embedConfig.cor)) ? embedConfig.cor : CORES.PADRAO;

    return new EmbedBuilder()
        .setColor(color)
        .setTitle(embedConfig.titulo || '🎫 Central de Atendimento')
        .setDescription(embedConfig.descricao || 'Selecione uma opção abaixo para abrir um ticket.')
        .setFooter({ text: embedConfig.footer || 'Sistema de Tickets' })
        .setImage(embedConfig.imagem || null)
        .setTimestamp();
}

// Embed de blacklist
function embedBlacklist(user, motivo, acao, executor) {
    const cor = acao === 'adicionado' ? CORES.ERRO : CORES.SUCESSO;
    const titulo = acao === 'adicionado' ? '🚫 Adicionado à Blacklist' : '✅ Removido da Blacklist';

    return new EmbedBuilder()
        .setColor(cor)
        .setTitle(titulo)
        .addFields(
            { name: '👤 Usuário', value: `<@${user.id}>`, inline: true },
            { name: '🛡️ Por', value: `<@${executor.id}>`, inline: true },
            { name: '📝 Motivo', value: motivo || 'Não especificado', inline: false }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
}

// Função auxiliar para pegar máximo de jogadores
function getMaxJogadores(tipo) {
    switch (tipo) {
        case '1v1': return 2;
        case '2v2': return 4;
        case '3v3': return 6;
        case '4v4': return 8;
        default: return 2;
    }
}

module.exports = {
    CORES,
    embedSucesso,
    embedErro,
    embedInfo,
    embedAviso,
    embedPerfil,
    embedRanking,
    embedPartida,
    embedMediador,
    embedIdSenha,
    embedConfirmacao,
    embedPix,
    embedTicket,
    embedBlacklist,
    getMaxJogadores
};
