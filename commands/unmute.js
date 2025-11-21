const db = require('../database');

module.exports = {
    name: 'unmute',
    description: 'Dessilencia um usuário no grupo.',
    usage: '!unmute @usuário',
    async execute(context) {
        const { sock, msg, args } = context;
        const chat = msg.key.remoteJid;
        const from = msg.key.participant;

        // Verifica se o comando foi enviado em um grupo
        if (!chat.endsWith('@g.us')) {
            await sock.sendMessage(chat, { text: 'Este comando só pode ser usado em grupos.' }, { quoted: msg });
            return;
        }

        // Verifica se o remetente é um administrador do grupo
        const groupMetadata = await sock.groupMetadata(chat);
        const participants = groupMetadata.participants;
        const senderParticipant = participants.find(p => p.id === from);
        if (!senderParticipant?.admin) {
            await sock.sendMessage(chat, { text: 'Você precisa ser um administrador do grupo para usar este comando.' }, { quoted: msg });
            return;
        }

        // Obtém o usuário alvo das menções, resposta ou argumento
        const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        const repliedToJid = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.senderJid;
        let targetJid = mentionedJids?.[0] || repliedToJid;

        if (!targetJid && args[0]) {
            const number = args[0].replace(/[^0-9]/g, '');
            if (number) {
                targetJid = number + '@s.whatsapp.net';
            }
        }

        if (!targetJid) {
            await sock.sendMessage(chat, { text: 'Por favor, marque o usuário, responda a uma mensagem dele ou forneça o número que deseja dessilenciar.' }, { quoted: msg });
            return;
        }

        try {
            const isUserMuted = await db.isMuted(targetJid, chat);
            if (!isUserMuted) {
                await sock.sendMessage(chat, { text: `Usuário @${targetJid.split('@')[0]} não está silenciado.`, mentions: [targetJid] }, { quoted: msg });
                return;
            }

            await db.unmuteUser(targetJid, chat);
            await sock.sendMessage(chat, { text: `Usuário @${targetJid.split('@')[0]} foi dessilenciado.`, mentions: [targetJid] }, { quoted: msg });
        } catch (error) {
            console.error('Erro ao dessilenciar usuário:', error);
            await sock.sendMessage(chat, { text: 'Ocorreu um erro ao dessilenciar o usuário.' }, { quoted: msg });
        }
    }
};
