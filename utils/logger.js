const pino = require('pino');

// Determina o nível de log baseado na variável de ambiente
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Configuração do logger
const logger = pino({
    level: logLevel,
    // Em desenvolvimento, usa pretty print. Em produção, usa JSON
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{levelLabel} - {msg}'
        }
    } : undefined,
    // Formatação customizada
    formatters: {
        level: (label) => {
            return { level: label };
        }
    }
});

// Wrapper para manter compatibilidade com console.log
const log = {
    debug: (...args) => logger.debug(args.join(' ')),
    info: (...args) => logger.info(args.join(' ')),
    warn: (...args) => logger.warn(args.join(' ')),
    error: (...args) => logger.error(args.join(' ')),

    // Métodos especiais
    command: (commandName, user) => {
        logger.info({ command: commandName, user }, `Comando executado: ${commandName}`);
    },

    errorWithContext: (error, context) => {
        logger.error({ error: error.message, stack: error.stack, ...context }, 'Erro capturado');
    }
};

module.exports = log;
