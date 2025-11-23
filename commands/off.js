module.exports = {
    name: 'off',
    aliases: ['desligar', 'desativar'],
    description: 'Desativa o bot neste grupo. Ele só responderá ao comando !on.',
    category: 'adm',
    permission: 'admin',
    async execute({ chatJid, prefixo, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            db.config.salvarConfiguracaoGrupo(chatJid, 'bot_ativo', 'false');
            return `❌ O bot foi desativado neste grupo. Não responderei a mais nenhum comando aqui, exceto *${prefixo}on* para me reativar.`;
        } catch (error) {
            console.error('[OFF Command Error]', error);
            return 'Ocorreu um erro ao tentar desativar o bot.';
        }
    },
};
