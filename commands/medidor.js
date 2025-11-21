module.exports = {
    name: 'medidor',
    aliases: ['gay', 'feio', 'gado', 'sorte', 'gostoso', 'bonito', 'inteligente', 'burro'],
    category: 'diversao',
    description: 'Mede uma característica aleatória do usuário',
    permission: 'user',
    async execute({ sock, chatJid, msg, commandName, db }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

        // Se mencionou alguém, usa a pessoa mencionada, senão usa quem enviou
        const alvo = (mentionedJid && mentionedJid.length > 0) ? mentionedJid[0] : senderJid;
        const numero = alvo.replace('@s.whatsapp.net', '');

        // Gerar porcentagem baseada no ID e no tipo de medidor (para ser consistente)
        const hash = (alvo + commandName).split('').reduce((acc, char) => {
            return acc + char.charCodeAt(0);
        }, 0);
        const porcentagem = (hash % 101); // 0-100

        // Barra de progresso
        const barraCheia = Math.floor(porcentagem / 10);
        const barraVazia = 10 - barraCheia;
        const barra = '█'.repeat(barraCheia) + '░'.repeat(barraVazia);

        // Definir emoji e texto baseado no comando
        let emoji = '📊';
        let titulo = 'MEDIDOR';
        let caracteristica = commandName.toUpperCase();

        switch (commandName.toLowerCase()) {
            case 'gay':
                emoji = '🏳️‍🌈';
                titulo = 'GAYÔMETRO';
                break;
            case 'feio':
                emoji = '😬';
                titulo = 'FEIÔMETRO';
                break;
            case 'gado':
                emoji = '🐮';
                titulo = 'GADÔMETRO';
                break;
            case 'sorte':
                emoji = '🍀';
                titulo = 'SORTÔMETRO';
                caracteristica = 'SORTE';
                break;
            case 'gostoso':
                emoji = '🔥';
                titulo = 'GOSTOSÔMETRO';
                break;
            case 'bonito':
                emoji = '😍';
                titulo = 'BELEZÔMETRO';
                caracteristica = 'BELEZA';
                break;
            case 'inteligente':
                emoji = '🧠';
                titulo = 'INTELIGENCIÔMETRO';
                caracteristica = 'INTELIGÊNCIA';
                break;
            case 'burro':
                emoji = '🤪';
                titulo = 'BURRICÔMETRO';
                caracteristica = 'BURRICE';
                break;
        }

        const mensagem = `${emoji} *${titulo}* ${emoji}\n\n` +
            `👤 @${numero}\n\n` +
            `📊 Nível de ${caracteristica}: ${porcentagem}%\n` +
            `[${barra}]`;

        await sock.sendMessage(chatJid, {
            text: mensagem,
            mentions: [alvo]
        });
    }
};
