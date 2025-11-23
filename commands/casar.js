module.exports = {
    name: 'casar',
    category: 'diversao',
    description: 'Envia um pedido de casamento para outro usuário',
    permission: 'user',
    async execute({ sock, chatJid, msg, db }) {
        const { pedidosCasamento } = require('../handlers/messageHandler');
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

        if (!mentionedJid || mentionedJid.length === 0) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você precisa marcar alguém para pedir em casamento!\n\nUso: !casar @pessoa'
            });
            return;
        }

        const parceiro = mentionedJid[0];

        // Verificar se está tentando casar consigo mesmo
        if (senderJid === parceiro) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você não pode casar consigo mesmo! 😅'
            });
            return;
        }

        // Verificar se o usuário já está casado
        const conjugeAtual = db.groupInteraction.obterConjuge(senderJid);
        if (conjugeAtual) {
            const numero = conjugeAtual.conjuge.split(':')[0].replace('@s.whatsapp.net', '');
            await sock.sendMessage(chatJid, {
                text: `❌ Você já está casado(a) com @${numero}!\n\nUse !divorcio primeiro se quiser se casar novamente.`,
                mentions: [conjugeAtual.conjuge]
            });
            return;
        }

        // Verificar se o parceiro já está casado
        const conjugeParceiro = db.groupInteraction.obterConjuge(parceiro);
        if (conjugeParceiro) {
            const numero = conjugeParceiro.conjuge.split(':')[0].replace('@s.whatsapp.net', '');
            const numeroParceiro = parceiro.split(':')[0].replace('@s.whatsapp.net', '');
            await sock.sendMessage(chatJid, {
                text: `❌ @${numeroParceiro} já está casado(a) com @${numero}!`,
                mentions: [parceiro, conjugeParceiro.conjuge]
            });
            return;
        }

        // Verificar se já existe um pedido pendente
        if (pedidosCasamento.has(parceiro)) {
            const pedidoExistente = pedidosCasamento.get(parceiro);
            if (pedidoExistente.solicitante === senderJid) {
                await sock.sendMessage(chatJid, {
                    text: '⏳ Você já enviou um pedido de casamento para esta pessoa. Aguarde a resposta!'
                });
                return;
            }
        }

        // Criar pedido de casamento pendente
        pedidosCasamento.set(parceiro, {
            solicitante: senderJid,
            chatJid: chatJid,
            timestamp: Date.now()
        });

        // Limpar pedidos antigos (mais de 5 minutos)
        const cincoMinutosAtras = Date.now() - (5 * 60 * 1000);
        for (const [usuario, pedido] of pedidosCasamento.entries()) {
            if (pedido.timestamp < cincoMinutosAtras) {
                pedidosCasamento.delete(usuario);
            }
        }

        const numeroSender = senderJid.split(':')[0].replace('@s.whatsapp.net', '');
        const numeroParceiro = parceiro.split(':')[0].replace('@s.whatsapp.net', '');

        const mensagem = `💍 *PEDIDO DE CASAMENTO* 💍\n\n` +
            `@${numeroSender} está pedindo @${numeroParceiro} em casamento! 💕\n\n` +
            `@${numeroParceiro}, você aceita?\n\n` +
            `Use *!aceitar* para aceitar ou *!recusar* para recusar.\n` +
            `_Você tem 5 minutos para responder._`;

        await sock.sendMessage(chatJid, {
            text: mensagem,
            mentions: [senderJid, parceiro]
        });
    }
};
