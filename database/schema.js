const db = require('./connection');

const initializeDatabase = () => {
    // Tabela de usuários
    db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_whatsapp TEXT UNIQUE NOT NULL,
            nome TEXT,
            historico_interacoes TEXT, -- JSON string
            banned BOOLEAN DEFAULT FALSE,
            role TEXT DEFAULT 'user', -- 'user', 'admin', 'owner'
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

    // Tabela de configurações de usuário
    db.exec(`
        CREATE TABLE IF NOT EXISTS configuracoes_usuario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario TEXT NOT NULL,
            chave TEXT NOT NULL,
            valor TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(id_usuario, chave)
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

    // Tabela de membros de grupo (para ranking e fantasmas)
    db.exec(`
        CREATE TABLE IF NOT EXISTS membros_grupo (
            id_grupo TEXT NOT NULL,
            id_usuario TEXT NOT NULL,
            msg_count INTEGER DEFAULT 0,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id_grupo, id_usuario)
        )
    `);

    // Tabela de casamentos
    db.exec(`
        CREATE TABLE IF NOT EXISTS casamentos (
            id_usuario1 TEXT NOT NULL,
            id_usuario2 TEXT NOT NULL,
            data_casamento DATETIME DEFAULT CURRENT_TIMESTAMP,
            nivel_amor INTEGER DEFAULT 100,
            PRIMARY KEY (id_usuario1, id_usuario2)
        )
    `);

    // Tabela de listas de grupo
    db.exec(`
        CREATE TABLE IF NOT EXISTS listas_grupo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_grupo TEXT NOT NULL,
            titulo TEXT NOT NULL,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            criado_por TEXT NOT NULL,
            ativa BOOLEAN DEFAULT TRUE,
            UNIQUE(id_grupo, ativa) -- Apenas uma lista ativa por grupo
        )
    `);

    // Tabela de membros de lista
    db.exec(`
        CREATE TABLE IF NOT EXISTS membros_lista (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_lista INTEGER NOT NULL,
            id_usuario TEXT NOT NULL,
            ordem INTEGER NOT NULL,
            adicionado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_lista) REFERENCES listas_grupo(id),
            UNIQUE(id_lista, id_usuario)
        )
    `);

    // Tabela de configurações de lista
    db.exec(`
        CREATE TABLE IF NOT EXISTS config_lista (
            id_grupo TEXT PRIMARY KEY,
            titulo_padrao TEXT,
            horario_envio TEXT, -- formato HH:MM
            envio_ativo BOOLEAN DEFAULT FALSE,
            horario_abertura TEXT, -- formato HH:MM
            dias_abertura TEXT, -- ex: "1,2,3,4,5"
            abertura_ativa BOOLEAN DEFAULT FALSE,
            dias_envio TEXT -- ex: "1,3,5" (Seg, Qua, Sex)
        )
    `);

    // Tabela de histórico de envios de lista
    db.exec(`
        CREATE TABLE IF NOT EXISTS historico_lista_envio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_grupo TEXT NOT NULL,
            data_envio TEXT NOT NULL, -- ISO timestamp
            sucesso BOOLEAN NOT NULL,
            erro TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de agendamentos de mensagens
    db.exec(`
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_criador TEXT NOT NULL,
            destino_tipo TEXT NOT NULL,
            destino_jid TEXT NOT NULL,
            mensagem TEXT NOT NULL,
            horario TEXT NOT NULL,
            dias_semana TEXT,
            ativo BOOLEAN DEFAULT TRUE,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            ultimo_envio DATETIME,
            total_envios INTEGER DEFAULT 0
        )
    `);

    // Migração para adicionar total_envios em agendamentos se não existir
    try {
        const infoAgendamentos = db.pragma('table_info(agendamentos)');
        const columnsAgendamentos = infoAgendamentos.map(col => col.name);
        if (!columnsAgendamentos.includes('total_envios')) {
            db.exec('ALTER TABLE agendamentos ADD COLUMN total_envios INTEGER DEFAULT 0');
        }
    } catch (e) {
        console.error("Erro ao migrar tabela agendamentos:", e);
    }

    // Migrações Gerais
    try {
        const info = db.pragma('table_info(usuarios)');
        const columns = info.map(col => col.name);
        if (!columns.includes('banned')) {
            db.exec('ALTER TABLE usuarios ADD COLUMN banned BOOLEAN DEFAULT FALSE');
        }
        if (!columns.includes('role')) {
            db.exec("ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT 'user'");
        }

        // Migração config_lista
        const infoConfig = db.pragma('table_info(config_lista)');
        const columnsConfig = infoConfig.map(col => col.name);
        if (!columnsConfig.includes('horario_abertura')) {
            console.log("Adicionando coluna 'horario_abertura' em 'config_lista'...");
            db.exec('ALTER TABLE config_lista ADD COLUMN horario_abertura TEXT');
        }
        if (!columnsConfig.includes('dias_abertura')) {
            console.log("Adicionando coluna 'dias_abertura' em 'config_lista'...");
            db.exec('ALTER TABLE config_lista ADD COLUMN dias_abertura TEXT');
        }
        if (!columnsConfig.includes('abertura_ativa')) {
            console.log("Adicionando coluna 'abertura_ativa' em 'config_lista'...");
            db.exec('ALTER TABLE config_lista ADD COLUMN abertura_ativa BOOLEAN DEFAULT FALSE');
        }
        if (!columnsConfig.includes('dias_envio')) {
            console.log("Adicionando coluna 'dias_envio' em 'config_lista'...");
            db.exec('ALTER TABLE config_lista ADD COLUMN dias_envio TEXT');
        }

        // Migração auto_respostas match_type
        const infoAuto = db.pragma('table_info(auto_respostas)');
        const columnsAuto = infoAuto.map(col => col.name);
        if (!columnsAuto.includes('match_type')) {
            console.log("Adicionando coluna 'match_type' em 'auto_respostas'...");
            db.exec("ALTER TABLE auto_respostas ADD COLUMN match_type TEXT DEFAULT 'exact'");
        }

    } catch (error) {
        console.error("Erro nas migrações:", error);
    }

    // Criação de Índices para Performance
    try {
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_advertencias_grupo_usuario 
            ON advertencias(id_grupo, id_usuario);
        `);
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_agendamentos_ativo 
            ON agendamentos(ativo, horario);
        `);
        console.log("Índices de performance verificados/criados.");
    } catch (error) {
        console.error("Erro ao criar índices:", error);
    }

    initConfig();
};

// Inicializar configurações padrão
const initConfig = () => {
    // Prepared statements para configurações (necessários apenas aqui para inicialização)
    const insertConfiguracao = db.prepare(`
        INSERT OR REPLACE INTO configuracoes (chave, valor, atualizado_em)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    const getConfiguracao = db.prepare(`
        SELECT valor FROM configuracoes WHERE chave = ?
    `);

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

module.exports = { initializeDatabase };
