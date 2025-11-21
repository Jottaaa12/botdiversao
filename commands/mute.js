const db = require('../database');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'mute',
    description: 'Silencia um usuário no grupo. Se nenhuma duração for fornecida, o silêncio é permanente.',
    usage: '!mute @usuário [tempo]',
    async execute(context) {
        const { sock, msg, args } = context;
        const chat = msg.key.remoteJid;
        const from = msg.key.participant;

        // Verifica se o comando foi enviado em um grupo
        if (!chat.endsWith('@g.us')) {
            await sock.sendMessage(chat, { text: 'Este comando só pode ser usado em grupos.' }, { quoted: msg });
            return;
        }

        // Obtém metadados do grupo
        const groupMetadata = await sock.groupMetadata(chat);
        const participants = groupMetadata.participants;

        // Verifica se o remetente é um admin do grupo
        const senderParticipant = participants.find(p => p.id === from);
        if (!senderParticipant?.admin) {
            await sock.sendMessage(chat, { text: 'Você precisa ser um administrador do grupo para usar este comando.' }, { quoted: msg });
            return;
        }

        // Verifica se o bot é um admin do grupo (lógica do ban.js)
        const botPnJid = jidNormalizedUser(sock.user.id);
        let botIsAdmin = false;
        for (const p of participants) {
            if (p.admin) { // 'admin' ou 'superadmin'
                let adminId = p.id;
                if (adminId.endsWith('@lid')) {
                    try {
                        const resolved = await sock.signalRepository.lidMapping.getPNForLID(adminId);
                        if (resolved) adminId = resolved;
                    } catch (e) { /* Ignora erros de resolução */ }
                }
                if (jidNormalizedUser(adminId) === botPnJid) {
                    botIsAdmin = true;
                    break;
                }
            }
        }
        if (!botIsAdmin) {
            await sock.sendMessage(chat, { text: 'Eu preciso ser um administrador neste grupo para poder silenciar membros.' }, { quoted: msg });
            return;
        }


        // Obtém o usuário alvo das menções ou argumentos
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
            await sock.sendMessage(chat, { text: 'Por favor, marque o usuário, responda a uma mensagem dele ou forneça o número que deseja silenciar.' }, { quoted: msg });
            return;
        }
        
        // Impede de silenciar a si mesmo ou outros administradores
        const targetParticipant = participants.find(p => p.id === targetJid);
        if (targetJid === from) {
            await sock.sendMessage(chat, { text: 'Você não pode silenciar a si mesmo.' }, { quoted: msg });
            return;
        }
        if (targetParticipant?.admin) {
             await sock.sendMessage(chat, { text: 'Você não pode silenciar outro administrador.' }, { quoted: msg });
            return;
        }

        let duration = null; // em minutos
        let durationString = 'permanentemente';
        let expirationTime = null;

        if (args[1]) { // Se um segundo argumento foi fornecido, ele é a duração
            const timeValue = parseInt(args[1]);
            if (!isNaN(timeValue) && timeValue > 0) {
                if (args[1].toLowerCase().endsWith('m')) {
                    duration = timeValue; // minutos
                    durationString = `${timeValue} minuto(s)`;
                } else if (args[1].toLowerCase().endsWith('h')) {
                    duration = timeValue * 60; // horas para minutos
                    durationString = `${timeValue} hora(s)`;
                } else {
                    await sock.sendMessage(chat, { text: 'Formato de tempo inválido. Use "m" para minutos ou "h" para horas (ex: !mute @usuário 5m).' }, { quoted: msg });
                    return;
                }
                expirationTime = new Date(Date.now() + duration * 60 * 1000).toISOString();
            } else {
                await sock.sendMessage(chat, { text: 'Duração inválida. Por favor, forneça um número positivo seguido de "m" ou "h" (ex: !mute @usuário 5m).' }, { quoted: msg });
                return;
            }
        }
        // Se args[1] não foi fornecido, duration e expirationTime permanecem null, resultando em mute permanente.

        try {
            await db.muteUser(targetJid, chat, expirationTime);
            await sock.sendMessage(chat, { text: `Usuário @${targetJid.split('@')[0]} foi silenciado ${durationString}.`, mentions: [targetJid] }, { quoted: msg });
        } catch (error) {
            console.error('Erro ao silenciar usuário:', error);
            await sock.sendMessage(chat, { text: 'Ocorreu um erro ao silenciar o usuário.' }, { quoted: msg });
        }
    }
};
