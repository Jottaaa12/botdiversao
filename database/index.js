const dbConnection = require('./connection');
const schema = require('./schema');

// Inicializa o banco de dados (cria tabelas e colunas) antes de carregar os repositórios
schema.initializeDatabase();

module.exports = {
    user: require('./repositories/userRepository'),
    project: require('./repositories/projectRepository'),
    financial: require('./repositories/financialRepository'),
    groupInteraction: require('./repositories/groupInteractionRepository'),
    config: require('./repositories/configRepository'),
    list: require('./repositories/listRepository'),
    schedule: require('./repositories/scheduleRepository'),

    // Função para fechar a conexão, que deve ser chamada no final do ciclo de vida da aplicação
    close: () => {
        if (dbConnection && dbConnection.open) {
            dbConnection.close();
        }
    }
};
