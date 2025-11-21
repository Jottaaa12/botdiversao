const db = require('../database');

async function executeJoinCommand({ sock, msg, args, joinInProgress }) {
    const senderJid = msg.key.senderPn || msg.key.participant || msg.key.remoteJid;
    const inviteLink = args[0];

    // Verificar se foi fornecido um link de convite
    if (!inviteLink) {
        return 'Por favor, forneça um link de convite do grupo. Ex: /join https://chat.whatsapp.com/XXXXX';
    }

    // Verificar se o link é válido
    const whatsappGroupLinkRegex = /https?:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+/;
    if (!whatsappGroupLinkRegex.test(inviteLink)) {
        return 'Link de convite inválido. Use um link no formato: https://chat.whatsapp.com/XXXXX';
    }

    try {
        // Extrai o código do link, removendo também os parâmetros de URL (ex: ?mode=...)
        const codeWithParams = inviteLink.split('/').pop();
        const inviteCode = codeWithParams.split('?')[0];

        const groupJid = await sock.groupAcceptInvite(inviteCode);

        // Define a flag para que o groupHandler saiba que o bot entrou programaticamente
        joinInProgress.set(groupJid, true);

        console.log(`[Comando Join] Bot entrou no grupo ${groupJid} através do convite de ${senderJid}`);

        // Tentar atualizar a lista de chats para reconhecer o novo grupo
        try {
            await sock.store?.fetchChats();
        } catch (fetchError) {
            console.log('[Comando Join] Não foi possível atualizar lista de chats:', fetchError.message);
        }

        return `✅ Bot entrou no grupo com sucesso!\n\n📍 *Grupo:* ${groupJid}\n\n⚠️ *Importante:* Reinicie o bot para garantir que as mensagens do grupo sejam processadas corretamente.`;

    } catch (error) {
        console.error('[Comando Join] Erro ao aceitar convite do grupo:', error);

        if (error.message && error.message.includes('already in group')) {
            return 'O bot já está neste grupo.';
        } else if (error.message && error.message.includes('invalid invite')) {
            return 'Link de convite inválido ou expirado.';
        } else {
            return '❌ Erro ao tentar entrar no grupo. Verifique se o link é válido e tente novamente.';
        }
    }
}

module.exports = {
    name: 'join',
    description: 'Permite que o bot entre em um grupo através de um link de convite.',
    category: 'adm',
    permission: 'admin', // Apenas admins podem usar
    aliases: ['entrar', 'g'],
    execute: executeJoinCommand,
};
