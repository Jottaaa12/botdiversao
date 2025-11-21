/**
 * Comando para ativar/desativar o anti-link em grupos.
 * Remove automaticamente usuários que enviam links de outros grupos de WhatsApp.
 * Apenas administradores podem usar este comando.
 * @param {object} context - O objeto de contexto da mensagem.
 * @param {object} context.sock - A instância do socket do WhatsApp.
 * @param {object} context.msg - A mensagem recebida.
 * @param {string} context.message - O texto da mensagem.
 * @param {string[]} context.args - Argumentos do comando.
 * @param {string} context.commandName - Nome do comando.
 * @param {string} context.prefixo - Prefixo usado.
 * @param {object} context.usuario - Dados do usuário.
 * @param {string} context.permissionLevel - Nível de permissão do usuário.
 * @param {object} context.db - Instância do banco de dados.
 * @returns {string} Uma mensagem de confirmação ou erro.
 */
async function executeAntiLink({ sock, msg, senderJid, message, args, commandName, prefixo, usuario, permissionLevel, db }) {
    const chatJid = msg.key.remoteJid;

    // Verificar se é um grupo
    if (!chatJid.endsWith('@g.us')) {
        return '❌ Este comando só pode ser usado em grupos.';
    }

    try {
        // Obter metadados do grupo
        const groupMetadata = await sock.groupMetadata(chatJid);
        const participants = groupMetadata.participants;
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);

        // Verificar se o usuário é admin do grupo
        if (!admins.includes(senderJid)) {
            return '❌ Apenas administradores do grupo podem usar este comando.';
        }

        // Obter o status atual do anti-link
        const currentStatus = db.obterConfiguracaoGrupo(chatJid, 'antilink') === 'true'; // Retorna true ou false
        
        // Determinar o novo status
        const newStatus = !currentStatus;
        const newStatusString = newStatus ? 'true' : 'false';

        // Salvar configuração no banco
        db.salvarConfiguracaoGrupo(chatJid, 'antilink', newStatusString);

        if (newStatus) {
            return `✅ *Anti-Link ativado!* 🚫\n\nO bot agora removerá automaticamente usuários que enviarem links neste grupo.\n\nPara desativar, use: ${prefixo}antilink (ou ${prefixo}link)`;
        } else {
            return `❌ *Anti-Link desativado!* ✅\n\nO bot não removerá mais usuários por enviar links.\n\nPara reativar, use: ${prefixo}antilink (ou ${prefixo}link)`;
        }

    } catch (error) {
        console.error('[Comando Anti-Link] Erro:', error);
        return '❌ Ocorreu um erro ao tentar configurar o anti-link. Verifique se o bot tem permissões no grupo.';
    }
}

module.exports = {
    name: 'antilink',
    description: 'Ativa/desativa o anti-link para remover usuários que enviam links de outros grupos (apenas administradores).',
    category: 'adm',
    permission: 'admin', // Permissão básica, mas verificamos admin do grupo internamente
    execute: executeAntiLink,
    aliases: ['anti-link', 'antlink', 'link']
};
