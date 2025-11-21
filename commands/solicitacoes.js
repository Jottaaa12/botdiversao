module.exports = {
    name: 'solicitacoes',
    description: 'Lista as solicitações de entrada pendentes para o grupo.',
    category: 'adm',
    aliases: ['pedidos', 'requests'],
    permission: 'admin',
    async execute({ sock, chatJid }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            const requests = await sock.groupRequestParticipantsList(chatJid);

            if (!requests || requests.length === 0) {
                return '✅ Nenhuma solicitação de entrada pendente no momento.';
            }

            let responseText = `*📬 Solicitações de Entrada Pendentes (${requests.length})*\n\n`;
            
            for (const request of requests) {
                const userId = request.jid.split('@')[0];
                responseText += `▪️ *@${userId}*\n`;
            }

            responseText += '\nPara aprovar, use `!aprovar @usuario` ou `!aprovargeral`.';

            await sock.sendMessage(chatJid, { 
                text: responseText,
                mentions: requests.map(r => r.jid)
            });

        } catch (error) {
            console.error('[Solicitacoes Error]', error);
            return 'Ocorreu um erro ao buscar as solicitações. Verifique se o recurso de "Aprovar novos membros" está ativo e se eu sou administrador.';
        }

        return; // Retorna pois a mensagem já foi enviada
    },
};
