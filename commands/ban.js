const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'ban',
    description: 'Remove um usuário do grupo e o bane do sistema.',
    aliases: ['kick', 'remover'],
    category: 'adm',
    permission: 'admin', // Apenas admins do bot podem usar

    async execute({ sock, msg, chatJid, senderJid, db, permissionLevel }) {
        if (!chatJid.endsWith('@g.us')) {
            return 'Este comando só pode ser usado em grupos.';
        }

        // 1. Identificar o alvo por menção ou resposta
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const repliedToJid = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.senderJid;
        const targetJid = mentionedJid || repliedToJid;

        if (!targetJid) {
            return 'Você precisa marcar um usuário ou responder a uma mensagem dele para banir.';
        }

        if (targetJid === senderJid) {
            return 'Você não pode banir a si mesmo.';
        }

        // 2. Obter metadados e fazer verificações de permissão
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatJid);
        } catch (e) {
            return 'Ocorreu um erro ao verificar as informações deste grupo.';
        }

        // Verificar se quem envia é admin do grupo OU admin do bot
        const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
        const isBotAdmin = permissionLevel === 'admin' || permissionLevel === 'owner';

        if (!senderParticipant?.admin && !isBotAdmin) {
            return '❌ Apenas administradores do grupo podem usar este comando.';
        }

        // Verificar se o alvo não é o dono do grupo
        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (targetParticipant?.admin === 'superadmin') {
            return '❌ Não é possível banir o dono do grupo.';
        }

        // Verificar se o alvo não é admin do grupo
        if (targetParticipant?.admin === 'admin') {
            return '❌ Para remover outro administrador, você precisa primeiro rebaixá-lo manualmente.';
        }

        // Verificar se o bot é admin (com a lógica correta para LIDs)
        const botPnJid = jidNormalizedUser(sock.user.id);
        let botIsAdmin = false;
        for (const p of groupMetadata.participants) {
            if (p.admin) { // 'admin' ou 'superadmin'
                let adminId = p.id;
                if (adminId.endsWith('@lid')) {
                    try {
                        const resolved = await sock.signalRepository.lidMapping.getPNForLID(adminId);
                        if (resolved) adminId = resolved;
                    } catch (e) { /* Ignora erros de resolução */ }
                }
                if (jidNormalizedUser(adminId) === botPnJid) {
                    botIsAdmin = true;
                    break;
                }
            }
        }
        if (!botIsAdmin) {
            return '❌ Eu preciso ser um administrador neste grupo para poder remover membros.';
        }

        // 3. Executar remoção e banimento do sistema
        try {
            // Primeiro remove do grupo
            await sock.groupParticipantsUpdate(chatJid, [targetJid], 'remove');

            // Depois bane do sistema (impede de usar comandos no futuro)
            db.user.banUser(targetJid);

            await sock.sendMessage(chatJid, {
                text: `✅ Usuário @${targetJid.split('@')[0]} foi removido do grupo e banido do sistema.`,
                mentions: [targetJid]
            });
            return null; // Sucesso

        } catch (error) {
            console.error('[Comando Ban] Erro ao remover usuário:', error);
            return '❌ Ocorreu um erro ao tentar remover o usuário. Ele pode já ter saído do grupo.';
        }
    }
};