const { getPermissionLevel } = require('../utils/auth');

module.exports = {
    name: 'help',
    aliases: ['ajuda', 'comandos'],
    description: 'Mostra a lista de comandos disponíveis.',
    category: 'utilitario',
    permission: 'user',
    async execute({ sock, chatJid, senderJid, permissionLevel, commands, prefixo }) {
        const isAdmin = permissionLevel === 'admin' || permissionLevel === 'owner';
        const targetJid = isAdmin ? senderJid : chatJid;

        const categorizedCommands = {};
        const addedCommands = new Set();

        for (const command of commands.values()) {
            // Evitar duplicatas por aliases e comandos sem categoria/descrição
            if (command.name && !addedCommands.has(command.name) && command.category && command.description) {
                if (!categorizedCommands[command.category]) {
                    categorizedCommands[command.category] = [];
                }
                categorizedCommands[command.category].push(command);
                addedCommands.add(command.name);
            }
        }

        let helpMessage = `🤖 *MENU DE COMANDOS* 🤖\n\n`;
        helpMessage += `Aqui estão os comandos que você pode usar:\n`;

        if (isAdmin) {
            helpMessage += `\n*Obs: Como você é um administrador, esta lista foi enviada no seu privado.*\n`;

            // Admins veem todas as categorias
            for (const category in categorizedCommands) {
                helpMessage += `\n╭─「 *${category.toUpperCase()}* 」\n`;
                categorizedCommands[category].forEach(cmd => {
                    helpMessage += `│ • *${prefixo}${cmd.name}*\n│    ↳ ${cmd.description}\n`;
                });
                helpMessage += `╰─⬣\n`;
            }
        } else {
            // Membros comuns veem todas as categorias, exceto 'adm'
            let publicCommandsFound = false;
            for (const category in categorizedCommands) {
                if (category.toLowerCase() !== 'adm') {
                    publicCommandsFound = true;
                    helpMessage += `\n╭─「 *${category.toUpperCase()}* 」\n`;
                    categorizedCommands[category].forEach(cmd => {
                        helpMessage += `│ • *${prefixo}${cmd.name}*\n│    ↳ ${cmd.description}\n`;
                    });
                    helpMessage += `╰─⬣\n`;
                }
            }

            if (!publicCommandsFound) {
                helpMessage += '\nNenhum comando público disponível no momento.';
            }
        }
        
        helpMessage += `\nUse *${prefixo}comando --help* para ver mais detalhes sobre um comando específico.`;

        try {
            await sock.sendMessage(targetJid, { text: helpMessage });
            
            // Se a mensagem foi para o PV do admin, notificar no grupo.
            if (isAdmin && chatJid !== targetJid) {
                await sock.sendMessage(chatJid, { text: `✅ Olá, *@${senderJid.split('@')[0]}*! Enviei a lista completa de comandos no seu privado.`, mentions: [senderJid] });
            }
        } catch (error) {
            console.error("Erro ao enviar mensagem de ajuda:", error);
            // Fallback para o chat do grupo em caso de erro no PV
            await sock.sendMessage(chatJid, { text: 'Ocorreu um erro ao tentar te enviar a lista de comandos.' });
        }
    },
};