const aiService = require('../services/aiService');

module.exports = {
    name: 'ia',
    aliases: ['ai', 'perguntar'],
    description: 'Faça uma pergunta diretamente para a Inteligência Artificial.',
    category: 'utilitario',
    permission: 'user',
    async execute({ args, usuario, prefixo }) {
        const question = args.join(' ');

        if (!question) {
            return `🤖 Por favor, faça uma pergunta após o comando.\n\n*Exemplo:* ${prefixo}ia Qual a capital do Brasil?`;
        }

        try {
            const response = await aiService.generateChatResponse(question, usuario, prefixo);
            
            return `🤖 *Resposta da IA:*

${response}`;
        } catch (error) {
            console.error('[Comando IA] Erro ao gerar resposta da IA:', error);
            return '❌ Desculpe, ocorreu um erro ao tentar processar sua pergunta.';
        }
    },
};