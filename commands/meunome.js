const db = require('../database');

/**
 * Define ou atualiza o nome do usuário no banco de dados.
 * @param {string} message - A mensagem completa enviada pelo usuário.
 * @param {string} sender - O ID do remetente.
 * @returns {string} Uma resposta para o usuário.
 */
function executeSetName(message, sender) {
    const prefixo = db.config.obterConfiguracao('prefixo') || '/';
    const commandBody = message.substring(prefixo.length).trim();
    const args = commandBody.split(' ');
    args.shift(); // remove o nome do comando
    const newName = args.join(' ');

    if (!newName) {
        return `Por favor, me diga o seu nome. Use o formato: ${prefixo}meunome [seu nome]`;
    }

    try {
        const senderId = sender.split('@')[0];
        db.user.atualizarNomeUsuario(sender, newName);
        console.log(`Nome do usuário ${senderId} atualizado para: ${newName}`);
        return `Prazer em te conhecer, ${newName}! 😊 Vou me lembrar de você assim agora.`;
    } catch (error) {
        console.error('Erro ao atualizar o nome do usuário:', error);
        return 'Desculpe, tive um problema ao tentar lembrar do seu nome. Pode tentar de novo?';
    }
}

module.exports = {
    name: 'meunome',
    description: 'Ensina o seu nome para a assistente, para um tratamento mais pessoal.',
    category: 'Usuário',
    execute: executeSetName,
};
