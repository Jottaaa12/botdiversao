const db = require('../connection');

// Prepared statements para listas
const insertConfigLista = db.prepare(`
    INSERT OR REPLACE INTO config_lista (id_grupo, titulo_padrao, horario_envio, envio_ativo, horario_abertura, dias_abertura, abertura_ativa, dias_envio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getConfigLista = db.prepare(`
    SELECT * FROM config_lista WHERE id_grupo = ?
`);

const insertLista = db.prepare(`
    INSERT INTO listas_grupo (id_grupo, titulo, criado_por, ativa)
    VALUES (?, ?, ?, TRUE)
`);

const getListaAtiva = db.prepare(`
    SELECT * FROM listas_grupo WHERE id_grupo = ? AND ativa = TRUE
`);

const desativarListasGrupo = db.prepare(`
    UPDATE listas_grupo SET ativa = FALSE WHERE id_grupo = ?
`);

const deleteLista = db.prepare(`
    DELETE FROM listas_grupo WHERE id = ?
`);

const deleteMembrosDaLista = db.prepare(`
    DELETE FROM membros_lista WHERE id_lista = ?
`);

const insertMembroLista = db.prepare(`
    INSERT INTO membros_lista (id_lista, id_usuario, ordem)
    VALUES (?, ?, ?)
`);

const deleteMembroLista = db.prepare(`
    DELETE FROM membros_lista WHERE id_lista = ? AND id_usuario = ?
`);

const getMembrosLista = db.prepare(`
    SELECT * FROM membros_lista WHERE id_lista = ? ORDER BY ordem ASC
`);

const getProximaOrdemLista = db.prepare(`
    SELECT COALESCE(MAX(ordem), 0) + 1 as proxima_ordem FROM membros_lista WHERE id_lista = ?
`);

const getAllListasAtivas = db.prepare(`
    SELECT * FROM listas_grupo WHERE ativa = TRUE
`);

const getGruposComEnvioAtivo = db.prepare(`
    SELECT * FROM config_lista WHERE envio_ativo = TRUE
`);

const getGruposComAberturaAtiva = db.prepare(`
    SELECT * FROM config_lista WHERE abertura_ativa = TRUE
`);

const getTodasListasGrupo = db.prepare(`
    SELECT * FROM listas_grupo WHERE id_grupo = ? ORDER BY data_criacao DESC
`);

const insertHistoricoEnvio = db.prepare(`
    INSERT INTO historico_lista_envio (id_grupo, data_envio, sucesso, erro)
    VALUES (?, ?, ?, ?)
`);

const getHistoricoEnvios = db.prepare(`
    SELECT * FROM historico_lista_envio WHERE id_grupo = ? ORDER BY data_envio DESC LIMIT ?
`);

module.exports = {
    definirTituloPadraoLista: (idGrupo, titulo) => {
        const config = getConfigLista.get(idGrupo);
        if (config) {
            return insertConfigLista.run(idGrupo, titulo, config.horario_envio, config.envio_ativo, config.horario_abertura, config.dias_abertura, config.abertura_ativa, config.dias_envio);
        } else {
            return insertConfigLista.run(idGrupo, titulo, null, 0, null, null, 0, null);
        }
    },

    obterTituloPadraoLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        return config ? config.titulo_padrao : null;
    },

    definirHorarioEnvioLista: (idGrupo, horario, dias = null) => {
        const config = getConfigLista.get(idGrupo);
        const diasStr = dias ? (Array.isArray(dias) ? dias.join(',') : dias) : null;

        if (config) {
            return insertConfigLista.run(idGrupo, config.titulo_padrao, horario, 1, config.horario_abertura, config.dias_abertura, config.abertura_ativa, diasStr);
        } else {
            return insertConfigLista.run(idGrupo, null, horario, 1, null, null, 0, diasStr);
        }
    },

    obterHorarioEnvioLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        return config ? config.horario_envio : null;
    },

    definirHorarioAberturaLista: (idGrupo, horario, dias) => {
        const config = getConfigLista.get(idGrupo);
        if (config) {
            return insertConfigLista.run(idGrupo, config.titulo_padrao, config.horario_envio, config.envio_ativo, horario, dias, 1, config.dias_envio);
        } else {
            return insertConfigLista.run(idGrupo, null, null, 0, horario, dias, 1, null);
        }
    },

    obterHorarioAberturaLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        return config ? { horario: config.horario_abertura, dias: config.dias_abertura } : null;
    },

    obterGruposComEnvioAtivo: () => {
        return getGruposComEnvioAtivo.all();
    },

    obterGruposComAberturaAtiva: () => {
        return getGruposComAberturaAtiva.all();
    },

    pausarAberturaLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        if (config) {
            return insertConfigLista.run(
                idGrupo,
                config.titulo_padrao,
                config.horario_envio,
                config.envio_ativo,
                config.horario_abertura,
                config.dias_abertura,
                0,  // abertura_ativa = FALSE
                config.dias_envio
            );
        }
        return null;
    },

    reativarAberturaLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        if (config && config.horario_abertura) {
            return insertConfigLista.run(
                idGrupo,
                config.titulo_padrao,
                config.horario_envio,
                config.envio_ativo,
                config.horario_abertura,
                config.dias_abertura,
                1,  // abertura_ativa = TRUE
                config.dias_envio
            );
        }
        return null;
    },

    cancelarAberturaLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        if (config) {
            return insertConfigLista.run(
                idGrupo,
                config.titulo_padrao,
                config.horario_envio,
                config.envio_ativo,
                null,  // horario_abertura = NULL
                null,  // dias_abertura = NULL
                0,      // abertura_ativa = FALSE
                config.dias_envio
            );
        }
        return null;
    },

    criarLista: (idGrupo, titulo, idCriador) => {
        // Desativa qualquer lista ativa anterior
        desativarListasGrupo.run(idGrupo);
        // Cria nova lista
        return insertLista.run(idGrupo, titulo, idCriador);
    },

    obterListaAtiva: (idGrupo) => {
        return getListaAtiva.get(idGrupo);
    },

    obterTodasListasGrupo: (idGrupo) => {
        return getTodasListasGrupo.all(idGrupo);
    },

    adicionarMembroLista: (idLista, idUsuario) => {
        // Verifica se já está na lista
        const membros = getMembrosLista.all(idLista);
        const jaExiste = membros.find(m => m.id_usuario === idUsuario);
        if (jaExiste) {
            return null; // Já está na lista
        }
        // Obtém próxima ordem
        const { proxima_ordem } = getProximaOrdemLista.get(idLista);
        return insertMembroLista.run(idLista, idUsuario, proxima_ordem);
    },

    removerMembroLista: (idLista, idUsuario) => {
        return deleteMembroLista.run(idLista, idUsuario);
    },

    limparMembrosLista: (idLista) => {
        return deleteMembrosDaLista.run(idLista);
    },

    obterMembrosLista: (idLista) => {
        return getMembrosLista.all(idLista);
    },

    excluirLista: (idLista) => {
        // Remove membros primeiro
        deleteMembrosDaLista.run(idLista);
        // Remove lista
        return deleteLista.run(idLista);
    },

    resetarListasAtivas: () => {
        // Obtém todas as listas ativas
        const listasAtivas = getAllListasAtivas.all();
        // Exclui cada uma
        for (const lista of listasAtivas) {
            deleteMembrosDaLista.run(lista.id);
            deleteLista.run(lista.id);
        }
        return listasAtivas.length;
    },

    encerrarLista: (idLista) => {
        // Remove membros primeiro
        deleteMembrosDaLista.run(idLista);
        // Remove lista
        return deleteLista.run(idLista);
    },

    obterConfigLista: (idGrupo) => {
        return getConfigLista.get(idGrupo);
    },

    pausarEnvioLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        if (config) {
            return insertConfigLista.run(
                idGrupo,
                config.titulo_padrao,
                config.horario_envio,
                0, // envio_ativo = FALSE
                config.horario_abertura,
                config.dias_abertura,
                config.abertura_ativa,
                config.dias_envio
            );
        }
        return null;
    },

    ativarEnvioLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        if (config && config.horario_envio) {
            return insertConfigLista.run(
                idGrupo,
                config.titulo_padrao,
                config.horario_envio,
                1, // envio_ativo = TRUE
                config.horario_abertura,
                config.dias_abertura,
                config.abertura_ativa,
                config.dias_envio
            );
        }
        return null;
    },

    cancelarEnvioLista: (idGrupo) => {
        const config = getConfigLista.get(idGrupo);
        if (config) {
            return insertConfigLista.run(
                idGrupo,
                config.titulo_padrao,
                null, // horario_envio = NULL
                0,    // envio_ativo = FALSE
                config.horario_abertura,
                config.dias_abertura,
                config.abertura_ativa,
                null  // dias_envio = NULL
            );
        }
        return null;
    },

    registrarEnvioLista: (idGrupo, sucesso, erro = null) => {
        const dataEnvio = new Date().toISOString();
        return insertHistoricoEnvio.run(idGrupo, dataEnvio, sucesso ? 1 : 0, erro);
    },

    obterHistoricoEnvios: (idGrupo, limite = 10) => {
        return getHistoricoEnvios.all(idGrupo, limite);
    },

    listarGruposComListaAtiva: () => {
        return getGruposComEnvioAtivo.all();
    }
};
