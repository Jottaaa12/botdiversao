const db = require('../database');

module.exports = {
    name: 'boasvindas',
    aliases: ['welcome'],
    description: 'Liga/desliga a mensagem de boas-vindas para novos membros.',
    category: 'adm',
    permission: 'admin',
    async execute({ sock, chatJid, args }) {
        if (!chatJid.endsWith('@g.us')) {
            return 'Este comando só pode ser usado em grupos.';
        }

        const option = args[0]?.toLowerCase();

        if (option !== 'on' && option !== 'off') {
            const status = db.config.obterConfiguracaoGrupo(chatJid, 'boasvindas') === 'true' ? 'Ativado' : 'Desativado';
            return `Uso: /boasvindas [on/off]\n\nStatus atual para este grupo: *${status}*`;
        }

        const isEnabled = option === 'on';
        db.config.salvarConfiguracaoGrupo(chatJid, 'boasvindas', isEnabled ? 'true' : 'false');

        const message = isEnabled
            ? '✅ Mensagens de boas-vindas ativadas! Novos membros serão saudados.'
            : '❌ Mensagens de boas-vindas desativadas.';

        await sock.sendMessage(chatJid, { text: message });
    },
};
