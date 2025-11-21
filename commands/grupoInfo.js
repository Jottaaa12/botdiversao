const { WA_DEFAULT_EPHEMERAL } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'infogrupo',
    description: 'Exibe informações detalhadas sobre o grupo (incluindo regras).',
    category: 'adm',
    aliases: ['grupoinfo', 'informações', 'regras'],
    permission: 'admin',
    async execute({ sock, chatJid, commandName, db }) {
        const isGroup = chatJid.endsWith('@g.us');
        if (!isGroup) {
            return 'Este comando só pode ser usado em grupos.';
        }

        // Caso especial para o comando "regras"
        if (commandName === 'regras') {
            const regras = db.obterConfiguracaoGrupo(chatJid, 'regras');
            if (regras) {
                return `📜 *Regras do Grupo*\n\n${regras}`;
            } else {
                return '📝 Nenhuma regra foi definida para este grupo. Um administrador pode defini-las usando o comando `!setregras [texto das regras]`.';
            }
        }

        try {
            const metadata = await sock.groupMetadata(chatJid);
            const adminList = metadata.participants.filter(p => p.admin).map(p => `@${p.id.split('@')[0]}`);
            
            let ephemeralText = 'Desativado';
            if (metadata.ephemeralDuration) {
                const duration = metadata.ephemeralDuration;
                if (duration === 86400) ephemeralText = '24 horas';
                else if (duration === 604800) ephemeralText = '7 dias';
                else if (duration === 7776000) ephemeralText = '90 dias';
                else ephemeralText = `Ativado (${duration}s)`;
            }

            const response = `*📊 Informações do Grupo*\n\n` +
                             `*Nome:* ${metadata.subject}\n` +
                             `*ID:* ${metadata.id}\n\n` +
                             `*Descrição:*\n${metadata.desc ? metadata.desc : 'Nenhuma descrição.'}\n\n` +
                             `*Membros:* ${metadata.participants.length}\n` +
                             `*Admins:* ${adminList.length}\n` +
                             `*Dono:* ${metadata.owner ? `@${metadata.owner.split('@')[0]}` : 'Não encontrado'}\n\n` +
                             `*Mensagens Temporárias:* ${ephemeralText}\n` +
                             `*Restrito a Admins (Enviar Msg):* ${metadata.announce ? 'Sim' : 'Não'}\n` +
                             `*Restrito a Admins (Editar Info):* ${metadata.restrict ? 'Sim' : 'Não'}`;

            await sock.sendMessage(chatJid, { 
                text: response,
                mentions: metadata.participants.map(p => p.id)
            });

        } catch (error) {
            console.error('[InfoGrupo Error]', error);
            return 'Ocorreu um erro ao buscar as informações do grupo.';
        }
        
        // Retorna null ou undefined pois a mensagem já foi enviada
        return;
    },
};
