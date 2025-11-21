const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'revelar',
    description: 'Reenvia uma mídia de visualização única no privado. Use respondendo à mídia.',
    category: 'adm',
    permission: 'owner',
    async execute({ sock, msg, chatJid, senderJid }) {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = contextInfo?.quotedMessage;

        if (!quotedMsg) {
            return 'Você precisa responder a uma mídia de visualização única para usar este comando.';
        }

        // Tenta encontrar o conteúdo da mensagem de visualização única (v1 ou v2)
        const viewOnceMsgContent = quotedMsg.viewOnceMessage?.message || quotedMsg.viewOnceMessageV2?.message;

        if (!viewOnceMsgContent) {
            return 'A mensagem respondida não é uma mídia de visualização única (ou o conteúdo já expirou).';
        }

        try {
            // Identifica o tipo de mídia
            const mediaType = Object.keys(viewOnceMsgContent)[0]; // 'imageMessage' ou 'videoMessage'
            const actualMediaMessage = viewOnceMsgContent[mediaType]; // Objeto da mensagem de mídia (imageMessage ou videoMessage)

            if (mediaType !== 'imageMessage' && mediaType !== 'videoMessage') {
                return 'Este tipo de mídia de visualização única não é suportado.';
            }

            await sock.sendMessage(chatJid, { text: '🤫 Revelando a mídia, um momento...' });

            // Reconstrói o objeto da mensagem citada para passar ao downloader
            const messageToDownload = {
                key: {
                    remoteJid: chatJid,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: quotedMsg
            };
            
            const buffer = await downloadMediaMessage(
                messageToDownload,
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            // Extrai a legenda, se existir, e adiciona um prefixo
            const originalCaption = actualMediaMessage.caption ? actualMediaMessage.caption.toString() : '';
            const finalCaption = `👀 Mídia de visualização única revelada com sucesso.\n\n`
                               + (originalCaption ? `*Texto original:*\n${originalCaption}` : '');

            const mediaContent = {
                caption: finalCaption.trim() // Remove espaços extras se não houver legenda original
            };

            if (mediaType === 'imageMessage') {
                mediaContent.image = buffer;
            } else { // videoMessage
                mediaContent.video = buffer;
            }

            await sock.sendMessage(senderJid, mediaContent);
            
            return '✅ A mídia foi enviada no seu privado.';

        } catch (error) {
            console.error('[Revelar Error]', error);
            return 'Ocorreu um erro ao tentar revelar a mídia. O conteúdo pode ter expirado ou não ser mais acessível.';
        }
    },
};
