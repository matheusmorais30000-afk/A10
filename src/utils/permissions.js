const db = require('../database/db');

// Verificar se usuário tem cargo de Analista
function isAnalista(member, guildId) {
    const config = db.getConfig(guildId);
    if (!config.cargo_analista) return false;
    return member.roles.cache.has(config.cargo_analista);
}

// Verificar se usuário tem cargo de Mediador
function isMediador(member, guildId) {
    const config = db.getConfig(guildId);
    if (!config.cargo_mediador) return false;
    return member.roles.cache.has(config.cargo_mediador);
}

// Verificar se usuário tem cargo de Suporte
function isSuporte(member, guildId) {
    const config = db.getConfig(guildId);
    if (!config.cargo_suporte) return false;
    return member.roles.cache.has(config.cargo_suporte);
}

// Verificar se usuário é Staff (Analista, Mediador ou Suporte)
function isStaff(member, guildId) {
    return isAnalista(member, guildId) || isMediador(member, guildId) || isSuporte(member, guildId);
}

// Verificar se usuário é Admin ou Dono
function isAdmin(member) {
    return member.permissions.has('Administrator') || member.id === member.guild.ownerId;
}

// Verificar se usuário está na blacklist
function isBlacklisted(userId, guildId) {
    return db.isBlacklisted(userId, guildId);
}

// Verificar se mediador tem PIX registrado
function hasPix(userId, guildId) {
    const pixKey = db.getPixKey(userId, guildId);
    return pixKey && pixKey.length > 0;
}

// Verificar hierarquia de permissões
function hasPermission(member, guildId, minLevel) {
    const levels = {
        'usuario': 0,
        'suporte': 1,
        'mediador': 2,
        'analista': 3,
        'admin': 4
    };

    let userLevel = 0;
    if (isAdmin(member)) userLevel = 4;
    else if (isAnalista(member, guildId)) userLevel = 3;
    else if (isMediador(member, guildId)) userLevel = 2;
    else if (isSuporte(member, guildId)) userLevel = 1;

    return userLevel >= levels[minLevel];
}

module.exports = {
    isAnalista,
    isMediador,
    isSuporte,
    isStaff,
    isAdmin,
    isBlacklisted,
    hasPix,
    hasPermission
};
