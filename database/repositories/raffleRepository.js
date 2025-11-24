const db = require('../connection');

// Prepared statements para Rifas
const insertRifa = db.prepare(`
    INSERT INTO rifas (id_grupo, titulo, descricao, premio, preco_numero, quantidade_numeros, data_sorteio, id_criador, grupo_vinculado_id, grupo_vinculado_link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getRifaAtiva = db.prepare(`
    SELECT * FROM rifas WHERE (id_grupo = ? OR id_grupo IS NULL) AND status = 'ativa' LIMIT 1
`);

const getRifaById = db.prepare(`
    SELECT * FROM rifas WHERE id = ?
`);

const updateStatusRifa = db.prepare(`
    UPDATE rifas SET status = ? WHERE id = ?
`);

const updateSorteioRifa = db.prepare(`
    UPDATE rifas SET status = 'sorteada', numero_sorteado = ?, id_ganhador = ?, nome_ganhador = ?, sorteado_em = CURRENT_TIMESTAMP WHERE id = ?
`);

// Prepared statements para Números
const insertNumeroRifa = db.prepare(`
    INSERT INTO numeros_rifa (id_rifa, numero) VALUES (?, ?)
`);

const getNumerosDisponiveis = db.prepare(`
    SELECT numero FROM numeros_rifa WHERE id_rifa = ? AND status = 'disponivel' ORDER BY numero ASC
`);

const getNumerosReservadosUsuario = db.prepare(`
    SELECT numero FROM numeros_rifa WHERE id_rifa = ? AND id_comprador = ? AND status = 'reservado'
`);

const reservarNumero = db.prepare(`
    UPDATE numeros_rifa 
    SET status = 'reservado', id_comprador = ?, nome_comprador = ?, reservado_ate = datetime('now', '+10 minutes')
    WHERE id_rifa = ? AND numero = ? AND status = 'disponivel'
`);

const confirmarVendaNumero = db.prepare(`
    UPDATE numeros_rifa 
    SET status = 'vendido', cidade_comprador = ?, comprado_em = CURRENT_TIMESTAMP, reservado_ate = NULL
    WHERE id_rifa = ? AND numero = ? AND id_comprador = ?
`);

const getNumerosCompradosUsuario = db.prepare(`
    SELECT numero FROM numeros_rifa WHERE id_rifa = ? AND id_comprador = ? AND status = 'vendido' ORDER BY numero ASC
`);

const liberarNumero = db.prepare(`
    UPDATE numeros_rifa 
    SET status = 'disponivel', id_comprador = NULL, nome_comprador = NULL, cidade_comprador = NULL, reservado_ate = NULL, comprado_em = NULL
    WHERE id_rifa = ? AND numero = ?
`);

const liberarReservasExpiradasStmt = db.prepare(`
    UPDATE numeros_rifa 
    SET status = 'disponivel', id_comprador = NULL, nome_comprador = NULL, reservado_ate = NULL
    WHERE status = 'reservado' AND reservado_ate < datetime('now')
`);

// Prepared statements para Compras Pendentes
const insertCompraPendente = db.prepare(`
    INSERT INTO compras_pendentes (id_rifa, id_usuario, nome_usuario, cidade_usuario, numeros, valor_total, comprovante_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const getCompraPendente = db.prepare(`
    SELECT * FROM compras_pendentes WHERE id = ?
`);

const getCompraPendenteAguardando = db.prepare(`
    SELECT * FROM compras_pendentes WHERE status = 'aguardando' AND id_usuario = ? ORDER BY criado_em DESC LIMIT 1
`);

const getCompraPendenteAguardandoGlobal = db.prepare(`
    SELECT * FROM compras_pendentes WHERE status = 'aguardando' ORDER BY criado_em DESC LIMIT 1
`);

const updateStatusCompraPendente = db.prepare(`
    UPDATE compras_pendentes SET status = ?, confirmado_em = CURRENT_TIMESTAMP WHERE id = ?
`);

// Prepared statements para Dados Compradores
const insertDadosComprador = db.prepare(`
    INSERT OR REPLACE INTO dados_compradores (id_usuario, nome_completo, cidade, atualizado_em)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`);

const getDadosComprador = db.prepare(`
    SELECT * FROM dados_compradores WHERE id_usuario = ?
`);

// Prepared statements para Sessões IA
const insertSessaoCompra = db.prepare(`
    INSERT OR REPLACE INTO sessoes_compra_ia (id_usuario, id_rifa, etapa, numeros_escolhidos, tem_comprovante, tem_nome, tem_cidade, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

const getSessaoCompra = db.prepare(`
    SELECT * FROM sessoes_compra_ia WHERE id_usuario = ? AND id_rifa = ?
`);

const getSessaoCompraAtiva = db.prepare(`
    SELECT * FROM sessoes_compra_ia WHERE id_usuario = ? ORDER BY atualizado_em DESC LIMIT 1
`);

const deleteSessaoCompra = db.prepare(`
    DELETE FROM sessoes_compra_ia WHERE id_usuario = ? AND id_rifa = ?
`);

module.exports = {
    // --- RIFAS ---
    criarRifa: (idGrupo, titulo, descricao, premio, preco, qtdNumeros, dataSorteio, idCriador, grupoVinculadoId = null, grupoVinculadoLink = null) => {
        const info = insertRifa.run(idGrupo, titulo, descricao, premio, preco, qtdNumeros, dataSorteio, idCriador, grupoVinculadoId, grupoVinculadoLink);
        const idRifa = info.lastInsertRowid;

        // Inicializar números
        const insertMany = db.transaction((numeros) => {
            for (const num of numeros) insertNumeroRifa.run(idRifa, num);
        });

        const numerosArray = Array.from({ length: qtdNumeros }, (_, i) => i + 1);
        insertMany(numerosArray);

        return idRifa;
    },

    obterRifaAtiva: (idGrupo) => {
        return getRifaAtiva.get(idGrupo);
    },

    obterRifaAtivaGlobal: () => {
        // Busca a primeira rifa ativa encontrada no sistema, independente do grupo
        const stmt = db.prepare(`SELECT * FROM rifas WHERE status = 'ativa' ORDER BY criado_em DESC LIMIT 1`);
        return stmt.get();
    },

    obterRifa: (idRifa) => {
        return getRifaById.get(idRifa);
    },

    atualizarStatusRifa: (idRifa, status) => {
        return updateStatusRifa.run(status, idRifa);
    },

    // --- NÚMEROS ---
    obterNumerosDisponiveis: (idRifa) => {
        const rows = getNumerosDisponiveis.all(idRifa);
        return rows.map(r => r.numero);
    },

    verificarDisponibilidade: (idRifa, numeros) => {
        const disponiveis = getNumerosDisponiveis.all(idRifa).map(r => r.numero);
        return numeros.every(n => disponiveis.includes(n));
    },

    reservarNumeros: (idRifa, numeros, idUsuario, nomeUsuario) => {
        const transaction = db.transaction((nums) => {
            for (const n of nums) {
                reservarNumero.run(idUsuario, nomeUsuario, idRifa, n);
            }
        });
        transaction(numeros);
        return true;
    },

    confirmarCompra: (idRifa, numeros, idUsuario, nomeUsuario, cidade) => {
        const transaction = db.transaction((nums) => {
            for (const n of nums) {
                confirmarVendaNumero.run(cidade, idRifa, n, idUsuario);
            }
        });
        transaction(numeros);
        return true;
    },

    obterNumerosComprados: (idRifa, idUsuario) => {
        const rows = getNumerosCompradosUsuario.all(idRifa, idUsuario);
        return rows.map(r => r.numero);
    },

    liberarNumeros: (idRifa, numeros) => {
        const transaction = db.transaction((nums) => {
            for (const n of nums) {
                liberarNumero.run(idRifa, n);
            }
        });
        transaction(numeros);
        return true;
    },

    liberarReservasExpiradas: () => {
        return liberarReservasExpiradasStmt.run();
    },

    // --- COMPRAS PENDENTES ---
    criarCompraPendente: (idRifa, idUsuario, nome, cidade, numeros, valorTotal, comprovantePath) => {
        const numerosJson = JSON.stringify(numeros);
        const info = insertCompraPendente.run(idRifa, idUsuario, nome, cidade, numerosJson, valorTotal, comprovantePath);
        return {
            id: info.lastInsertRowid,
            id_rifa: idRifa,
            id_usuario: idUsuario,
            nome_usuario: nome,
            cidade_usuario: cidade,
            numeros: numerosJson,
            valor_total: valorTotal,
            comprovante_path: comprovantePath
        };
    },

    obterCompraPendente: (id) => {
        const compra = getCompraPendente.get(id);
        if (compra) compra.numeros = JSON.parse(compra.numeros);
        return compra;
    },

    obterCompraPendenteAguardandoConfirmacao: (idUsuario) => {
        const compra = getCompraPendenteAguardando.get(idUsuario);
        if (compra) compra.numeros = JSON.parse(compra.numeros);
        return compra;
    },

    obterCompraPendenteAguardandoGlobal: () => {
        const compra = getCompraPendenteAguardandoGlobal.get();
        if (compra) compra.numeros = JSON.parse(compra.numeros);
        return compra;
    },

    confirmarCompraPendente: (id) => {
        return updateStatusCompraPendente.run('confirmado', id);
    },

    recusarCompraPendente: (id) => {
        return updateStatusCompraPendente.run('recusado', id);
    },

    // --- DADOS COMPRADORES ---
    salvarDadosComprador: (idUsuario, nome, cidade) => {
        return insertDadosComprador.run(idUsuario, nome, cidade);
    },

    obterDadosComprador: (idUsuario) => {
        return getDadosComprador.get(idUsuario);
    },

    // --- SESSÕES IA ---
    criarSessaoCompra: (idUsuario, idRifa) => {
        return insertSessaoCompra.run(idUsuario, idRifa, 'interesse', '[]', 0, 0, 0);
    },

    obterSessaoCompra: (idUsuario, idRifa) => {
        if (!idRifa) return getSessaoCompraAtiva.get(idUsuario);
        return getSessaoCompra.get(idUsuario, idRifa);
    },

    atualizarSessaoCompra: (idUsuario, idRifa, dados) => {
        // Primeiro obtém a sessão atual para manter dados não alterados
        const sessaoAtual = getSessaoCompra.get(idUsuario, idRifa);
        if (!sessaoAtual) return null;

        const novaEtapa = dados.etapa || sessaoAtual.etapa;
        const novosNumeros = dados.numeros_escolhidos || sessaoAtual.numeros_escolhidos;
        const temComprovante = dados.tem_comprovante !== undefined ? (dados.tem_comprovante ? 1 : 0) : sessaoAtual.tem_comprovante;
        const temNome = dados.tem_nome !== undefined ? (dados.tem_nome ? 1 : 0) : sessaoAtual.tem_nome;
        const temCidade = dados.tem_cidade !== undefined ? (dados.tem_cidade ? 1 : 0) : sessaoAtual.tem_cidade;

        return insertSessaoCompra.run(idUsuario, idRifa, novaEtapa, novosNumeros, temComprovante, temNome, temCidade);
    },

    finalizarSessaoCompra: (idUsuario, idRifa) => {
        return deleteSessaoCompra.run(idUsuario, idRifa);
    },

    // --- SORTEIO ---
    realizarSorteio: (idRifa) => {
        // 1. Obter números vendidos
        const numerosVendidos = db.prepare(`SELECT numero, id_comprador, nome_comprador FROM numeros_rifa WHERE id_rifa = ? AND status = 'vendido'`).all(idRifa);

        if (numerosVendidos.length === 0) return null;

        // 2. Sortear um índice aleatório
        const indiceSorteado = Math.floor(Math.random() * numerosVendidos.length);
        const ganhador = numerosVendidos[indiceSorteado];

        // 3. Atualizar rifa
        updateSorteioRifa.run(ganhador.numero, ganhador.id_comprador, ganhador.nome_comprador, idRifa);

        return ganhador;
    }
};
