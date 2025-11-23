module.exports = {
    name: 'antiedit',
    aliases: ['anti_edit', 'noedit'],
    description: 'Alterna o modo anti-edição. Quando ativo, reenvia a mensagem original se alguém editar.',
    category: 'adm',
    permission: 'admin',
    async execute({ chatJid, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            // Verifica o estado atual
            const modoAtual = db.config.obterConfiguracaoGrupo(chatJid, 'antiedit') === 'true';

            // Alterna o estado (toggle)
            if (modoAtual) {
                // Se está ativo, desativa
                db.config.salvarConfiguracaoGrupo(chatJid, 'antiedit', 'false');
                return '✅ *Anti-Edit DESATIVADO*\n\n📝 Membros podem editar mensagens livremente.';
            } else {
                // Se está desativado, ativa
                db.config.salvarConfiguracaoGrupo(chatJid, 'antiedit', 'true');
                return '✅ *Anti-Edit ATIVADO*\n\n🔍 Quando alguém editar uma mensagem, a versão original será revelada.';
            }
        } catch (error) {
            console.error('[ANTIEDIT Command Error]', error);
            return 'Ocorreu um erro ao configurar o anti-edit.';
        }
    },
};
