const db = require('../connection');

// Prepared statements para usuários
const insertUsuario = db.prepare(`
    INSERT OR REPLACE INTO usuarios (id_whatsapp, nome, historico_interacoes, atualizado_em)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);

const getUsuario = db.prepare(`
    SELECT * FROM usuarios WHERE id_whatsapp = ?
`);

const updateHistoricoUsuario = db.prepare(`
    UPDATE usuarios SET historico_interacoes = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id_whatsapp = ?
`);

const updateNomeUsuario = db.prepare(`
    UPDATE usuarios SET nome = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id_whatsapp = ?
`);

const banUserStmt = db.prepare(`
    UPDATE usuarios SET banned = TRUE, atualizado_em = CURRENT_TIMESTAMP WHERE id_whatsapp = ?
`);

const unbanUserStmt = db.prepare(`
    UPDATE usuarios SET banned = FALSE, atualizado_em = CURRENT_TIMESTAMP WHERE id_whatsapp = ?
`);

const updateUserRole = db.prepare(`
    UPDATE usuarios SET role = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id_whatsapp = ?
`);

const getAdminsStmt = db.prepare(`
    SELECT * FROM usuarios WHERE role = 'admin' OR role = 'owner'
`);

module.exports = {
    salvarUsuario: (idWhatsapp, nome, historico = []) => {
        const historicoStr = JSON.stringify(historico);
        return insertUsuario.run(idWhatsapp, nome, historicoStr);
    },

    obterUsuario: (idWhatsapp) => {
        const row = getUsuario.get(idWhatsapp);
        if (row) {
            row.historico_interacoes = JSON.parse(row.historico_interacoes || '[]');
        }
        return row;
    },

    atualizarHistoricoUsuario: (idWhatsapp, historico) => {
        const historicoStr = JSON.stringify(historico);
        return updateHistoricoUsuario.run(historicoStr, idWhatsapp);
    },

    atualizarNomeUsuario: (idWhatsapp, nome) => {
        // Verifica se o usuário existe
        const usuario = getUsuario.get(idWhatsapp);
        if (usuario) {
            // Atualiza o nome
            return updateNomeUsuario.run(nome, idWhatsapp);
        } else {
            // Cria o usuário com o nome
            return insertUsuario.run(idWhatsapp, nome, '[]');
        }
    },

    banUser: (idWhatsapp) => {
        return banUserStmt.run(idWhatsapp);
    },

    unbanUser: (idWhatsapp) => {
        return unbanUserStmt.run(idWhatsapp);
    },

    setUserRole: (idWhatsapp, role) => {
        return updateUserRole.run(role, idWhatsapp);
    },

    getAdmins: () => {
        return getAdminsStmt.all();
    }
};
