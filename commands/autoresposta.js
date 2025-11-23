const { delay } = require('@whiskeysockets/baileys');

async function execute({ sock, msg, args, senderJid, chatJid, prefixo, db, autoRespostaSteps }) {
    const isGroup = chatJid.endsWith('@g.us');
    const fullText = args.join(' ');

    // Verifica se o usuário está em um fluxo interativo
    if (autoRespostaSteps.has(senderJid)) {
        return processarPassoInterativo(sock, msg, args, senderJid, chatJid, db, autoRespostaSteps);
    }

    // --- COMANDO NO PV ---
    if (!isGroup) {
        // Inicia fluxo de seleção de grupo
        try {
            const groups = await sock.groupFetchAllParticipating();
            const groupsList = Object.values(groups).map(g => ({ id: g.id, subject: g.subject }));

            if (groupsList.length === 0) {
                return '❌ Não encontrei nenhum grupo onde eu sou participante.';
            }

            autoRespostaSteps.set(senderJid, {
                step: 'selecionar_grupo',
                gruposDisponiveis: groupsList
            });

            let msg = '🤖 *CONFIGURAR AUTO-RESPOSTA*\n\nSelecione o grupo onde deseja configurar o gatilho:\n\n';
            groupsList.forEach((g, index) => {
                msg += `${index + 1} - ${g.subject}\n`;
            });
            msg += '\n_Responda com o número do grupo ou "cancelar" para sair._';

            // Envia a mensagem diretamente ao invés de retornar
            await sock.sendMessage(chatJid, { text: msg });
            return; // Retorna vazio para não enviar duplicado
        } catch (error) {
            console.error('Erro ao buscar grupos:', error);
            return '❌ Erro ao buscar lista de grupos.';
        }
    }

    // --- COMANDO NO GRUPO ---

    // Listar gatilhos
    if (!fullText || fullText.toLowerCase() === 'listar') {
        const triggers = db.groupInteraction.listarAutoRespostas(chatJid);
        if (triggers.length === 0) {
            return 'ℹ️ Não há auto-respostas configuradas neste grupo.';
        }
        let response = '*Auto-Respostas Configuradas:*\n\n';
        triggers.forEach(t => {
            const tipo = t.match_type === 'contains' ? '🔤 Contém' : '🎯 Exata';
            response += `🔹 *${t.gatilho}* (${tipo}) ➡️ ${t.resposta.substring(0, 20)}${t.resposta.length > 20 ? '...' : ''}\n`;
        });
        return response;
    }

    // Remover gatilho
    if (fullText.toLowerCase().startsWith('remover ') || fullText.toLowerCase().startsWith('deletar ')) {
        const triggerToRemove = fullText.split(' ').slice(1).join(' ').toLowerCase();
        const result = db.groupInteraction.removerAutoResposta(triggerToRemove, chatJid);
        if (result.changes > 0) {
            return `✅ Auto-resposta para *"${triggerToRemove}"* removida com sucesso.`;
        } else {
            return `❌ Gatilho *"${triggerToRemove}"* não encontrado.`;
        }
    }

    // Adicionar gatilho (Lógica Rápida com Separadores)
    // Ex: !gatilho oi | olá | contains
    if (fullText.includes('|')) {
        const parts = fullText.split('|').map(p => p.trim());
        const trigger = parts[0].toLowerCase();
        const responseText = parts[1];
        let matchType = 'exact';

        if (parts[2] && (parts[2].toLowerCase() === 'contains' || parts[2].toLowerCase() === 'contem')) {
            matchType = 'contains';
        }

        if (!trigger || !responseText) return '❌ Formato inválido. Use: gatilho | resposta | tipo(opcional)';

        try {
            db.groupInteraction.adicionarAutoResposta(trigger, responseText, chatJid, senderJid, matchType);
            const tipoStr = matchType === 'contains' ? '🔤 Contém' : '🎯 Exata';
            return `✅ Auto-resposta configurada!\n\n🗣️ *Gatilho:* "${trigger}"\n🤖 *Resposta:* "${responseText}"\n⚙️ *Tipo:* ${tipoStr}`;
        } catch (error) {
            console.error('Erro ao salvar auto-resposta:', error);
            return '❌ Erro ao salvar auto-resposta.';
        }
    }

    // Inicia fluxo interativo no grupo
    autoRespostaSteps.set(senderJid, {
        step: 'definir_gatilho',
        chatJid: chatJid,
        trigger: fullText.trim().toLowerCase() || null // Se já digitou algo, usa como gatilho
    });

    if (fullText) {
        // Já temos o gatilho, pede a resposta
        autoRespostaSteps.get(senderJid).step = 'definir_resposta';
        return `Qual a resposta para o gatilho *"${fullText}"*?\n\n_Responda com a mensagem que o bot deve enviar._`;
    } else {
        return `Qual será o *gatilho* (palavra ou frase chave)?\n\n_Digite o gatilho agora._`;
    }
}

async function processarPassoInterativo(sock, msg, args, senderJid, chatJid, db, autoRespostaSteps) {
    const estado = autoRespostaSteps.get(senderJid);
    const textoUsuario = args.join(' ');

    // Cancelamento
    if (textoUsuario.toLowerCase() === 'cancelar') {
        autoRespostaSteps.delete(senderJid);
        return '❌ Configuração cancelada.';
    }

    // --- PASSO: SELECIONAR GRUPO (APENAS PV) ---
    if (estado.step === 'selecionar_grupo') {
        const index = parseInt(textoUsuario) - 1;
        const grupos = estado.gruposDisponiveis;

        if (isNaN(index) || index < 0 || index >= grupos.length) {
            return '❌ Número inválido. Selecione um número da lista acima.';
        }

        const grupoSelecionado = grupos[index];
        estado.chatJid = grupoSelecionado.id;
        estado.nomeGrupo = grupoSelecionado.subject;

        // Limpa lista para economizar memória
        delete estado.gruposDisponiveis;

        estado.step = 'definir_gatilho';
        autoRespostaSteps.set(senderJid, estado);

        return `✅ Grupo selecionado: *${grupoSelecionado.subject}*\n\nAgora, qual será o *gatilho* (palavra ou frase chave)?`;
    }

    // --- PASSO: DEFINIR GATILHO ---
    if (estado.step === 'definir_gatilho') {
        if (!textoUsuario) return '❌ O gatilho não pode ser vazio.';

        estado.trigger = textoUsuario.toLowerCase();
        estado.step = 'definir_resposta';
        autoRespostaSteps.set(senderJid, estado);

        return `Gatilho: *"${estado.trigger}"*\n\nAgora, qual a *resposta* que o bot deve enviar?`;
    }

    // --- PASSO: DEFINIR RESPOSTA ---
    if (estado.step === 'definir_resposta') {
        if (!textoUsuario) return '❌ A resposta não pode ser vazia.';

        estado.responseText = textoUsuario;
        estado.step = 'definir_tipo';
        autoRespostaSteps.set(senderJid, estado);

        return `Resposta definida!\n\nAgora, como esse gatilho deve funcionar?\n\n1️⃣ *Exata*: A mensagem deve ser IGUAL ao gatilho (ex: apenas "oi")\n2️⃣ *Contém*: A mensagem deve CONTER o gatilho (ex: "oi tudo bem" ativa "oi")\n\n_Responda com 1 ou 2._`;
    }

    // --- PASSO: DEFINIR TIPO ---
    if (estado.step === 'definir_tipo') {
        let matchType = 'exact';
        if (textoUsuario === '1') matchType = 'exact';
        else if (textoUsuario === '2') matchType = 'contains';
        else return '❌ Opção inválida. Responda com 1 ou 2.';

        try {
            db.groupInteraction.adicionarAutoResposta(estado.trigger, estado.responseText, estado.chatJid, senderJid, matchType);
            autoRespostaSteps.delete(senderJid);

            const tipoStr = matchType === 'contains' ? '🔤 Contém' : '🎯 Exata';
            const local = estado.nomeGrupo ? ` no grupo *${estado.nomeGrupo}*` : '';

            return `✅ Auto-resposta configurada${local}!\n\n🗣️ *Gatilho:* "${estado.trigger}"\n🤖 *Resposta:* "${estado.responseText}"\n⚙️ *Tipo:* ${tipoStr}`;
        } catch (error) {
            console.error('Erro ao salvar auto-resposta:', error);
            autoRespostaSteps.delete(senderJid);
            return '❌ Erro ao salvar auto-resposta.';
        }
    }
}

module.exports = {
    name: 'autoresposta',
    description: 'Cria respostas automáticas para o grupo.',
    aliases: ['gatilho', 'gerargatilho'],
    category: 'adm',
    // permission: 'admin', // Removido para permitir uso no PV, verificação de admin deve ser feita se for grupo
    execute
};
