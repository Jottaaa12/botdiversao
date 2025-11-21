const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'vcard',
    aliases: ['contato', 'card'],
    description: 'Envia o contato de um usuário mencionado.',
    category: 'utilitario',
    permission: 'user',
    async execute({ sock, chatJid, msg, args }) {
        let mentionedJid = null;

        // Tenta obter o JID do usuário mencionado na mensagem
        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            mentionedJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        if (!mentionedJid) {
            return 'Por favor, mencione o usuário cujo contato você deseja enviar. Ex: `/vcard @usuario`';
        }

        let finalJid = mentionedJid;
        // Verifica se o JID é um LID e tenta resolvê-lo para um PN (Phone Number JID)
        if (mentionedJid.endsWith('@lid')) {
            try {
                const resolved = await sock.signalRepository.lidMapping.getPNForLID(mentionedJid);
                if (resolved) {
                    finalJid = resolved;
                    console.log(`[vCard] LID ${mentionedJid} resolvido para PN ${finalJid}`);
                } else {
                    console.warn(`[vCard] Não foi possível resolver o LID: ${mentionedJid}`);
                }
            } catch (error) {
                console.error(`[vCard] Erro ao tentar resolver o LID ${mentionedJid}:`, error);
                return `😕 Ocorreu um erro ao tentar encontrar o contato. O ID do usuário pode ser inválido.`;
            }
        }

        const userNumber = finalJid.split('@')[0];
        let contactName = userNumber; // Usa o número como nome padrão

        try {
            // Tenta obter metadata do grupo para pegar o nome do participante, se for um grupo
            if (chatJid.endsWith('@g.us')) {
                const groupMetadata = await sock.groupMetadata(chatJid);
                // Usa o `mentionedJid` (LID) original para encontrar o participante, pois é o que está no metadado
                const participant = groupMetadata.participants.find(p => jidNormalizedUser(p.id) === jidNormalizedUser(mentionedJid));
                
                // Prioriza o nome salvo no celular do usuário (pushName), depois o nome no perfil do WhatsApp (notify)
                if (participant?.pushName) {
                    contactName = participant.pushName;
                } else if (participant?.notify) {
                    contactName = participant.notify;
                }
            }
        } catch (error) {
            console.error("[vCard] Erro ao tentar obter metadados do grupo:", error);
            // Continua com o número como nome se falhar
        }
        
        // Formato VCard
        const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n'
            + `FN:${contactName}\n` // Full Name
            + `TEL;type=CELL;type=VOICE;waid=${userNumber}:+${userNumber}\n` // WhatsApp ID and phone number
            + 'END:VCARD';

        try {
            await sock.sendMessage(chatJid, {
                contacts: {
                    displayName: contactName,
                    contacts: [{ vcard }]
                }
            });
            return `✅ Cartão de contato para *@${userNumber}* enviado!`;
        } catch (error) {
            console.error("[vCard] Erro ao enviar a mensagem de contato:", error);
            return '😕 Falha ao enviar o cartão de contato. Verifique se o número é válido.';
        }
    }
};