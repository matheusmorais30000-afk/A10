const Database = require('better-sqlite3');
const path = require('path');

// Criar banco de dados
const db = new Database(path.join(__dirname, '../../data.db'));

// Ativar modo WAL para melhor performance com múltiplas operações
db.pragma('journal_mode = WAL');

// Criar tabelas
db.exec(`
    -- Configurações do servidor
    CREATE TABLE IF NOT EXISTS config (
        guild_id TEXT PRIMARY KEY,
        valores TEXT DEFAULT '[]',
        cargo_analista TEXT,
        cargo_mediador TEXT,
        cargo_suporte TEXT,
        cargo_blacklist TEXT,
        log_geral TEXT,
        log_partidas TEXT,
        log_mediador TEXT,
        canal_mediador TEXT,
        canal_ranking TEXT,
        canal_ticket TEXT,
        categoria_ticket TEXT,
        embed_mediador TEXT DEFAULT '{}',
        embed_partida TEXT DEFAULT '{}',
        embed_ticket TEXT DEFAULT '{}',
        embed_ranking TEXT DEFAULT '{}'
    );

    -- Usuários (perfil, vitórias, derrotas, coins)
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        vitorias INTEGER DEFAULT 0,
        derrotas INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        chave_pix TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, guild_id)
    );

    -- Blacklist
    CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        motivo TEXT,
        adicionado_por TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, guild_id)
    );

    -- Partidas ativas
    CREATE TABLE IF NOT EXISTS partidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        canal_id TEXT,
        categoria_id TEXT,
        modalidade TEXT,
        tipo TEXT,
        preco REAL,
        jogadores TEXT DEFAULT '[]',
        time1 TEXT DEFAULT '[]',
        time2 TEXT DEFAULT '[]',
        mediador_id TEXT,
        status TEXT DEFAULT 'aguardando',
        confirmados TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Filas configuradas
    CREATE TABLE IF NOT EXISTS filas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        modalidade TEXT NOT NULL,
        categoria_id TEXT NOT NULL,
        canal_id TEXT,
        tipo TEXT,
        preco REAL DEFAULT 0,
        message_id TEXT,
        jogadores TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tickets
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        canal_id TEXT,
        tipo TEXT,
        status TEXT DEFAULT 'aberto',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Índices para melhor performance
    CREATE INDEX IF NOT EXISTS idx_usuarios_guild ON usuarios(guild_id);
    CREATE INDEX IF NOT EXISTS idx_blacklist_guild ON blacklist(guild_id);
    CREATE INDEX IF NOT EXISTS idx_partidas_guild ON partidas(guild_id);
    CREATE INDEX IF NOT EXISTS idx_filas_guild ON filas(guild_id);
`);

// Garantir colunas adicionais para painel do mediador
try {
    db.prepare(`ALTER TABLE config ADD COLUMN mensagem_mediador TEXT`).run();
} catch (e) {
    // coluna já existe ou não é possível adicionar -> ignorar
}

try {
    db.prepare(`ALTER TABLE config ADD COLUMN mediadores_ativos TEXT DEFAULT '[]'`).run();
} catch (e) {
    // coluna já existe -> ignorar
}
// Garantir coluna de botões nas filas (para custom button configs por fila)
try {
    db.prepare(`ALTER TABLE filas ADD COLUMN botoes TEXT DEFAULT '[]'`).run();
} catch (e) {
    // coluna já existe ou não possível -> ignorar
}
// Funções de utilidade para o banco de dados
const database = {
    // Configurações
    getConfig: (guildId) => {
        const stmt = db.prepare('SELECT * FROM config WHERE guild_id = ?');
        let config = stmt.get(guildId);
        if (!config) {
            db.prepare('INSERT OR IGNORE INTO config (guild_id) VALUES (?)').run(guildId);
            config = stmt.get(guildId);
        }
        return config;
    },

    updateConfig: (guildId, field, value) => {
        const stmt = db.prepare(`UPDATE config SET ${field} = ? WHERE guild_id = ?`);
        return stmt.run(value, guildId);
    },

    // Valores (preços das apostas)
    getValores: (guildId) => {
        const config = database.getConfig(guildId);
        return JSON.parse(config.valores || '[]');
    },

    addValor: (guildId, valor) => {
        const valores = database.getValores(guildId);
        if (!valores.includes(valor)) {
            valores.push(valor);
            valores.sort((a, b) => a - b);
            database.updateConfig(guildId, 'valores', JSON.stringify(valores));
        }
        return valores;
    },

    removeValor: (guildId, valor) => {
        let valores = database.getValores(guildId);
        valores = valores.filter(v => v !== valor);
        database.updateConfig(guildId, 'valores', JSON.stringify(valores));
        return valores;
    },

    clearValores: (guildId) => {
        database.updateConfig(guildId, 'valores', '[]');
        return [];
    },

    // Usuários
    getUsuario: (userId, guildId) => {
        const stmt = db.prepare('SELECT * FROM usuarios WHERE user_id = ? AND guild_id = ?');
        let usuario = stmt.get(userId, guildId);
        if (!usuario) {
            db.prepare('INSERT INTO usuarios (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
            usuario = stmt.get(userId, guildId);
        }
        return usuario;
    },

    updateUsuario: (userId, guildId, field, value) => {
        database.getUsuario(userId, guildId);
        const stmt = db.prepare(`UPDATE usuarios SET ${field} = ? WHERE user_id = ? AND guild_id = ?`);
        return stmt.run(value, userId, guildId);
    },

    addVitoria: (userId, guildId) => {
        const usuario = database.getUsuario(userId, guildId);
        db.prepare('UPDATE usuarios SET vitorias = vitorias + 1, coins = coins + 1 WHERE user_id = ? AND guild_id = ?')
            .run(userId, guildId);
    },

    addDerrota: (userId, guildId) => {
        database.getUsuario(userId, guildId);
        db.prepare('UPDATE usuarios SET derrotas = derrotas + 1 WHERE user_id = ? AND guild_id = ?')
            .run(userId, guildId);
    },

    setPixKey: (userId, guildId, chavePix) => {
        database.getUsuario(userId, guildId);
        db.prepare('UPDATE usuarios SET chave_pix = ? WHERE user_id = ? AND guild_id = ?')
            .run(chavePix, userId, guildId);
    },

    getPixKey: (userId, guildId) => {
        const usuario = database.getUsuario(userId, guildId);
        return usuario?.chave_pix;
    },

    getTop10: (guildId) => {
        const stmt = db.prepare(`
            SELECT user_id, vitorias, derrotas, coins 
            FROM usuarios 
            WHERE guild_id = ? 
            ORDER BY vitorias DESC, coins DESC 
            LIMIT 10
        `);
        return stmt.all(guildId);
    },

    // Blacklist
    isBlacklisted: (userId, guildId) => {
        const stmt = db.prepare('SELECT * FROM blacklist WHERE user_id = ? AND guild_id = ?');
        return stmt.get(userId, guildId) !== undefined;
    },

    addBlacklist: (userId, guildId, motivo, adicionadoPor) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO blacklist (user_id, guild_id, motivo, adicionado_por) VALUES (?, ?, ?, ?)');
        return stmt.run(userId, guildId, motivo, adicionadoPor);
    },

    removeBlacklist: (userId, guildId) => {
        const stmt = db.prepare('DELETE FROM blacklist WHERE user_id = ? AND guild_id = ?');
        return stmt.run(userId, guildId);
    },

    getBlacklist: (guildId) => {
        const stmt = db.prepare('SELECT * FROM blacklist WHERE guild_id = ?');
        return stmt.all(guildId);
    },

    // Partidas
    createPartida: (guildId, canalId, categoriaId, modalidade, tipo, preco, mediadorId) => {
        const stmt = db.prepare(`
            INSERT INTO partidas (guild_id, canal_id, categoria_id, modalidade, tipo, preco, mediador_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(guildId, canalId, categoriaId, modalidade, tipo, preco, mediadorId);
    },

    getPartida: (id) => {
        const stmt = db.prepare('SELECT * FROM partidas WHERE id = ?');
        return stmt.get(id);
    },

    getPartidaByCanal: (canalId) => {
        const stmt = db.prepare('SELECT * FROM partidas WHERE canal_id = ?');
        return stmt.get(canalId);
    },

    updatePartida: (id, field, value) => {
        const stmt = db.prepare(`UPDATE partidas SET ${field} = ? WHERE id = ?`);
        return stmt.run(value, id);
    },

    deletePartida: (id) => {
        const stmt = db.prepare('DELETE FROM partidas WHERE id = ?');
        return stmt.run(id);
    },

    getPartidasAtivas: (guildId) => {
        const stmt = db.prepare('SELECT * FROM partidas WHERE guild_id = ? AND status != ?');
        return stmt.all(guildId, 'finalizada');
    },

    // Filas
    createFila: (guildId, modalidade, categoriaId, canalId, tipo, preco, messageId) => {
        const stmt = db.prepare(`
            INSERT INTO filas (guild_id, modalidade, categoria_id, canal_id, tipo, preco, message_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(guildId, modalidade, categoriaId, canalId, tipo, preco, messageId);
    },

    getFila: (id) => {
        const stmt = db.prepare('SELECT * FROM filas WHERE id = ?');
        return stmt.get(id);
    },

    getFilaByMessage: (messageId) => {
        const stmt = db.prepare('SELECT * FROM filas WHERE message_id = ?');
        return stmt.get(messageId);
    },

    getFilaByCanalAndPreco: (guildId, canalId, preco) => {
        const stmt = db.prepare('SELECT * FROM filas WHERE guild_id = ? AND canal_id = ? AND preco = ?');
        return stmt.get(guildId, canalId, preco);
    },

    getFilaByCanal: (canalId) => {
        const stmt = db.prepare('SELECT * FROM filas WHERE canal_id = ?');
        return stmt.get(canalId);
    },

    updateFila: (id, field, value) => {
        const stmt = db.prepare(`UPDATE filas SET ${field} = ? WHERE id = ?`);
        return stmt.run(value, id);
    },

    getFilasByGuild: (guildId) => {
        const stmt = db.prepare('SELECT * FROM filas WHERE guild_id = ?');
        return stmt.all(guildId);
    },

    deleteFila: (id) => {
        const stmt = db.prepare('DELETE FROM filas WHERE id = ?');
        return stmt.run(id);
    },

    // Tickets
    createTicket: (guildId, userId, canalId, tipo) => {
        const stmt = db.prepare(`
            INSERT INTO tickets (guild_id, user_id, canal_id, tipo)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(guildId, userId, canalId, tipo);
    },

    getTicketByCanal: (canalId) => {
        const stmt = db.prepare('SELECT * FROM tickets WHERE canal_id = ?');
        return stmt.get(canalId);
    },

    closeTicket: (canalId) => {
        const stmt = db.prepare('UPDATE tickets SET status = ? WHERE canal_id = ?');
        return stmt.run('fechado', canalId);
    },

    // Mediadores ativos (lista de userIds em JSON)
    getMediadoresAtivos: (guildId) => {
        const config = database.getConfig(guildId);
        try {
            return JSON.parse(config.mediadores_ativos || '[]');
        } catch (e) {
            return [];
        }
    },

    setMediadoresAtivos: (guildId, arr) => {
        return database.updateConfig(guildId, 'mediadores_ativos', JSON.stringify(arr));
    },
};

module.exports = database;
