module.exports = {
    name: 'link',
    description: 'Obtém o link de convite do grupo.',
    category: 'adm',
    aliases: ['convite', 'linkdogrupo', 'obterlink'],
    permission: 'admin', // Apenas admins podem obter o link para maior controle
    async execute({ sock, chatJid }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            const code = await sock.groupInviteCode(chatJid);
            if (code) {
                return `🔗 *Link de Convite do Grupo*\n\nhttps://chat.whatsapp.com/${code}`;
            } else {
                return 'Não foi possível obter o link de convite. Verifique se eu sou um administrador do grupo.';
            }
        } catch (error) {
            console.error('[GrupoLink Error]', error);
            return 'Ocorreu um erro ao buscar o link de convite. Verifique minhas permissões de admin.';
        }
    },
};
