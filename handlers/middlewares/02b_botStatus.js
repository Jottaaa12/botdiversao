module.exports = async (context, next) => {
    const { isGroup, db, chatJid, message, prefixo, commands } = context;

    if (isGroup) {
        const botAtivo = db.config.obterConfiguracaoGrupo(chatJid, 'bot_ativo');

        if (botAtivo === 'false') {
            const messageText = message || '';

            // Verifica se é comando 'on'
            if (messageText.toLowerCase().startsWith(prefixo)) {
                const commandBody = messageText.substring(prefixo.length).trim();
                const commandName = commandBody.split(' ')[0].toLowerCase();
                const command = commands.get(commandName);

                if (command && command.name === 'on') {
                    // Permite passar para o próximo (que vai executar o comando)
                    await next();
                    return;
                }
            }

            // Se não for 'on', silencia
            // console.log(`[Bot Desativado] Ignorando mensagem em ${chatJid}`);
            return; // Interrompe pipeline
        }
    }

    await next();
};
