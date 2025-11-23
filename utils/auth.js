const db = require('../database');
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

        // Compara com o dono (env var)
        const ownerNumber = process.env.OWNER_NUMBER;
        if (ownerNumber && phoneNumber === ownerNumber) {
            return 'owner';
        }

        // Verifica role no banco de dados
        const user = db.user.obterUsuario(normalizedJid);
        if (user && (user.role === 'admin' || user.role === 'owner')) {
            return user.role;
        }

        return 'user';
    } catch (e) {
        // Se a normalização falhar mesmo após a tentativa de resolução, trata como 'user'.
        console.warn(`[Auth] Não foi possível normalizar o JID "${checkJid}". Tratando como 'user'.`);
        return 'user';
    }
}

module.exports = { getPermissionLevel };
