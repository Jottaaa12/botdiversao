module.exports = {
    name: 'divorcio',
    aliases: ['divórcio'],
    category: 'diversao',
    description: 'Divorcia do seu cônjuge atual',
    permission: 'user',
    async execute({ sock, chatJid, msg, db }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // Verificar se o usuário está casado
        const conjugeAtual = db.obterConjuge(senderJid);
        if (!conjugeAtual) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você não está casado(a)!'
            });
            return;
        }

        // Realizar o divórcio
        try {
            db.divorciarUsuarios(senderJid, conjugeAtual.conjuge);

            const numeroSender = senderJid.split(':')[0].replace('@s.whatsapp.net', '');
            const numeroConjuge = conjugeAtual.conjuge.split(':')[0].replace('@s.whatsapp.net', '');
            const dataAtual = new Date().toLocaleDateString('pt-BR');

            const mensagem = `💔 *DIVÓRCIO REALIZADO* 💔\n\n` +
                `👤 @${numeroSender}\n` +
                `💔 @${numeroConjuge}\n\n` +
                `📅 Data: ${dataAtual}\n\n` +
                `_O casamento foi desfeito._ 😢`;

            await sock.sendMessage(chatJid, {
                text: mensagem,
                mentions: [senderJid, conjugeAtual.conjuge]
            });
        } catch (error) {
            console.error('[Comando Divorcio] Erro ao divorciar usuários:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Erro ao realizar o divórcio. Tente novamente.'
            });
        }
    }
};
