module.exports = {
    name: 'aprovar',
    description: 'Aprova um ou mais membros pendentes do grupo. (!aprovar @membro)',
    category: 'adm',
    aliases: ['approve'],
    permission: 'admin',
    async execute({ sock, msg, chatJid, args }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentionedJids.length === 0) {
            return 'Você precisa marcar o(s) usuário(s) que deseja aprovar. Ex: `!aprovar @usuario1 @usuario2`';
        }

        try {
            const result = await sock.groupRequestParticipantsUpdate(chatJid, mentionedJids, 'approve');
            
            // O resultado pode variar dependendo da versão da lib, 
            // mas geralmente contém os JIDs que foram processados.
            if (result && result.length > 0) {
                const approvedUsers = result.map(u => `@${u.jid.split('@')[0]}`).join(', ');
                const responseText = `✅ Usuário(s) aprovado(s) com sucesso: ${approvedUsers}`;
                
                await sock.sendMessage(chatJid, {
                    text: responseText,
                    mentions: result.map(u => u.jid)
                });

            } else {
                 return 'Não foi possível aprovar os usuários. Verifique se eles realmente solicitaram a entrada.';
            }

        } catch (error) {
            console.error('[Aprovar Error]', error);
            return 'Ocorreu um erro ao aprovar os membros. Verifique minhas permissões e se os usuários marcados estão corretos.';
        }
        
        return; // Retorna pois a mensagem já foi enviada
    },
};
