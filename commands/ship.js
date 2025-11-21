module.exports = {
    name: 'ship',
    category: 'diversao',
    description: 'Calcula a compatibilidade entre dois usuários',
    permission: 'user',
    async execute({ sock, chatJid, msg, db }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

        if (!mentionedJid || mentionedJid.length < 2) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você precisa marcar duas pessoas para calcular o ship!\n\nUso: !ship @pessoa1 @pessoa2'
            });
            return;
        }

        const pessoa1 = mentionedJid[0];
        const pessoa2 = mentionedJid[1];

        // Gerar porcentagem baseada nos IDs (para ser consistente)
        const hash = (pessoa1 + pessoa2).split('').reduce((acc, char) => {
            return acc + char.charCodeAt(0);
        }, 0);
        const porcentagem = (hash % 101); // 0-100

        const numero1 = pessoa1.split(':')[0].replace('@s.whatsapp.net', '');
        const numero2 = pessoa2.split(':')[0].replace('@s.whatsapp.net', '');

        // Barra de progresso
        const barraCheia = Math.floor(porcentagem / 10);
        const barraVazia = 10 - barraCheia;
        const barra = '█'.repeat(barraCheia) + '░'.repeat(barraVazia);

        // Frases baseadas na porcentagem
        let frase = '';
        if (porcentagem >= 90) {
            frase = 'Casal perfeito! 💕 Vocês nasceram um para o outro!';
        } else if (porcentagem >= 70) {
            frase = 'Ótima compatibilidade! ❤️ Tem tudo para dar certo!';
        } else if (porcentagem >= 50) {
            frase = 'Compatibilidade média. 💛 Pode funcionar com esforço!';
        } else if (porcentagem >= 30) {
            frase = 'Compatibilidade baixa. 🧡 Vai precisar de muito trabalho!';
        } else {
            frase = 'Incompatíveis! 💔 Melhor serem amigos...';
        }

        // Emoji de coração baseado na porcentagem
        let coracao = '❤️';
        if (porcentagem < 30) coracao = '💔';
        else if (porcentagem < 50) coracao = '🧡';
        else if (porcentagem < 70) coracao = '💛';
        else if (porcentagem < 90) coracao = '💚';
        else coracao = '💕';

        const mensagem = `${coracao} *SHIPÔMETRO* ${coracao}\n\n` +
            `👤 @${numero1}\n` +
            `${coracao} @${numero2}\n\n` +
            `📊 Compatibilidade: ${porcentagem}%\n` +
            `[${barra}]\n\n` +
            `${frase}`;

        await sock.sendMessage(chatJid, {
            text: mensagem,
            mentions: [pessoa1, pessoa2]
        });
    }
};
