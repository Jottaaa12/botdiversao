module.exports = {
    name: 'testerro',
    aliases: ['teste_erro'],
    category: 'admin',
    description: 'Comando de teste para verificar notificação de erros (apenas owner)',
    permission: 'owner',
    async execute({ sock, senderJid, chatJid, msg }) {
        // Simula diferentes tipos de erro para testar

        // Erro simples
        throw new Error('🧪 Teste de notificação de erro - Este é um erro simulado para testar o sistema de notificação automática!');

        // Você pode descomentar as linhas abaixo para testar outros tipos de erro:

        // Erro de referência
        // const obj = null;
        // return obj.propriedade; // TypeError: Cannot read property 'propriedade' of null

        // Erro de sintaxe simulado
        // JSON.parse('{ invalid json }'); // SyntaxError
    }
};
