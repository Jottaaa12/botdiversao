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
    },

    // ========== CONFIGURAÇÕES AVANÇADAS ==========

    /**
     * Salva uma configuração avançada
     * @param {string} categoria - Categoria da configuração
     * @param {string} chave - Chave da configuração
     * @param {any} valor - Valor da configuração
     * @param {string} tipo - Tipo do valor (string, number, boolean, json)
     * @param {string} descricao - Descrição da configuração
     */
    salvarConfiguracaoAvancada: (categoria, chave, valor, tipo = 'string', descricao = null) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO configuracoes_avancadas (categoria, chave, valor, tipo, descricao, atualizado_em)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        // Converte valor para string se for objeto/array
        const valorString = (tipo === 'json' && typeof valor === 'object')
            ? JSON.stringify(valor)
            : String(valor);

        return stmt.run(categoria, chave, valorString, tipo, descricao);
    },

    /**
     * Obtém uma configuração avançada
     * @param {string} categoria - Categoria da configuração
     * @param {string} chave - Chave da configuração
     * @returns {any} Valor da configuração (convertido para o tipo apropriado)
     */
    obterConfiguracaoAvancada: (categoria, chave) => {
        const stmt = db.prepare(`
            SELECT valor, tipo FROM configuracoes_avancadas 
            WHERE categoria = ? AND chave = ?
        `);
        const row = stmt.get(categoria, chave);

        if (!row) return null;

        // Converte o valor de acordo com o tipo
        switch (row.tipo) {
            case 'number':
                return parseFloat(row.valor);
            case 'boolean':
                return row.valor === 'true' || row.valor === '1';
            case 'json':
                try {
                    return JSON.parse(row.valor);
                } catch (e) {
                    return row.valor;
                }
            default:
                return row.valor;
        }
    },

    /**
     * Lista todas as configurações de uma categoria
     * @param {string} categoria - Categoria das configurações
     * @returns {Array} Array de objetos com as configurações
     */
    listarConfiguracoesPorCategoria: (categoria) => {
        const stmt = db.prepare(`
            SELECT chave, valor, tipo, descricao, atualizado_em 
            FROM configuracoes_avancadas 
            WHERE categoria = ?
            ORDER BY chave
        `);
        return stmt.all(categoria);
    },

    /**
     * Lista todas as configurações avançadas
     * @returns {Array} Array de objetos com todas as configurações
     */
    listarTodasConfiguracoes: () => {
        const stmt = db.prepare(`
            SELECT categoria, chave, valor, tipo, descricao, atualizado_em 
            FROM configuracoes_avancadas 
            ORDER BY categoria, chave
        `);
        return stmt.all();
    },

    /**
     * Reseta todas as configurações de uma categoria
     * @param {string} categoria - Categoria a resetar
     * @returns {Object} Resultado da operação
     */
    resetarCategoria: (categoria) => {
        const stmt = db.prepare(`
            DELETE FROM configuracoes_avancadas WHERE categoria = ?
        `);
        return stmt.run(categoria);
    },

    /**
     * Reseta todas as configurações avançadas
     * @returns {Object} Resultado da operação
     */
    resetarTudo: () => {
        const stmt = db.prepare(`DELETE FROM configuracoes_avancadas`);
        return stmt.run();
    },

    /**
     * Exporta todas as configurações em formato JSON
     * @returns {Object} Objeto com todas as configurações
     */
    exportarConfiguracoes: () => {
        const configs = {};

        // Configurações básicas
        const basicConfigs = db.prepare('SELECT chave, valor FROM configuracoes').all();
        configs.basicas = {};
        basicConfigs.forEach(row => {
            configs.basicas[row.chave] = row.valor;
        });

        // Configurações avançadas
        const advancedConfigs = db.prepare(`
            SELECT categoria, chave, valor, tipo 
            FROM configuracoes_avancadas
        `).all();

        configs.avancadas = {};
        advancedConfigs.forEach(row => {
            if (!configs.avancadas[row.categoria]) {
                configs.avancadas[row.categoria] = {};
            }

            // Converte valor de acordo com o tipo
            let valor = row.valor;
            if (row.tipo === 'number') valor = parseFloat(valor);
            else if (row.tipo === 'boolean') valor = valor === 'true' || valor === '1';
            else if (row.tipo === 'json') {
                try {
                    valor = JSON.parse(valor);
                } catch (e) {
                    // Mantém como string se não conseguir parsear
                }
            }

            configs.avancadas[row.categoria][row.chave] = valor;
        });

        return configs;
    },

    /**
     * Importa configurações de um objeto JSON
     * @param {Object} configs - Objeto com as configurações
     * @returns {Object} Resultado da operação
     */
    importarConfiguracoes: (configs) => {
        try {
            let importadas = 0;

            // Importa configurações básicas
            if (configs.basicas) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO configuracoes (chave, valor, atualizado_em)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `);

                for (const [chave, valor] of Object.entries(configs.basicas)) {
                    stmt.run(chave, valor);
                    importadas++;
                }
            }

            // Importa configurações avançadas
            if (configs.avancadas) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO configuracoes_avancadas 
                    (categoria, chave, valor, tipo, atualizado_em)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                `);

                for (const [categoria, items] of Object.entries(configs.avancadas)) {
                    for (const [chave, valor] of Object.entries(items)) {
                        // Determina o tipo
                        let tipo = 'string';
                        let valorString = String(valor);

                        if (typeof valor === 'number') {
                            tipo = 'number';
                        } else if (typeof valor === 'boolean') {
                            tipo = 'boolean';
                        } else if (typeof valor === 'object') {
                            tipo = 'json';
                            valorString = JSON.stringify(valor);
                        }

                        stmt.run(categoria, chave, valorString, tipo);
                        importadas++;
                    }
                }
            }

            return {
                success: true,
                importadas
            };
        } catch (error) {
            console.error('[Config Repository] Erro ao importar configurações:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
