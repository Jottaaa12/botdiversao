const db = require('../database');

/**
 * Desbane um usuário do bot.
 * @param {object} context - O objeto de contexto da mensagem.
 * @param {string[]} context.args - Argumentos do comando. O primeiro argumento deve ser o JID do usuário a ser desbanido.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
function executeUnban({ args }) {
    const userToUnban = args[0];

    if (!userToUnban) {
        return 'Por favor, especifique o ID do usuário para desbanir. Ex: /unban 5511999998888@s.whatsapp.net';
    }

    try {
        db.unbanUser(userToUnban);
        console.log(`[Comando Unban] Usuário ${userToUnban} foi desbanido.`);
        return `✅ Usuário *${userToUnban}* foi desbanido com sucesso.`;
    } catch (error) {
        console.error(`[Comando Unban] Erro ao desbanir ${userToUnban}:`, error);
        return `❌ Erro ao tentar desbanir o usuário. Verifique os logs.`;
    }
}

module.exports = {
    name: 'unban',
    description: 'Desbane um usuário, permitindo que ele volte a interagir com o bot.',
    category: 'adm',
    permission: 'admin', // Apenas admins e donos podem usar
    execute: executeUnban,
};
