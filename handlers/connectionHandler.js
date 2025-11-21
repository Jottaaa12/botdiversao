const qrcode = require('qrcode-terminal');
const { DisconnectReason } = require('@whiskeysockets/baileys');
const { salvarConfiguracao } = require('../database');

async function handleConnectionUpdate(sock, update, connectToWhatsApp) {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
        console.log('QR Code gerado. Escaneie com o WhatsApp:');
        qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Conexão fechada devido a:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
        if (shouldReconnect) {
            connectToWhatsApp();
        }
    } else if (connection === 'open') {
        console.log('Conectado ao WhatsApp!');
        
        // Contar grupos e salvar no banco de dados
        try {
            const groups = await sock.groupFetchAllParticipating();
            const groupCount = Object.keys(groups).length;
            salvarConfiguracao('total_grupos', groupCount.toString());
            console.log(`[Status] Contagem de grupos atualizada: ${groupCount}`);
        } catch (e) {
            console.error('[Status] Erro ao buscar e salvar a contagem de grupos:', e);
        }
    }
}

module.exports = { handleConnectionUpdate };