const db = require('../database');

async function handleGroupUpdate(sock, groupUpdate, joinInProgress) {
    for (const group of groupUpdate) {
        const groupId = group.id;
        console.log(`[Group Update] Recebido evento para o grupo: ${groupId}`);

        // Tenta obter uma configuração para ver se o grupo já é conhecido
        const existingConfig = db.config.obterConfiguracaoGrupo(groupId, 'ia_ativa');

        if (!existingConfig) {
            console.log(`[Group Update] Grupo novo detectado: ${groupId}. Registrando no banco de dados...`);
            try {
                // Adiciona configurações padrão para o novo grupo
                db.config.salvarConfiguracaoGrupo(groupId, 'ia_ativa', 'false');
                db.config.salvarConfiguracaoGrupo(groupId, 'antilink', 'false');
                db.config.salvarConfiguracaoGrupo(groupId, 'boasvindas', 'false'); // Exemplo de outra config

                // Incrementa o contador de grupos
                db.config.incrementarContador('total_grupos');

                // *** Lógica para suprimir a mensagem de boas-vindas ***
                if (joinInProgress && joinInProgress.has(groupId)) {
                    console.log(`[Group Update] Bot entrou no grupo ${groupId} via !join. Suprimindo mensagem de boas-vindas.`);
                    joinInProgress.delete(groupId); // Limpa a flag
                } else {
                    // Bot adicionado manualmente - não envia mensagem
                    console.log(`[Group Update] Bot adicionado ao grupo ${groupId}. Nenhuma mensagem será enviada.`);
                }
                // *** Fim da lógica de supressão ***

                console.log(`[Group Update] Grupo ${groupId} registrado com sucesso.`);
            } catch (error) {
                console.error(`[Group Update] Erro ao registrar o novo grupo ${groupId}:`, error);
            }
        } else {
            console.log(`[Group Update] O grupo ${groupId} já está registrado.`);
        }
    }
}

async function handleParticipantUpdate(sock, { id, participants, action }) {
    // Log aprimorado para depuração
    console.log(`[Participant Update] Evento: ${action} | Grupo: ${id}`);
    console.log('[Participant Update] Participantes recebidos:', participants);

    // Verifica se a função de boas-vindas está ativada para este grupo
    const welcomeEnabled = db.config.obterConfiguracaoGrupo(id, 'boasvindas') === 'true';

    if (welcomeEnabled && action === 'add') {
        // Obter o nome do grupo
        let groupName = 'este grupo';
        try {
            const groupMetadata = await sock.groupMetadata(id);
            groupName = groupMetadata.subject;
        } catch (error) {
            console.error('[Participant Update] Erro ao obter metadados do grupo:', error);
        }

        for (const participant of participants) { // Agora 'participant' é o objeto completo do participante
            const userJid = participant.id; // Extrai o JID string da propriedade 'id'

            // Adiciona uma verificação de segurança para garantir que userJid é uma string válida
            if (typeof userJid !== 'string' || !userJid) {
                console.warn('[Participant Update] JID inválido encontrado no objeto participante:', participant);
                continue; // Pula para o próximo item
            }

            // Evitar que o bot se dê as boas-vindas
            if (userJid === sock.user.id) {
                continue;
            }

            try {
                // Mensagem de boas-vindas personalizada
                const welcomeMessage = `🎉 Olá, @${userJid.split('@')[0]}! Seja muito bem-vindo(a) ao grupo *${groupName}*! 🎉\n\nSinta-se em casa e não hesite em interagir.`;

                await sock.sendMessage(id, {
                    text: welcomeMessage,
                    mentions: [userJid]
                });
                console.log(`[Participant Update] Mensagem de boas-vindas enviada para ${userJid} no grupo ${id}.`);
            } catch (error) {
                console.error(`[Participant Update] Falha ao enviar mensagem de boas-vindas para ${userJid}:`, error);
            }
        }
    }
}

module.exports = { handleGroupUpdate, handleParticipantUpdate };
