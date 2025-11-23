const { delay } = require('@whiskeysockets/baileys');

async function execute({ sock, msg, args, senderJid, chatJid, prefixo, db, listaHorarioSteps, isGroup }) {
    // Verifica se é admin
    const { getPermissionLevel } = require('../utils/auth');
    const permissionLevel = await getPermissionLevel(sock, senderJid);
    if (permissionLevel !== 'admin' && permissionLevel !== 'owner') {
        return '❌ Você não tem permissão para usar este comando.';
    }

    // Se estiver em um fluxo interativo
    if (listaHorarioSteps.has(senderJid)) {
        return processarPassoInterativo(sock, msg, args, senderJid, chatJid, db, listaHorarioSteps);
    }

    const subcomando = args[0]?.toLowerCase();
    const idGrupoArg = args[1];

    // --- SUBCOMANDOS ---

    // LISTAR GRUPOS ATIVOS
    if (subcomando === 'listar') {
        const gruposAtivos = db.list.listarGruposComListaAtiva();
        if (gruposAtivos.length === 0) {
            return 'ℹ️ Nenhum grupo com lista de horário ativa no momento.';
        }

        let resposta = '📋 *GRUPOS COM LISTA HORÁRIO ATIVA:*\n\n';
        for (const g of gruposAtivos) {
            let nomeGrupo = g.id_grupo;
            try {
                const metadata = await sock.groupMetadata(g.id_grupo);
                nomeGrupo = metadata.subject;
            } catch (e) { /* Ignora erro ao buscar nome */ }

            const dias = g.dias_envio ? g.dias_envio.split(',').map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ') : 'Todos';
            resposta += `🔹 *${nomeGrupo}*\n   🕒 Horário: ${g.horario_envio}\n   📅 Dias: ${dias}\n   🆔 ID: ${g.id_grupo}\n\n`;
        }
        return resposta;
    }

    // HISTÓRICO
    if (subcomando === 'historico') {
        if (!idGrupoArg) return '❌ Informe o ID do grupo. Ex: !lh historico 123456@g.us';

        const historico = db.list.obterHistoricoEnvios(idGrupoArg, 10);
        if (historico.length === 0) {
            return 'ℹ️ Nenhum histórico de envio encontrado para este grupo.';
        }

        let resposta = `📜 *HISTÓRICO DE ENVIOS (Últimos 10)*\n🆔 Grupo: ${idGrupoArg}\n\n`;
        historico.forEach(h => {
            const data = new Date(h.data_envio).toLocaleString('pt-BR');
            const status = h.sucesso ? '✅ Sucesso' : `❌ Erro: ${h.erro || 'Desconhecido'}`;
            resposta += `📅 ${data} - ${status}\n`;
        });
        return resposta;
    }

    // STATUS (inclui alias 'stats')
    if (subcomando === 'status' || subcomando === 'ver' || subcomando === 'stats') {
        if (!idGrupoArg) return '❌ Informe o ID do grupo. Ex: !lh status 123456@g.us';

        const config = db.list.obterConfigLista(idGrupoArg);
        if (!config || !config.horario_envio) {
            return 'ℹ️ Este grupo não possui configuração de lista horário.';
        }

        const dias = config.dias_envio ? config.dias_envio.split(',').map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ') : 'Todos os dias';
        const status = config.envio_ativo ? '✅ Ativo' : '⏸️ Pausado';

        return `⚙️ *CONFIGURAÇÃO ATUAL*\n\n🆔 Grupo: ${idGrupoArg}\n🕒 Horário: ${config.horario_envio}\n📅 Dias: ${dias}\n📊 Status: ${status}`;
    }

    // PAUSAR
    if (subcomando === 'pausar') {
        if (!idGrupoArg) return '❌ Informe o ID do grupo. Ex: !lh pausar 123456@g.us';
        db.list.pausarEnvioLista(idGrupoArg);
        return '✅ Envio de lista pausado para este grupo.';
    }

    // REATIVAR
    if (subcomando === 'reativar') {
        if (!idGrupoArg) return '❌ Informe o ID do grupo. Ex: !lh reativar 123456@g.us';
        const result = db.list.ativarEnvioLista(idGrupoArg);
        if (result) return '✅ Envio de lista reativado com sucesso!';
        return '❌ Não foi possível reativar. Verifique se há uma configuração existente.';
    }

    // CANCELAR
    if (subcomando === 'cancelar') {
        if (!idGrupoArg) return '❌ Informe o ID do grupo. Ex: !lh cancelar 123456@g.us';
        db.list.cancelarEnvioLista(idGrupoArg);
        return '✅ Configuração de lista horário removida completamente.';
    }

    // --- INÍCIO DO FLUXO INTERATIVO (NO PV) ---
    if (isGroup) {
        return '❌ Para configurar uma nova lista horário, use este comando no meu privado (PV).';
    }

    try {
        const groups = await sock.groupFetchAllParticipating();
        const groupsList = Object.values(groups).map(g => ({ id: g.id, subject: g.subject }));

        if (groupsList.length === 0) {
            return '❌ Não encontrei nenhum grupo onde eu sou participante.';
        }

        listaHorarioSteps.set(senderJid, {
            step: 'selecionar_grupo',
            gruposDisponiveis: groupsList
        });

        let msg = '🤖 *CONFIGURAR LISTA HORÁRIO*\n\nSelecione o grupo onde deseja configurar o envio automático:\n\n';
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

async function processarPassoInterativo(sock, msg, args, senderJid, chatJid, db, listaHorarioSteps) {
    const estado = listaHorarioSteps.get(senderJid);
    const textoUsuario = args.join(' ');

    // Cancelamento
    if (textoUsuario.toLowerCase() === 'cancelar') {
        listaHorarioSteps.delete(senderJid);
        return '❌ Configuração cancelada.';
    }

    // --- PASSO: SELECIONAR GRUPO ---
    if (estado.step === 'selecionar_grupo') {
        const index = parseInt(textoUsuario) - 1;
        const grupos = estado.gruposDisponiveis;

        if (isNaN(index) || index < 0 || index >= grupos.length) {
            return '❌ Número inválido. Selecione um número da lista acima.';
        }

        const grupoSelecionado = grupos[index];
        estado.chatJid = grupoSelecionado.id;
        estado.nomeGrupo = grupoSelecionado.subject;

        delete estado.gruposDisponiveis; // Limpa memória

        estado.step = 'definir_horario';
        listaHorarioSteps.set(senderJid, estado);

        return `✅ Grupo selecionado: *${grupoSelecionado.subject}*\n\nAgora, digite o *horário* de envio (formato HH:MM, ex: 14:30):`;
    }

    // --- PASSO: DEFINIR HORÁRIO ---
    if (estado.step === 'definir_horario') {
        const horarioRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!horarioRegex.test(textoUsuario)) {
            return '❌ Formato inválido. Use HH:MM (ex: 09:00, 18:30).';
        }

        estado.horario = textoUsuario;
        estado.step = 'selecionar_dias';
        estado.diasSelecionados = [];
        listaHorarioSteps.set(senderJid, estado);

        return `🕒 Horário definido: *${textoUsuario}*\n\nAgora selecione os dias da semana (envie os números separados por vírgula ou um por um):\n\n0 - Domingo\n1 - Segunda\n2 - Terça\n3 - Quarta\n4 - Quinta\n5 - Sexta\n6 - Sábado\n\nExemplo: 1,3,5 (Seg, Qua, Sex)\nOu digite "todos" para todos os dias.\nOu digite "fim" para terminar a seleção.`;
    }

    // --- PASSO: SELECIONAR DIAS ---
    if (estado.step === 'selecionar_dias') {
        if (textoUsuario.toLowerCase() === 'todos') {
            estado.diasSelecionados = [0, 1, 2, 3, 4, 5, 6];
            return finalizarConfiguracao(estado, db, listaHorarioSteps, senderJid);
        }

        if (textoUsuario.toLowerCase() === 'fim') {
            if (estado.diasSelecionados.length === 0) {
                return '❌ Selecione pelo menos um dia.';
            }
            return finalizarConfiguracao(estado, db, listaHorarioSteps, senderJid);
        }

        // Processar números
        const partes = textoUsuario.split(/[, ]+/);
        const diasValidos = [];

        for (const parte of partes) {
            const dia = parseInt(parte);
            if (!isNaN(dia) && dia >= 0 && dia <= 6) {
                if (!estado.diasSelecionados.includes(dia)) {
                    estado.diasSelecionados.push(dia);
                    diasValidos.push(dia);
                }
            }
        }

        if (diasValidos.length > 0) {
            estado.diasSelecionados.sort((a, b) => a - b);
            listaHorarioSteps.set(senderJid, estado);

            const diasNomes = estado.diasSelecionados.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ');
            return `✅ Dias selecionados até agora: *${diasNomes}*\n\nDigite mais números, "todos" ou "fim" para salvar.`;
        } else {
            return '❌ Nenhum dia válido identificado. Use números de 0 a 6.';
        }
    }
}

function finalizarConfiguracao(estado, db, listaHorarioSteps, senderJid) {
    try {
        db.list.definirHorarioEnvioLista(estado.chatJid, estado.horario, estado.diasSelecionados);
        listaHorarioSteps.delete(senderJid);

        const diasNomes = estado.diasSelecionados.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ');

        return `✅ *CONFIGURAÇÃO SALVA COM SUCESSO!* 🎉\n\n` +
            `🆔 Grupo: ${estado.nomeGrupo}\n` +
            `🕒 Horário: ${estado.horario}\n` +
            `📅 Dias: ${diasNomes}\n\n` +
            `A lista será enviada automaticamente nestes dias e horário.`;
    } catch (error) {
        console.error('Erro ao salvar lista horário:', error);
        listaHorarioSteps.delete(senderJid);
        return '❌ Ocorreu um erro ao salvar a configuração.';
    }
}

module.exports = {
    name: 'lista_horario',
    aliases: ['lh', 'listahorario'],
    description: 'Configura o horário de envio automático da lista (PV).',
    category: 'adm',
    permission: 'admin',
    execute
};
