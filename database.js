const Database = require('better-sqlite3');
const path = require('path');

// Caminho para o banco de dados
const dbPath = path.join(__dirname, 'assistente.db');
const db = new Database(dbPath);

// Habilitar WAL mode para melhor performance
db.pragma('journal_mode = WAL');

// Criar tabelas se não existirem
const createTables = () => {
    // Tabela de usuários
    db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_whatsapp TEXT UNIQUE NOT NULL,
            nome TEXT,
            historico_interacoes TEXT, -- JSON string
            banned BOOLEAN DEFAULT FALSE,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de projetos
    db.exec(`
        CREATE TABLE IF NOT EXISTS projetos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            descricao TEXT,
            arquivos_anexados TEXT, -- JSON string com caminhos/URLs
            analises_geradas TEXT, -- JSON string
            id_usuario INTEGER,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
        )
    `);

    // Tabela de contabilidade
    db.exec(`
        CREATE TABLE IF NOT EXISTS contabilidade (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mes_ano TEXT NOT NULL, -- formato YYYY-MM
            vendas REAL DEFAULT 0,
            custos REAL DEFAULT 0,
            lucros REAL DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de dados financeiros
    db.exec(`
        CREATE TABLE IF NOT EXISTS dados_financeiros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria TEXT NOT NULL,
            valor REAL NOT NULL,
            periodo TEXT NOT NULL, -- mês ou ano
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de documentos
    db.exec(`
        CREATE TABLE IF NOT EXISTS documentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resumo TEXT,
            metadados TEXT, -- JSON string
            analises TEXT, -- JSON string
            id_usuario INTEGER,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
        )
    `);

    // Tabela de vendas
    db.exec(`
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT,
            pedido_id INTEGER,
            data_hora TEXT,
            itens TEXT, -- JSON string com array de itens
            forma_pagamento TEXT,
            valor_pago REAL,
            troco REAL,
            total_geral REAL,
            id_usuario INTEGER,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
        )
    `);

    // Tabela de fechamentos de caixa
    db.exec(`
        CREATE TABLE IF NOT EXISTS fechamentos_caixa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            operador TEXT,
            horario_inicio TEXT,
            horario_fim TEXT,
            sessao TEXT,
            vendas_dinheiro REAL DEFAULT 0,
            qtd_vendas_dinheiro INTEGER DEFAULT 0,
            vendas_pix REAL DEFAULT 0,
            qtd_vendas_pix INTEGER DEFAULT 0,
            total_vendas REAL DEFAULT 0,
            acai_vendido REAL DEFAULT 0,
            movimentacoes TEXT, -- JSON string com array de movimentações
            total_geral REAL DEFAULT 0,
            fiados TEXT, -- JSON string com array de fiados
            saldo_inicial REAL DEFAULT 0,
            valor_esperado REAL DEFAULT 0,
            valor_contado REAL DEFAULT 0,
            diferenca REAL DEFAULT 0,
            tipo_diferenca TEXT, -- 'sobra' ou 'falta'
            id_usuario INTEGER,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
        )
    `);

    // Tabela de configurações globais
    db.exec(`
        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de configurações de grupo
    db.exec(`
        CREATE TABLE IF NOT EXISTS configuracoes_grupo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_grupo TEXT NOT NULL,
            chave TEXT NOT NULL,
            valor TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(id_grupo, chave)
        )
    `);

    // Tabela de advertências
    db.exec(`
        CREATE TABLE IF NOT EXISTS advertencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_grupo TEXT NOT NULL,
            id_usuario TEXT NOT NULL,
            motivo TEXT,
            id_autor TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de usuários mutados
    db.exec(`
        CREATE TABLE IF NOT EXISTS mutados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario TEXT NOT NULL,
            id_grupo TEXT NOT NULL,
            tempo_expiracao DATETIME, -- null para mute permanente
            mutado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(id_usuario, id_grupo)
        )
    `);
    // Tabela de auto-respostas
    db.exec(`
        CREATE TABLE IF NOT EXISTS auto_respostas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gatilho TEXT NOT NULL,
            resposta TEXT NOT NULL,
            id_grupo TEXT NOT NULL,
            criado_por TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(gatilho, id_grupo)
        )
    `);
};

// Inicializar banco
createTables();

// Adicionar a coluna 'banned' à tabela 'usuarios' se ela não existir
try {
    const info = db.pragma('table_info(usuarios)');
    const columns = info.map(col => col.name);
    if (!columns.includes('banned')) {
        console.log("A coluna 'banned' não existe na tabela 'usuarios'. Adicionando...");
        db.exec('ALTER TABLE usuarios ADD COLUMN banned BOOLEAN DEFAULT FALSE');
        console.log("Coluna 'banned' adicionada com sucesso.");
    }
} catch (error) {
    console.error("Erro ao migrar a tabela 'usuarios':", error);
}

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

const banUser = db.prepare(`
    UPDATE usuarios SET banned = TRUE, atualizado_em = CURRENT_TIMESTAMP WHERE id_whatsapp = ?
`);

const unbanUser = db.prepare(`
    UPDATE usuarios SET banned = FALSE, atualizado_em = CURRENT_TIMESTAMP WHERE id_whatsapp = ?
`);

// Prepared statements para projetos
const insertProjeto = db.prepare(`
    INSERT INTO projetos (titulo, descricao, arquivos_anexados, analises_geradas, id_usuario)
    VALUES (?, ?, ?, ?, ?)
`);

const getProjetosUsuario = db.prepare(`
    SELECT * FROM projetos WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const updateProjeto = db.prepare(`
    UPDATE projetos SET titulo = ?, descricao = ?, arquivos_anexados = ?, analises_geradas = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
`);

// Prepared statements para contabilidade
const insertContabilidade = db.prepare(`
    INSERT OR REPLACE INTO contabilidade (mes_ano, vendas, custos, lucros)
    VALUES (?, ?, ?, ?)
`);

const getContabilidadeMes = db.prepare(`
    SELECT * FROM contabilidade WHERE mes_ano = ?
`);

const updateContabilidade = db.prepare(`
    UPDATE contabilidade SET vendas = ?, custos = ?, lucros = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE mes_ano = ?
`);

// Prepared statements para documentos
const insertDocumento = db.prepare(`
    INSERT INTO documentos (resumo, metadados, analises, id_usuario)
    VALUES (?, ?, ?, ?)
`);

const getDocumentosUsuario = db.prepare(`
    SELECT * FROM documentos WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const updateDocumento = db.prepare(`
    UPDATE documentos SET resumo = ?, metadados = ?, analises = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
`);

// Prepared statements para dados financeiros
const insertDadoFinanceiro = db.prepare(`
    INSERT INTO dados_financeiros (categoria, valor, periodo)
    VALUES (?, ?, ?)
`);

const getDadosFinanceirosPorPeriodo = db.prepare(`
    SELECT * FROM dados_financeiros WHERE periodo = ? ORDER BY criado_em DESC
`);

const getTodosDadosFinanceiros = db.prepare(`
    SELECT * FROM dados_financeiros ORDER BY periodo DESC, criado_em DESC
`);

// Prepared statements para vendas
const insertVenda = db.prepare(`
    INSERT INTO vendas (cliente, pedido_id, data_hora, itens, forma_pagamento, valor_pago, troco, total_geral, id_usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getVendasUsuario = db.prepare(`
    SELECT * FROM vendas WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const getTodasVendas = db.prepare(`
    SELECT * FROM vendas ORDER BY criado_em DESC
`);

// Prepared statements para fechamentos de caixa
const insertFechamentoCaixa = db.prepare(`
    INSERT INTO fechamentos_caixa (
        data, operador, horario_inicio, horario_fim, sessao,
        vendas_dinheiro, qtd_vendas_dinheiro, vendas_pix, qtd_vendas_pix,
        total_vendas, acai_vendido, movimentacoes, total_geral, fiados,
        saldo_inicial, valor_esperado, valor_contado, diferenca, tipo_diferenca,
        id_usuario
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getFechamentosUsuario = db.prepare(`
    SELECT * FROM fechamentos_caixa WHERE id_usuario = ? ORDER BY criado_em DESC
`);

const getTodosFechamentos = db.prepare(`
    SELECT * FROM fechamentos_caixa ORDER BY criado_em DESC
`);

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

// Prepared statements para auto-respostas
const insertAutoResposta = db.prepare(`
    INSERT OR REPLACE INTO auto_respostas (gatilho, resposta, id_grupo, criado_por)
    VALUES (?, ?, ?, ?)
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

// Funções exportadas
module.exports = {
    // Usuários
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
        return updateNomeUsuario.run(nome, idWhatsapp);
    },

    banUser: (idWhatsapp) => {
        return banUser.run(idWhatsapp);
    },

    unbanUser: (idWhatsapp) => {
        return unbanUser.run(idWhatsapp);
    },

    // Projetos
    salvarProjeto: (titulo, descricao, arquivos = [], analises = [], idUsuario) => {
        const arquivosStr = JSON.stringify(arquivos);
        const analisesStr = JSON.stringify(analises);
        return insertProjeto.run(titulo, descricao, arquivosStr, analisesStr, idUsuario);
    },

    obterProjetosUsuario: (idUsuario) => {
        const rows = getProjetosUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            arquivos_anexados: JSON.parse(row.arquivos_anexados || '[]'),
            analises_geradas: JSON.parse(row.analises_geradas || '[]')
        }));
    },

    atualizarProjeto: (id, titulo, descricao, arquivos, analises) => {
        const arquivosStr = JSON.stringify(arquivos);
        const analisesStr = JSON.stringify(analises);
        return updateProjeto.run(titulo, descricao, arquivosStr, analisesStr, id);
    },

    // Contabilidade
    salvarContabilidade: (mesAno, vendas, custos, lucros) => {
        return insertContabilidade.run(mesAno, vendas, custos, lucros);
    },

    obterContabilidadeMes: (mesAno) => {
        return getContabilidadeMes.get(mesAno);
    },

    atualizarContabilidade: (mesAno, vendas, custos, lucros) => {
        return updateContabilidade.run(vendas, custos, lucros, mesAno);
    },

    // Documentos
    salvarDocumento: (resumo, metadados = {}, analises = {}, idUsuario) => {
        const metadadosStr = JSON.stringify(metadados);
        const analisesStr = JSON.stringify(analises);
        return insertDocumento.run(resumo, metadadosStr, analisesStr, idUsuario);
    },

    obterDocumentosUsuario: (idUsuario) => {
        const rows = getDocumentosUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            metadados: JSON.parse(row.metadados || '{}'),
            analises: JSON.parse(row.analises || '{}')
        }));
    },

    atualizarDocumento: (id, resumo, metadados, analises) => {
        const metadadosStr = JSON.stringify(metadados);
        const analisesStr = JSON.stringify(analises);
        return updateDocumento.run(resumo, metadadosStr, analisesStr, id);
    },

    // Dados Financeiros
    salvarDadoFinanceiro: (categoria, valor, periodo) => {
        return insertDadoFinanceiro.run(categoria, valor, periodo);
    },

    obterDadosFinanceirosPorPeriodo: (periodo) => {
        return getDadosFinanceirosPorPeriodo.all(periodo);
    },

    obterTodosDadosFinanceiros: () => {
        return getTodosDadosFinanceiros.all();
    },

    // Vendas
    salvarVenda: (cliente, pedidoId, dataHora, itens, formaPagamento, valorPago, troco, totalGeral, idUsuario) => {
        const itensStr = JSON.stringify(itens);
        return insertVenda.run(cliente, pedidoId, dataHora, itensStr, formaPagamento, valorPago, troco, totalGeral, idUsuario);
    },

    obterVendasUsuario: (idUsuario) => {
        const rows = getVendasUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            itens: JSON.parse(row.itens || '[]')
        }));
    },

    obterTodasVendas: () => {
        const rows = getTodasVendas.all();
        return rows.map(row => ({
            ...row,
            itens: JSON.parse(row.itens || '[]')
        }));
    },

    // Fechamentos de Caixa
    salvarFechamentoCaixa: (data, operador, horarioInicio, horarioFim, sessao,
        vendasDinheiro, qtdVendasDinheiro, vendasPix, qtdVendasPix,
        totalVendas, acaiVendido, movimentacoes, totalGeral, fiados,
        saldoInicial, valorEsperado, valorContado, diferenca, tipoDiferenca, idUsuario) => {
        const movimentacoesStr = JSON.stringify(movimentacoes);
        const fiadosStr = JSON.stringify(fiados);
        return insertFechamentoCaixa.run(data, operador, horarioInicio, horarioFim, sessao,
            vendasDinheiro, qtdVendasDinheiro, vendasPix, qtdVendasPix,
            totalVendas, acaiVendido, movimentacoesStr, totalGeral, fiadosStr,
            saldoInicial, valorEsperado, valorContado, diferenca, tipoDiferenca, idUsuario);
    },

    obterFechamentosUsuario: (idUsuario) => {
        const rows = getFechamentosUsuario.all(idUsuario);
        return rows.map(row => ({
            ...row,
            movimentacoes: JSON.parse(row.movimentacoes || '[]'),
            fiados: JSON.parse(row.fiados || '[]')
        }));
    },

    obterTodosFechamentos: () => {
        const rows = getTodosFechamentos.all();
        return rows.map(row => ({
            ...row,
            movimentacoes: JSON.parse(row.movimentacoes || '[]'),
            fiados: JSON.parse(row.fiados || '[]')
        }));
    },

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

    getMutedUsers: () => {
        return getAllMutes.all();
    },

    // Funções de Auto-Resposta
    adicionarAutoResposta: (gatilho, resposta, idGrupo, idUsuario) => {
        return insertAutoResposta.run(gatilho.toLowerCase(), resposta, idGrupo, idUsuario);
    },
    obterAutoResposta: (gatilho, idGrupo) => {
        return getAutoResposta.get(gatilho.toLowerCase(), idGrupo);
    },
    listarAutoRespostas: (idGrupo) => {
        return listAutoRespostas.all(idGrupo);
    },
    removerAutoResposta: (gatilho, idGrupo) => {
        return deleteAutoResposta.run(gatilho.toLowerCase(), idGrupo);
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
    },

    // Fechar banco
    fechar: () => {
        db.close();
    }
};

// Inicializar configurações padrão
const initConfig = () => {
    // Prefixo padrão
    if (!getConfiguracao.get('prefixo')) {
        insertConfiguracao.run('prefixo', '/');
    }

    // Configurações do bot
    if (!getConfiguracao.get('dono')) {
        insertConfiguracao.run('dono', 'Administrador');
    }

    if (!getConfiguracao.get('contato_dono')) {
        insertConfiguracao.run('contato_dono', 'Não informado');
    }

    if (!getConfiguracao.get('versao')) {
        insertConfiguracao.run('versao', '1.0.0');
    }

    if (!getConfiguracao.get('idioma')) {
        insertConfiguracao.run('idioma', 'pt');
    }

    if (!getConfiguracao.get('anuncios')) {
        insertConfiguracao.run('anuncios', 'on');
    }

    // Estatísticas
    if (!getConfiguracao.get('total_mensagens')) {
        insertConfiguracao.run('total_mensagens', '0');
    }

    if (!getConfiguracao.get('comandos_executados')) {
        insertConfiguracao.run('comandos_executados', '0');
    }

    if (!getConfiguracao.get('usuarios_ativos')) {
        insertConfiguracao.run('usuarios_ativos', '0');
    }

    if (!getConfiguracao.get('total_grupos')) {
        insertConfiguracao.run('total_grupos', '0');
    }
};

initConfig();
