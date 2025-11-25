const commandExecutor = require('../services/commandExecutor');
const { parseNaturalCommand } = require('../../services/naturalCommandParser');

function quickCommandFilter(message) {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = message.match(urlRegex);

    if (!urlMatch) return null;

    const url = urlMatch[0];
    const lowerCaseMessage = message.toLowerCase();
    const normalizedMessage = lowerCaseMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        if (normalizedMessage.includes('mp3') || normalizedMessage.includes('audio') || normalizedMessage.includes('musica')) {
            return { command: 'ytmp3', argument: url };
        }
        if (normalizedMessage.includes('video') || normalizedMessage.includes('mp4')) {
            return { command: 'ytmp4', argument: url };
        }
        return { command: 'play', argument: url };
    }
    if (url.includes('tiktok.com')) return { command: 'tiktok', argument: url };
    if (url.includes('instagram.com')) return { command: 'instagram', argument: url };
    if (url.includes('twitter.com') || url.includes('x.com')) return { command: 'twitter', argument: url };
    if (url.includes('facebook.com') || url.includes('fb.watch')) return { command: 'facebook', argument: url };

    return null;
}

module.exports = async (context, next) => {
    const { message, prefixo, commands, sessionManager } = context;
    let commandToExecute = null;
    let args = [];
    let commandName = '';

    // 1. Comando por Prefixo
    if (message && message.toLowerCase().startsWith(prefixo)) {
        const commandBody = message.substring(prefixo.length).trim();
        const splitArgs = commandBody.split(' ');
        commandName = splitArgs.shift().toLowerCase();

        const command = commands.get(commandName);
        if (command) {
            commandToExecute = command;
            args = splitArgs;
        }
    }

    // 2. Comando por Filtro Rápido ou Linguagem Natural (apenas se não achou por prefixo)
    if (!commandToExecute && message) {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const hasUrl = urlRegex.test(message);
        let identifiedCommand = null;

        identifiedCommand = quickCommandFilter(message);

        if (!identifiedCommand && hasUrl) {
            identifiedCommand = await parseNaturalCommand(message);
        }

        if (identifiedCommand && identifiedCommand.command) {
            commandName = identifiedCommand.command.toLowerCase();
            const command = commands.get(commandName);
            if (command) {
                commandToExecute = command;
                args = identifiedCommand.argument ? identifiedCommand.argument.split(' ') : [];
            }
        }
    }

    // 3. Execução
    if (commandToExecute) {
        // Prepara o contexto completo para o executor
        const executionContext = {
            ...context,
            ...sessionManager, // Injeta os mapas para compatibilidade
            commandName,
            args,
            command: commandToExecute
        };

        await commandExecutor.execute(commandToExecute, executionContext);
        return; // Encerra o pipeline após executar o comando
    }

    // Caso especial: ler_documento sem texto (anexo apenas)
    if (!message && context.msg.message?.documentMessage) {
        const command = commands.get('ler_documento');
        if (command) {
            const executionContext = {
                ...context,
                ...sessionManager,
                commandName: 'ler_documento',
                args: [],
                command
            };
            await commandExecutor.execute(command, executionContext);
            return;
        }
    }

    await next();
};
