module.exports = async (context, next) => {
    const { sessionManager, senderJid, message } = context;
    const { commandDeduplication } = sessionManager;

    const commandKey = `${senderJid}:${message.trim()}`;
    const lastTime = commandDeduplication.get(commandKey);
    const now = Date.now();

    if (lastTime && (now - lastTime < 2000)) { // 2 segundos de debounce
        console.log(`[Deduplicação] Ignorando comando duplicado de ${senderJid}`);
        return; // Interrompe o pipeline
    }
    commandDeduplication.set(commandKey, now);

    // Limpeza periódica
    if (commandDeduplication.size > 1000) {
        commandDeduplication.clear();
    }

    await next();
};
