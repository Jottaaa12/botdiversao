module.exports = {
    name: 'redefinirlink',
    description: 'Redefine o link de convite do grupo, invalidando o anterior.',
    category: 'adm',
    aliases: ['resetlink', 'novolink'],
    permission: 'admin',
    async execute({ sock, chatJid }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            await sock.groupRevokeInvite(chatJid);
            return '✅ O link de convite do grupo foi redefinido com sucesso!';
        } catch (error) {
            console.error('[RedefinirLink Error]', error);
            return 'Ocorreu um erro ao redefinir o link. Verifique se eu sou um administrador do grupo.';
        }
    },
};
