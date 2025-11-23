const db = require('../database');

/**
 * Mostra o prefixo atual ou altera para um novo.
 * @param {object} context - O objeto de contexto da mensagem.
 * @param {string[]} context.args - Argumentos do comando. O primeiro (opcional) é o novo prefixo.
 * @param {string} context.prefixo - O prefixo atual.
 * @returns {string} Uma mensagem de confirmação ou o prefixo atual.
 */
function executePrefix({ args, prefixo }) {
    const novoPrefixo = args[0];

    // Se não houver argumentos, apenas mostre o prefixo atual
    if (!novoPrefixo) {
        return `O prefixo atual dos comandos é: *${prefixo}*`;
    }

    // Se houver um argumento, tente alterar o prefixo
    if (novoPrefixo.length > 5) {
        return 'O novo prefixo deve ter no máximo 5 caracteres.';
    }

    try {
        db.config.salvarConfiguracao('prefixo', novoPrefixo);
        console.log(`[Comando Prefixo] Prefixo alterado para '${novoPrefixo}'.`);
        return `✅ Prefixo de comandos foi alterado para: *${novoPrefixo}*`;
    } catch (error) {
        console.error(`[Comando Prefixo] Erro ao alterar o prefixo:`, error);
        return '❌ Ocorreu um erro ao tentar alterar o prefixo.';
    }
}

module.exports = {
    name: 'prefixo',
    description: 'Mostra ou altera o prefixo usado para chamar os comandos.',
    category: 'adm',
    permission: 'admin', // Apenas admins e donos podem alterar
    execute: executePrefix,
    aliases: ['prefix'], // Alias em inglês
};
