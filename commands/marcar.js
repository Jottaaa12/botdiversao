/**
 * Comando para marcar todos os membros do grupo de forma invisível.
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
 * @returns {string|null} Uma mensagem de erro ou null se sucesso.
 */
async function executeHidetag({ sock, msg, message, args, commandName, prefixo, usuario, permissionLevel, db }) {
    const senderJid = msg.key.senderPn || msg.key.participant || msg.key.remoteJid;
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

        // Verificar se o usuário é admin do grupo OU dono do bot
        const isOwner = permissionLevel === 'owner';
        if (!admins.includes(senderJid) && !isOwner) {
            return '❌ Apenas administradores do grupo podem usar este comando.';
        }

        // Obter lista de membros (excluindo o bot)
        const members = participants.filter(p => !p.id.includes('status@broadcast') && p.id !== sock.user.id);

        if (members.length === 0) {
            return '❌ Não há membros para marcar neste grupo.';
        }

        // Criar menção para todos os membros
        const mentions = members.map(member => member.id);

        // Texto da mensagem
        let text = args.length > 0 ? args.join(' ') : '';

        // Verificar se há mensagem citada
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
            if (quotedText) {
                text = quotedText + (text ? '\n\n' + text : '');
            }
        }

        if (!text) {
            text = '\u200b';
        }

        // Enviar mensagem marcando todos de forma invisível
        await sock.sendMessage(chatJid, {
            text: text,
            mentions: mentions
        });

        // Não retornar mensagem de confirmação
        return null;

    } catch (error) {
        console.error('[Comando Hidetag] Erro:', error);
        return '❌ Ocorreu um erro ao tentar marcar os membros. Verifique se o bot tem permissões no grupo.';
    }
}

module.exports = {
    name: 'hidetag',
    description: 'Marca todos os membros do grupo de forma invisível (apenas administradores).',
    category: 'adm',
    permission: 'admin', // Permissão básica, mas verificamos admin do grupo internamente
    aliases: ['h', 'mrc'],
    execute: executeHidetag,
};
