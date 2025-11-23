module.exports = {
    name: 'aceitar',
    category: 'diversao',
    description: 'Aceita um pedido de casamento',
    permission: 'user',
    async execute({ sock, chatJid, msg, db }) {
        const { pedidosCasamento } = require('../handlers/messageHandler');
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // Verificar se há um pedido pendente para este usuário
        if (!pedidosCasamento.has(senderJid)) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você não tem nenhum pedido de casamento pendente!'
            });
            return;
        }

        const pedido = pedidosCasamento.get(senderJid);
        const solicitante = pedido.solicitante;

        // Verificar se o pedido expirou (5 minutos)
        if (Date.now() - pedido.timestamp > 5 * 60 * 1000) {
            pedidosCasamento.delete(senderJid);
            await sock.sendMessage(chatJid, {
                text: '❌ O pedido de casamento expirou! Peça para a pessoa enviar novamente.'
            });
            return;
        }

        // Verificar novamente se ambos ainda não estão casados
        const conjugeSolicitante = db.groupInteraction.obterConjuge(solicitante);
        const conjugeReceptor = db.groupInteraction.obterConjuge(senderJid);

        if (conjugeSolicitante || conjugeReceptor) {
            pedidosCasamento.delete(senderJid);
            await sock.sendMessage(chatJid, {
                text: '❌ Uma das pessoas já está casada! O pedido foi cancelado.'
            });
            return;
        }

        // Realizar o casamento
        try {
            db.casarUsuarios(solicitante, senderJid);
            pedidosCasamento.delete(senderJid);

            const numeroSolicitante = solicitante.split(':')[0].replace('@s.whatsapp.net', '');
            const numeroReceptor = senderJid.split(':')[0].replace('@s.whatsapp.net', '');
            const dataAtual = new Date().toLocaleDateString('pt-BR');

            const mensagem = `💒 *CERTIDÃO DE CASAMENTO* 💒\n\n` +
                `👰 @${numeroSolicitante}\n` +
                `🤵 @${numeroReceptor}\n\n` +
                `📅 Data: ${dataAtual}\n` +
                `❤️ Nível de amor: 100%\n\n` +
                `_Que sejam felizes para sempre!_ 🎉💕`;

            await sock.sendMessage(chatJid, {
                text: mensagem,
                mentions: [solicitante, senderJid]
            });
        } catch (error) {
            console.error('[Comando Aceitar] Erro ao casar usuários:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Erro ao realizar o casamento. Tente novamente.'
            });
        }
    }
};
