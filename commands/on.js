module.exports = {
    name: 'on',
    aliases: ['ligar', 'ativar'],
    description: 'Ativa o bot neste grupo.',
    category: 'adm',
    permission: 'admin',
    async execute({ chatJid, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            db.config.salvarConfiguracaoGrupo(chatJid, 'bot_ativo', 'true');
            return '✅ O bot foi ativado neste grupo e responderá aos comandos novamente.';
        } catch (error) {
            console.error('[ON Command Error]', error);
            return 'Ocorreu um erro ao tentar ativar o bot.';
        }
    },
};
