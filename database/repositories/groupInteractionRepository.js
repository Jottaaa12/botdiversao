const db = require('../connection');

// Prepared statements para advertências
const insertAdvertencia = db.prepare('INSERT INTO advertencias (id_grupo, id_usuario, motivo, id_autor) VALUES (?, ?, ?, ?)');
const getAdvertenciasUsuario = db.prepare('SELECT * FROM advertencias WHERE id_grupo = ? AND id_usuario = ? ORDER BY timestamp DESC');
const getAdvertenciasGrupo = db.prepare('SELECT * FROM advertencias WHERE id_grupo = ? ORDER BY id_usuario, timestamp DESC');
const deleteUltimaAdvertencia = db.prepare('DELETE FROM advertencias WHERE id IN (SELECT id FROM advertencias WHERE id_grupo = ? AND id_usuario = ? ORDER BY timestamp DESC LIMIT 1)');
const deleteAllAdvertenciasUsuario = db.prepare('DELETE FROM advertencias WHERE id_grupo = ? AND id_usuario = ?');

// Prepared statements para mutados
const insertMute = db.prepare(`
    INSERT OR REPLACE INTO mutados (id_usuario, id_grupo, tempo_expiracao, mutado_em)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);

const getMute = db.prepare(`
    SELECT * FROM mutados WHERE id_usuario = ? AND id_grupo = ?
`);

const deleteMute = db.prepare(`
    DELETE FROM mutados WHERE id_usuario = ? AND id_grupo = ?
`);

const getAllMutes = db.prepare(`
    SELECT * FROM mutados
`);

const getMutesByGroup = db.prepare(`
    SELECT * FROM mutados WHERE id_grupo = ?
`);

// Prepared statements para auto-respostas
const insertAutoResposta = db.prepare(`
    INSERT OR REPLACE INTO auto_respostas(gatilho, resposta, id_grupo, criado_por, match_type)
    VALUES(?, ?, ?, ?, ?)
`);

const getAutoResposta = db.prepare(`
SELECT * FROM auto_respostas WHERE gatilho = ? AND id_grupo = ?
    `);

const listAutoRespostas = db.prepare(`
    SELECT * FROM auto_respostas WHERE id_grupo = ?
    `);

const deleteAutoResposta = db.prepare(`
    DELETE FROM auto_respostas WHERE gatilho = ? AND id_grupo = ?
    `);

// Prepared statements para membros de grupo
const upsertMembroGrupo = db.prepare(`
    INSERT INTO membros_grupo (id_grupo, id_usuario, msg_count, last_seen)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(id_grupo, id_usuario) DO UPDATE SET
        msg_count = msg_count + 1,
        last_seen = CURRENT_TIMESTAMP
`);

const getRankingGrupo = db.prepare(`
    SELECT id_usuario, msg_count, last_seen
    FROM membros_grupo
    WHERE id_grupo = ?
    ORDER BY msg_count DESC
    LIMIT ?
`);

const getInativosGrupo = db.prepare(`
    SELECT id_usuario, msg_count, last_seen
    FROM membros_grupo
    WHERE id_grupo = ?
    AND julianday('now') - julianday(last_seen) > ?
    ORDER BY last_seen ASC
`);

// Prepared statements para casamentos
const insertCasamento = db.prepare(`
    INSERT INTO casamentos (id_usuario1, id_usuario2, data_casamento, nivel_amor)
    VALUES (?, ?, CURRENT_TIMESTAMP, 100)
`);

const deleteCasamento = db.prepare(`
    DELETE FROM casamentos
    WHERE (id_usuario1 = ? AND id_usuario2 = ?)
    OR (id_usuario1 = ? AND id_usuario2 = ?)
`);

const getConjuge = db.prepare(`
    SELECT
        CASE
            WHEN id_usuario1 = ? THEN id_usuario2
            ELSE id_usuario1
        END as conjuge,
        data_casamento,
        nivel_amor
    FROM casamentos
    WHERE id_usuario1 = ? OR id_usuario2 = ?
`);

const verificarCasamento = db.prepare(`
    SELECT * FROM casamentos
    WHERE (id_usuario1 = ? AND id_usuario2 = ?)
    OR (id_usuario1 = ? AND id_usuario2 = ?)
`);

module.exports = {
    // Funções de Advertência
    salvarAdvertencia: (idGrupo, idUsuario, motivo, idAutor) => {
        return insertAdvertencia.run(idGrupo, idUsuario, motivo, idAutor);
    },

    obterAdvertenciasUsuario: (idGrupo, idUsuario) => {
        return getAdvertenciasUsuario.all(idGrupo, idUsuario);
    },

    obterAdvertenciasGrupo: (idGrupo) => {
        return getAdvertenciasGrupo.all(idGrupo);
    },

    removerUltimaAdvertencia: (idGrupo, idUsuario) => {
        return deleteUltimaAdvertencia.run(idGrupo, idUsuario);
    },

    limparAdvertenciasUsuario: (idGrupo, idUsuario) => {
        return deleteAllAdvertenciasUsuario.run(idGrupo, idUsuario);
    },

    // Funções de Mute
    muteUser: (idUsuario, idGrupo, tempoExpiracao = null) => {
        return insertMute.run(idUsuario, idGrupo, tempoExpiracao);
    },

    unmuteUser: (idUsuario, idGrupo) => {
        return deleteMute.run(idUsuario, idGrupo);
    },

    isMuted: (idUsuario, idGrupo) => {
        const muteRecord = getMute.get(idUsuario, idGrupo);
        if (muteRecord) {
            if (muteRecord.tempo_expiracao && new Date(muteRecord.tempo_expiracao) < new Date()) {
                // Mute expirou, remover do banco de dados
                deleteMute.run(idUsuario, idGrupo);
                return false;
            }
            return true;
        }
        return false;
    },

    obterMutadosGrupo: (idGrupo) => {
        return getMutesByGroup.all(idGrupo);
    },

    // Funções de Auto-Resposta
    adicionarAutoResposta: (gatilho, resposta, idGrupo, criadoPor, matchType = 'exact') => {
        return insertAutoResposta.run(gatilho, resposta, idGrupo, criadoPor, matchType);
    },

    listarAutoRespostas: (idGrupo) => {
        return listAutoRespostas.all(idGrupo);
    },

    removerAutoResposta: (gatilho, idGrupo) => {
        return deleteAutoResposta.run(gatilho, idGrupo);
    },

    // Funções de Membros de Grupo (Ranking e Atividade)
    registrarAtividadeGrupo: (idGrupo, idUsuario) => {
        return upsertMembroGrupo.run(idGrupo, idUsuario);
    },

    obterRankingGrupo: (idGrupo, limit = 10) => {
        return getRankingGrupo.all(idGrupo, limit);
    },

    obterInativosGrupo: (idGrupo, dias = 7) => {
        return getInativosGrupo.all(idGrupo, dias);
    },

    // Funções de Casamento
    casarUsuarios: (usuario1, usuario2) => {
        // Garantir que usuario1 seja sempre o menor para evitar duplicatas
        const [user1, user2] = usuario1 < usuario2 ? [usuario1, usuario2] : [usuario2, usuario1];
        return insertCasamento.run(user1, user2);
    },

    divorciarUsuarios: (usuario1, usuario2) => {
        return deleteCasamento.run(usuario1, usuario2, usuario2, usuario1);
    },

    obterConjuge: (usuario) => {
        return getConjuge.get(usuario, usuario, usuario);
    },

    verificarCasamento: (usuario1, usuario2) => {
        return verificarCasamento.get(usuario1, usuario2, usuario2, usuario1);
    }
};
