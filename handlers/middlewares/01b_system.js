const { getPermissionLevel } = require('../../utils/auth');

module.exports = async (context, next) => {
    const { message, prefixo, commands, sock, chatJid, senderJid, restartBot } = context;

    if (message && message.toLowerCase().startsWith(prefixo + 'reiniciar')) {
        console.log('[Handler] Comando de reinicialização detectado.');
        const command = commands.get('reiniciar');
        if (command) {
            const userPermissionLevel = await getPermissionLevel(sock, senderJid);
            const requiredPermission = command.permission || 'user';
            const permissionHierarchy = { 'user': 0, 'admin': 1, 'owner': 2 };

            if (permissionHierarchy[userPermissionLevel] >= permissionHierarchy[requiredPermission]) {
                try {
                    await sock.sendMessage(chatJid, { text: '✅ Comando recebido. O bot será reiniciado...' });
                    restartBot();
                } catch (e) {
                    console.error('[Handler] Falha ao enviar confirmação de reinício.', e);
                    restartBot();
                }
                return; // Interrompe pipeline
            } else {
                await sock.sendMessage(chatJid, { text: '❌ Você não tem permissão para usar este comando.' });
                return; // Interrompe pipeline
            }
        }
    }

    await next();
};
