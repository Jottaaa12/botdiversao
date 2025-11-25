const { jidNormalizedUser, delay } = require('@whiskeysockets/baileys');
const db = require('../database');
const fs = require('fs');
const path = require('path');
const sessionManager = require('./services/sessionManager');

// --- Carregador Dinâmico de Comandos ---
const commands = new Map();
const commandsPath = path.join(__dirname, '../commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('[Command Loader] Carregando comandos...');
for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if (command.name && typeof command.execute === 'function') {
            commands.set(command.name.toLowerCase(), command);
            console.log(`- Comando '${command.name}' carregado.`);

            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(alias => {
                    commands.set(alias.toLowerCase(), command);
                    console.log(`  - Alias '${alias}' para '${command.name}' registrado.`);
                });
            }
        } else {
            console.warn(`[Aviso] O arquivo '${file}' não exporta um comando no formato esperado (name, execute).`);
        }
    } catch (error) {
        console.error(`[Erro] Não foi possível carregar o comando do arquivo ${file}:`, error);
    }
}
console.log(`[Command Loader] ${commands.size} comandos/aliases carregados com sucesso.`);

// --- Middlewares Pipeline ---
// A ordem é CRÍTICA. Não altere sem entender o fluxo.
const middlewares = [
    require('./middlewares/01_normalizer'),
    require('./middlewares/01b_system'),
    require('./middlewares/01c_userLoader'), // Carrega usuário e atualiza histórico
    require('./middlewares/02_deduplicator'),
    require('./middlewares/02b_botStatus'),
    require('./middlewares/02c_sales'),
    require('./middlewares/03_moderation'),
    require('./middlewares/04_interactiveSession'),
    require('./middlewares/05_commandParser'),
    require('./middlewares/05b_triggers'),
    require('./middlewares/06_aiHandler')
];

async function handleMessage(sock, m, { jidNormalizedUser, restartBot }) {
    // Contexto inicial que será passado por todo o pipeline
    const context = {
        sock,
        m,
        jidNormalizedUser, // Injetando função de normalização
        restartBot,        // Injetando função de restart
        db,
        commands,
        sessionManager,
        prefixo: db.config.obterConfiguracao('prefixo') || '/'
    };

    // Executa o pipeline de middlewares
    const runPipeline = middlewares.reduceRight(
        (next, middleware) => async () => {
            try {
                await middleware(context, next);
            } catch (error) {
                console.error('[Middleware Error]', error);
                // Opcional: Notificar erro crítico
            }
        },
        async () => {
            // Final do pipeline (se nenhum middleware interromper)
            // Geralmente não chega aqui se AIHandler fizer seu trabalho
        }
    );

    await runPipeline();
}

async function handleMessageUpdate(sock, updates) {
    // Delega para o MessageStore (agora via sessionManager/moderation logic se necessário)
    // Mas mantemos a compatibilidade chamando o serviço de moderação diretamente ou via middleware
    // Para simplificar, vamos usar a lógica antiga encapsulada, mas acessando o store correto
    const { handleAntiEdit } = require('../services/moderationService');
    await handleAntiEdit(sock, updates, sessionManager.messageStore, db);
}

// --- EXPORTAÇÕES PARA RETROCOMPATIBILIDADE ---
// Muitos comandos importam mapas diretamente de messageHandler.js
// Precisamos re-exportá-los do sessionManager para não quebrar esses comandos.
module.exports = {
    handleMessage,
    handleMessageUpdate,
    commands,
    // Re-exportando mapas do sessionManager
    roletaRussaGames: sessionManager.roletaRussaGames,
    forcaGames: sessionManager.forcaGames,
    joinInProgress: sessionManager.joinInProgress,
    autoRespostaSteps: sessionManager.autoRespostaSteps,
    agendamentoSteps: sessionManager.agendamentoSteps,
    listaHorarioSteps: sessionManager.listaHorarioSteps,
    listaAberturaSteps: sessionManager.listaAberturaSteps,
    rifaCreationSteps: sessionManager.rifaCreationSteps,
    rifaConfirmationSteps: sessionManager.rifaConfirmationSteps,
    pedidosCasamento: sessionManager.pedidosCasamento,
    messageStore: sessionManager.messageStore,
    commandDeduplication: sessionManager.commandDeduplication,
    txpvConfirmations: sessionManager.txpvConfirmations
};
