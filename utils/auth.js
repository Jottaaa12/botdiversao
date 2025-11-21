const config = require('../config.json');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// A função agora é ASYNC para poder resolver LIDs
async function getPermissionLevel(sock, jid) {
    if (!jid) {
        return 'user';
    }

    let checkJid = jid;

    // Se o JID for um LID, tenta encontrar o JID de número de telefone (PN) correspondente
    if (jid.endsWith('@lid')) {
        try {
            // Usa o mapeamento interno do Baileys para converter LID em PN
            const pnJid = await sock.signalRepository.lidMapping.getPNForLID(jid);
            if (pnJid) {
                console.log(`[Auth] LID ${jid} resolvido para PN ${pnJid}`);
                checkJid = pnJid;
            } else {
                console.log(`[Auth] LID ${jid} não pôde ser resolvido para um PN.`);
            }
        } catch (e) {
            console.error(`[Auth] Erro ao tentar resolver LID ${jid}:`, e);
        }
    }

    try {
        // Normaliza o JID (seja o original ou o PN resolvido)
        const normalizedJid = jidNormalizedUser(checkJid);
        const phoneNumber = normalizedJid.split('@')[0];

        // Compara com o dono e a lista de administradores do config.json
        if (config.owner && phoneNumber === config.owner) {
            return 'owner';
        } else if (config.admins && config.admins.includes(phoneNumber)) {
            return 'admin';
        } else {
            return 'user';
        }
    } catch (e) {
        // Se a normalização falhar mesmo após a tentativa de resolução, trata como 'user'.
        console.warn(`[Auth] Não foi possível normalizar o JID "${checkJid}". Tratando como 'user'.`);
        return 'user';
    }
}

module.exports = { getPermissionLevel };
