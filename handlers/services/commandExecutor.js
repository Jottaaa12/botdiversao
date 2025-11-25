const { getPermissionLevel } = require('../../utils/auth');

async function execute(command, context) {
    const {
        sock,
        msg,
        chatJid,
        senderJid,
        message,
        args,
        commandName,
        prefixo,
        usuario,
        db,
        isGroup
    } = context;

    // Verificação de Permissão
    const requiredPermission = command.permission || 'user';
    const userPermissionLevel = await getPermissionLevel(sock, senderJid);
    const permissionHierarchy = { 'user': 0, 'admin': 1, 'owner': 2 };

    // --- VERIFICAÇÃO DO MODO SO_ADM ---
    if (isGroup) {
        const modoSoAdm = db.config.obterConfiguracaoGrupo(chatJid, 'modo_so_adm') === 'true';

        if (modoSoAdm &&
            userPermissionLevel !== 'admin' &&
            userPermissionLevel !== 'owner' &&
            command.name !== 'so_adm') {
            console.log(`[Debug] Modo Só Adm ativo e usuário não é admin. Ignorando.`);
            return; // Interrompe o processamento sem enviar mensagem
        }
    }

    if (permissionHierarchy[userPermissionLevel] >= permissionHierarchy[requiredPermission]) {
        let response = '';
        try {
            console.log(`[Debug] Iniciando execução do comando ${commandName}...`);
            await sock.sendPresenceUpdate('composing', chatJid);

            // Adiciona permissionLevel ao contexto se não estiver lá
            context.permissionLevel = userPermissionLevel;
            context.getPermissionLevel = getPermissionLevel;

            // Executa o comando
            response = await command.execute(context);

            console.log(`[Debug] Comando ${commandName} executado.`);

            // Incrementar contador de comandos executados
            if (db && db.config) {
                db.config.incrementarContador('comandos_executados');
            }

            if (response && typeof response === 'string') {
                await sock.sendMessage(chatJid, { text: response });
            }
        } catch (error) {
            console.error(`[Erro ao Executar Comando] '${commandName}':`, error);
            await sock.sendMessage(chatJid, { text: `😕 Ocorreu um erro ao tentar executar o comando \`${commandName}\`.` });
        } finally {
            await sock.sendPresenceUpdate('paused', chatJid);
        }
    } else {
        console.log(`[Debug] Permissão negada para ${senderJid} em ${commandName}`);
        await sock.sendMessage(chatJid, { text: "Você não tem permissão para usar este comando." });
    }
}

module.exports = { execute };
