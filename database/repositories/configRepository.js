const db = require('../connection');

// Prepared statements para configurações
const insertConfiguracao = db.prepare(`
    INSERT OR REPLACE INTO configuracoes (chave, valor, atualizado_em)
    VALUES (?, ?, CURRENT_TIMESTAMP)
`);

const getConfiguracao = db.prepare(`
    SELECT valor FROM configuracoes WHERE chave = ?
`);

// Prepared statements para configurações de grupo
const insertConfiguracaoGrupo = db.prepare(`
    INSERT OR REPLACE INTO configuracoes_grupo (id_grupo, chave, valor, atualizado_em)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);

const getConfiguracaoGrupo = db.prepare(`
    SELECT valor FROM configuracoes_grupo WHERE id_grupo = ? AND chave = ?
`);

// Prepared statements para configurações de usuário
const insertConfiguracaoUsuario = db.prepare(`
    INSERT OR REPLACE INTO configuracoes_usuario (id_usuario, chave, valor, atualizado_em)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);

const getConfiguracaoUsuario = db.prepare(`
    SELECT valor FROM configuracoes_usuario WHERE id_usuario = ? AND chave = ?
`);

module.exports = {
    // Configurações
    salvarConfiguracao: (chave, valor) => {
        return insertConfiguracao.run(chave, valor);
    },

    obterConfiguracao: (chave) => {
        const row = getConfiguracao.get(chave);
        return row ? row.valor : null;
    },

    // Configurações de Grupo
    salvarConfiguracaoGrupo: (idGrupo, chave, valor) => {
        return insertConfiguracaoGrupo.run(idGrupo, chave, valor);
    },

    obterConfiguracaoGrupo: (idGrupo, chave) => {
        const row = getConfiguracaoGrupo.get(idGrupo, chave);
        return row ? row.valor : null;
    },

    // Configurações de Usuário
    definirConfiguracaoUsuario: (idUsuario, chave, valor) => {
        return insertConfiguracaoUsuario.run(idUsuario, chave, valor);
    },

    obterConfiguracaoUsuario: (idUsuario, chave) => {
        const row = getConfiguracaoUsuario.get(idUsuario, chave);
        return row ? row.valor : null;
    },

    getStats: () => {
        const totalUsers = db.prepare('SELECT COUNT(*) FROM usuarios').get()['COUNT(*)'];
        const bannedUsers = db.prepare('SELECT COUNT(*) FROM usuarios WHERE banned = TRUE').get()['COUNT(*)'];
        const commandsExecuted = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get('comandos_executados');
        const messagesProcessed = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get('total_mensagens');
        const activeUsers = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get('usuarios_ativos');
        const totalGroups = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get('total_grupos');
        return {
            totalUsers,
            bannedUsers,
            commandsExecuted: commandsExecuted ? commandsExecuted.valor : '0',
            messagesProcessed: messagesProcessed ? messagesProcessed.valor : '0',
            activeUsers: activeUsers ? activeUsers.valor : '0',
            totalGroups: totalGroups ? totalGroups.valor : '0'
        };
    },

    incrementarContador: (chave) => {
        const currentValue = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
        const newValue = currentValue ? (parseInt(currentValue.valor) + 1).toString() : '1';
        return insertConfiguracao.run(chave, newValue);
    }
};
