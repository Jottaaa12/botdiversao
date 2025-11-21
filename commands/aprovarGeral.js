module.exports = {
    name: 'aprovargeral',
    description: 'Aprova todas as solicitações de entrada pendentes do grupo.',
    category: 'adm',
    aliases: ['aprovar-todos', 'approveall'],
    permission: 'admin',
    async execute({ sock, chatJid }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            const requests = await sock.groupRequestParticipantsList(chatJid);

            if (!requests || requests.length === 0) {
                return '✅ Nenhuma solicitação de entrada para aprovar.';
            }

            const jidsToApprove = requests.map(r => r.jid);

            const result = await sock.groupRequestParticipantsUpdate(chatJid, jidsToApprove, 'approve');

            if (result && result.length > 0) {
                 const responseText = `✅ *${result.length}* usuário(s) foram aprovados e adicionados ao grupo.`;
                 await sock.sendMessage(chatJid, { text: responseText });
            } else {
                return 'Não foi possível aprovar as solicitações. Tente novamente mais tarde.';
            }

        } catch (error) {
            console.error('[AprovarGeral Error]', error);
            return 'Ocorreu um erro ao aprovar todas as solicitações. Verifique minhas permissões de admin.';
        }

        return; // Retorna pois a mensagem já foi enviada
    },
};
