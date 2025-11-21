module.exports = {
    name: 'nuke',
    aliases: ['holocausto'],
    description: '⚠️ CUIDADO! Remove TODOS os membros do grupo, exceto o dono, e depois sai. (Apenas dono do bot).',
    category: 'adm',
    permission: 'owner',
    async execute({ sock, chatJid }) {
        if (!chatJid.endsWith('@g.us')) {
            return 'Este comando só pode ser usado em grupos.';
        }

        try {
            await sock.sendMessage(chatJid, { text: '☢️ Protocolo Nuke iniciado. Adeus a todos.' });

            const metadata = await sock.groupMetadata(chatJid);
            const groupOwner = metadata.owner;
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            // Filtra a lista de participantes para remover todos, exceto o dono do grupo e o próprio bot
            const participantsToRemove = metadata.participants
                .map(p => p.id)
                .filter(id => id !== groupOwner && id !== botJid);

            if (participantsToRemove.length > 0) {
                console.log(`[Nuke] Removendo ${participantsToRemove.length} membros do grupo ${chatJid}.`);
                await sock.groupParticipantsUpdate(chatJid, participantsToRemove, 'remove');
            }
            
            // Sequência final de saída, com seu próprio try-catch para evitar crash
            try {
                await sock.sendMessage(chatJid, { text: 'Limpeza concluída. Autodestruição em 3... 2... 1...' });
                await sock.groupLeave(chatJid);
            } catch (finalError) {
                console.error('[Nuke] Erro na saída do grupo. O bot pode já ter sido removido ou perdido acesso.', finalError);
                // Não faz nada aqui para evitar o crash, apenas loga o erro.
            }

        } catch (error) {
            console.error('[Nuke Error]', error);
            // Este catch agora lida com erros na fase de remoção, onde ainda é seguro responder.
            return 'Falha ao executar o protocolo Nuke. Verifique se eu sou administrador do grupo.';
        }
        // Retorna undefined explicitamente para garantir que o messageHandler não tente enviar outra resposta
        return;
    },
};
