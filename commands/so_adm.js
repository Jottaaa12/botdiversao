module.exports = {
    name: 'so_adm',
    aliases: ['soadm', 'apenas_admin', 'admin_only'],
    description: 'Alterna o modo onde apenas administradores podem usar os comandos do bot.',
    category: 'adm',
    permission: 'admin',
    async execute({ chatJid, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            // Verifica o estado atual
            const modoAtual = db.obterConfiguracaoGrupo(chatJid, 'modo_so_adm') === 'true';

            // Alterna o estado (toggle)
            if (modoAtual) {
                // Se está ativo, desativa
                db.salvarConfiguracaoGrupo(chatJid, 'modo_so_adm', 'false');
                return '✅ *Modo Apenas Admin DESATIVADO*\n\n✨ Agora todos os membros do grupo podem usar os comandos do bot, respeitando as permissões individuais de cada comando.';
            } else {
                // Se está desativado, ativa
                db.salvarConfiguracaoGrupo(chatJid, 'modo_so_adm', 'true');
                return '✅ *Modo Apenas Admin ATIVADO*\n\n⚠️ A partir de agora, apenas administradores poderão usar todos os comandos do bot neste grupo.';
            }
        } catch (error) {
            console.error('[SO_ADM Command Error]', error);
            return 'Ocorreu um erro ao configurar o modo apenas admin.';
        }
    },
};
