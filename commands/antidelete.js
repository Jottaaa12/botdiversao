module.exports = {
    name: 'antidelete',
    aliases: ['anti_delete', 'nodelete', 'antidel'],
    description: 'Alterna o modo anti-delete. Quando ativo, reenvia mensagens que foram deletadas.',
    category: 'adm',
    permission: 'admin',
    async execute({ chatJid, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            // Verifica o estado atual
            const modoAtual = db.config.obterConfiguracaoGrupo(chatJid, 'antidelete') === 'true';

            // Alterna o estado (toggle)
            if (modoAtual) {
                // Se está ativo, desativa
                db.config.salvarConfiguracaoGrupo(chatJid, 'antidelete', 'false');
                return '✅ *Anti-Delete DESATIVADO*\n\n🗑️ Membros podem deletar mensagens livremente.';
            } else {
                // Se está desativado, ativa
                db.config.salvarConfiguracaoGrupo(chatJid, 'antidelete', 'true');
                return '✅ *Anti-Delete ATIVADO*\n\n🔍 Quando alguém deletar uma mensagem, ela será reenviada pelo bot.';
            }
        } catch (error) {
            console.error('[ANTIDELETE Command Error]', error);
            return 'Ocorreu um erro ao configurar o anti-delete.';
        }
    },
};
