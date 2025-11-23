const db = require('../connection');

// Prepared statements para agendamentos
const insertAgendamento = db.prepare(`
    INSERT INTO agendamentos (id_criador, destino_tipo, destino_jid, mensagem, horario, dias_semana, ativo)
    VALUES (?, ?, ?, ?, ?, ?, TRUE)
`);

const getAgendamento = db.prepare(`
    SELECT * FROM agendamentos WHERE id = ?
`);

const getAgendamentosPorCriador = db.prepare(`
    SELECT * FROM agendamentos WHERE id_criador = ? ORDER BY criado_em DESC
`);

const getTodosAgendamentosAtivos = db.prepare(`
    SELECT * FROM agendamentos WHERE ativo = TRUE
`);

const updateAgendamento = db.prepare(`
    UPDATE agendamentos
    SET mensagem = ?, horario = ?, dias_semana = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
`);

const deleteAgendamento = db.prepare(`
    DELETE FROM agendamentos WHERE id = ?
`);

const pausarAgendamentoStmt = db.prepare(`
    UPDATE agendamentos SET ativo = FALSE, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?
`);

const ativarAgendamentoStmt = db.prepare(`
    UPDATE agendamentos SET ativo = TRUE, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?
`);

const registrarEnvioAgendamento = db.prepare(`
    UPDATE agendamentos
    SET ultimo_envio = CURRENT_TIMESTAMP, total_envios = total_envios + 1
    WHERE id = ?
`);

module.exports = {
    criarAgendamento: (idCriador, destinoTipo, destinoJid, mensagem, horario, diasSemana = null) => {
        const diasStr = diasSemana ? JSON.stringify(diasSemana) : null;
        return insertAgendamento.run(idCriador, destinoTipo, destinoJid, mensagem, horario, diasStr);
    },

    obterAgendamento: (id) => {
        const row = getAgendamento.get(id);
        if (row && row.dias_semana) {
            row.dias_semana = JSON.parse(row.dias_semana);
        }
        return row;
    },

    listarAgendamentosPorCriador: (idCriador) => {
        const rows = getAgendamentosPorCriador.all(idCriador);
        return rows.map(row => ({
            ...row,
            dias_semana: row.dias_semana ? JSON.parse(row.dias_semana) : null
        }));
    },

    listarTodosAgendamentosAtivos: () => {
        const rows = getTodosAgendamentosAtivos.all();
        return rows.map(row => ({
            ...row,
            dias_semana: row.dias_semana ? JSON.parse(row.dias_semana) : null
        }));
    },

    atualizarAgendamento: (id, mensagem, horario, diasSemana) => {
        const diasStr = diasSemana ? JSON.stringify(diasSemana) : null;
        return updateAgendamento.run(mensagem, horario, diasStr, id);
    },

    removerAgendamento: (id) => {
        return deleteAgendamento.run(id);
    },

    pausarAgendamento: (id) => {
        return pausarAgendamentoStmt.run(id);
    },

    ativarAgendamento: (id) => {
        return ativarAgendamentoStmt.run(id);
    },

    registrarEnvioAgendamento: (id) => {
        return registrarEnvioAgendamento.run(id);
    }
};
