module.exports = {
    name: 'recusar',
    aliases: ['negar'],
    category: 'diversao',
    description: 'Recusa um pedido de casamento',
    permission: 'user',
    async execute({ sock, chatJid, msg }) {
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

        // Remover o pedido
        pedidosCasamento.delete(senderJid);

        const numeroSolicitante = solicitante.split(':')[0].replace('@s.whatsapp.net', '');
        const numeroReceptor = senderJid.split(':')[0].replace('@s.whatsapp.net', '');

        const mensagem = `💔 *PEDIDO RECUSADO* 💔\n\n` +
            `@${numeroReceptor} recusou o pedido de casamento de @${numeroSolicitante}.\n\n` +
            `_Mais sorte na próxima!_ 😢`;

        await sock.sendMessage(chatJid, {
            text: mensagem,
            mentions: [solicitante, senderJid]
        });
    }
};
