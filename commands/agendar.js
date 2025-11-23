const { delay } = require('@whiskeysockets/baileys');

async function execute({ sock, msg, args, senderJid, chatJid, prefixo, db, agendamentoSteps }) {
    const subcomando = args[0] ? args[0].toLowerCase() : null;
    const restoArgs = args.slice(1).join(' ');

    // Verifica se o usuário está em um fluxo interativo
    if (agendamentoSteps.has(senderJid)) {
        return processarPassoInterativo(sock, msg, args, senderJid, chatJid, db, agendamentoSteps);
    }

    // --- SUBCOMANDO: AJUDA ---
    if (!subcomando || subcomando === 'ajuda' || subcomando === 'help') {
        return `📅 *SISTEMA DE AGENDAMENTO* 📅

Gerencie mensagens automáticas para grupos ou contatos.

🔹 *${prefixo}agendar criar*
Inicia o processo de criar um novo agendamento.

🔹 *${prefixo}agendar listar*
Mostra seus agendamentos ativos e pausados.

🔹 *${prefixo}agendar remover [ID]*
Remove um agendamento permanentemente.
_Ex: ${prefixo}agendar remover 1_

🔹 *${prefixo}agendar pausar [ID]*
Pausa o envio de um agendamento.

🔹 *${prefixo}agendar ativar [ID]*
Reativa um agendamento pausado.

💡 *Dica:* Você pode usar *!agen* como abreviação.`;
    }

    // --- SUBCOMANDO: CRIAR ---
    if (subcomando === 'criar' || subcomando === 'novo' || subcomando === 'add') {
        // Inicia o fluxo interativo
        agendamentoSteps.set(senderJid, {
            step: 1,
            data: {}
        });

        return `📅 *CRIAR AGENDAMENTO - Passo 1/4*

Onde deseja enviar a mensagem?

1️⃣ Neste grupo/chat atual
2️⃣ Em outro grupo (precisarei do ID)
3️⃣ Em uma conversa privada (PV)

_Responda com o número da opção._
_Digite "cancelar" a qualquer momento para sair._`;
    }

    // --- SUBCOMANDO: LISTAR ---
    if (subcomando === 'listar' || subcomando === 'lista' || subcomando === 'ls') {
        const agendamentos = db.schedule.listarAgendamentosPorCriador(senderJid);

        if (agendamentos.length === 0) {
            return '📭 Você não possui agendamentos cadastrados.';
        }

        let texto = '📋 *SEUS AGENDAMENTOS*\n\n';

        for (const ag of agendamentos) {
            const status = ag.ativo ? '✅ Ativo' : '⏸️ Pausado';
            const destino = ag.destino_tipo === 'grupo' ? '👥 Grupo' : '👤 PV';
            const dias = ag.dias_semana
                ? formatarDias(ag.dias_semana)
                : 'Todos os dias';

            texto += `*#${ag.id}* - ${status}\n`;
            texto += `📍 ${destino}: ${ag.destino_jid.split('@')[0]}\n`;
            texto += `⏰ Horário: ${ag.horario}\n`;
            texto += `📅 Dias: ${dias}\n`;
            texto += `💬 Msg: "${ag.mensagem.substring(0, 30)}${ag.mensagem.length > 30 ? '...' : ''}"\n`;
            texto += `───────────────────\n`;
        }

        texto += `\nUse *${prefixo}agendar remover [ID]* para apagar.`;
        return texto;
    }

    // --- SUBCOMANDO: REMOVER ---
    if (subcomando === 'remover' || subcomando === 'rm' || subcomando === 'del') {
        if (!restoArgs) return '❌ Informe o ID do agendamento. Ex: !agen rm 1';

        const id = parseInt(restoArgs);
        if (isNaN(id)) return '❌ ID inválido.';

        const agendamento = db.schedule.obterAgendamento(id);
        if (!agendamento) return '❌ Agendamento não encontrado.';

        if (agendamento.id_criador !== senderJid) {
            // Verifica se é admin para permitir remover de outros (opcional, por enquanto restrito)
            return '❌ Você só pode remover seus próprios agendamentos.';
        }

        db.schedule.removerAgendamento(id);
        return `✅ Agendamento *#${id}* removido com sucesso!`;
    }

    // --- SUBCOMANDO: PAUSAR ---
    if (subcomando === 'pausar' || subcomando === 'stop') {
        if (!restoArgs) return '❌ Informe o ID do agendamento. Ex: !agen pausar 1';

        const id = parseInt(restoArgs);
        if (isNaN(id)) return '❌ ID inválido.';

        const agendamento = db.schedule.obterAgendamento(id);
        if (!agendamento) return '❌ Agendamento não encontrado.';
        if (agendamento.id_criador !== senderJid) return '❌ Apenas o criador pode pausar.';

        db.schedule.pausarAgendamento(id);
        return `⏸️ Agendamento *#${id}* pausado.`;
    }

    // --- SUBCOMANDO: ATIVAR ---
    if (subcomando === 'ativar' || subcomando === 'start') {
        if (!restoArgs) return '❌ Informe o ID do agendamento. Ex: !agen ativar 1';

        const id = parseInt(restoArgs);
        if (isNaN(id)) return '❌ ID inválido.';

        const agendamento = db.schedule.obterAgendamento(id);
        if (!agendamento) return '❌ Agendamento não encontrado.';
        if (agendamento.id_criador !== senderJid) return '❌ Apenas o criador pode ativar.';

        db.schedule.ativarAgendamento(id);
        return `✅ Agendamento *#${id}* ativado!`;
    }

    // --- SUBCOMANDO: STATS ---
    if (subcomando === 'stats' || subcomando === 'estatisticas' || subcomando === 'info') {
        if (!restoArgs) return '❌ Informe o ID do agendamento. Ex: !agen stats 1';

        const id = parseInt(restoArgs);
        if (isNaN(id)) return '❌ ID inválido.';

        const agendamento = db.schedule.obterAgendamento(id);
        if (!agendamento) return '❌ Agendamento não encontrado.';

        // Permite ver stats se for criador ou admin (opcional, aqui restrito ao criador por enquanto)
        if (agendamento.id_criador !== senderJid) return '❌ Você só pode ver estatísticas dos seus agendamentos.';

        const status = agendamento.ativo ? '✅ Ativo' : '⏸️ Pausado';
        const destino = agendamento.destino_tipo === 'grupo' ? '👥 Grupo' : '👤 PV';
        const dias = agendamento.dias_semana ? formatarDias(agendamento.dias_semana) : 'Todos os dias';
        const ultimoEnvio = agendamento.ultimo_envio ? new Date(agendamento.ultimo_envio).toLocaleString('pt-BR') : 'Nunca';
        const criadoEm = new Date(agendamento.criado_em).toLocaleString('pt-BR');
        const totalEnvios = agendamento.total_envios || 0;

        return `📊 *ESTATÍSTICAS DO AGENDAMENTO #${id}*

${status}
📍 Destino: ${agendamento.destino_jid.split('@')[0]}
💬 Mensagem: "${agendamento.mensagem}"
⏰ Horário: ${agendamento.horario}
📅 Dias: ${dias}

📈 *Métricas:*
• Total de envios: *${totalEnvios}*
• Último envio: ${ultimoEnvio}
• Criado em: ${criadoEm}`;
    }

    return '❌ Comando inválido. Use *!agendar ajuda* para ver as opções.';
}

// Função para processar o fluxo interativo
async function processarPassoInterativo(sock, msg, args, senderJid, chatJid, db, agendamentoSteps) {
    const estado = agendamentoSteps.get(senderJid);
    const textoUsuario = args.join(' ');

    // Cancelamento
    if (textoUsuario.toLowerCase() === 'cancelar') {
        agendamentoSteps.delete(senderJid);
        return '❌ Criação de agendamento cancelada.';
    }

    // --- PASSO 1: ESCOLHER DESTINO ---
    if (estado.step === 1) {
        if (textoUsuario === '1') {
            estado.data.destino_tipo = chatJid.endsWith('@g.us') ? 'grupo' : 'pv';
            estado.data.destino_jid = chatJid;

            // Tenta obter o nome do grupo ou chat
            if (estado.data.destino_tipo === 'grupo') {
                try {
                    const metadata = await sock.groupMetadata(chatJid);
                    estado.data.destino_nome = metadata.subject;
                } catch (e) {
                    estado.data.destino_nome = 'Grupo Atual';
                }
            } else {
                estado.data.destino_nome = 'Chat Privado';
            }

            estado.step = 2;
            agendamentoSteps.set(senderJid, estado);
            return `📅 *CRIAR AGENDAMENTO - Passo 2/4*

✅ Destino definido: *${estado.data.destino_nome}*

Agora, digite a *mensagem* que será enviada:
_Pode conter emojis e quebras de linha._`;
        }
        else if (textoUsuario === '2') {
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupsList = Object.values(groups).map(g => ({ id: g.id, subject: g.subject }));

                if (groupsList.length === 0) {
                    return '❌ Não encontrei nenhum grupo onde eu sou participante.';
                }

                // Salva a lista de grupos no estado para o usuário selecionar
                estado.data.gruposDisponiveis = groupsList;
                estado.step = 1.2;
                agendamentoSteps.set(senderJid, estado);

                let msg = '📅 *SELECIONE O GRUPO*\n\nDigite o número correspondente:\n\n';
                groupsList.forEach((g, index) => {
                    msg += `${index + 1} - ${g.subject}\n`;
                });

                return msg;
            } catch (error) {
                console.error('Erro ao buscar grupos:', error);
                return '❌ Erro ao buscar lista de grupos. Tente novamente ou use o ID.';
            }
        }
        else if (textoUsuario === '3') {
            estado.data.destino_tipo = 'pv';
            estado.step = 1.5; // Passo intermediário para pegar o número
            agendamentoSteps.set(senderJid, estado);
            return `📅 *CRIAR AGENDAMENTO - Passo 1.5/4*

Digite o número do destinatário (com DDD):
_Exemplo: 5511999999999_`;
        }
        else {
            return '❌ Opção inválida. Responda com 1, 2 ou 3.';
        }
    }

    // --- PASSO 1.2: SELECIONAR GRUPO DA LISTA ---
    if (estado.step === 1.2) {
        const index = parseInt(textoUsuario) - 1;
        const grupos = estado.data.gruposDisponiveis;

        if (isNaN(index) || index < 0 || index >= grupos.length) {
            return '❌ Número inválido. Selecione um número da lista acima.';
        }

        const grupoSelecionado = grupos[index];
        estado.data.destino_tipo = 'grupo';
        estado.data.destino_jid = grupoSelecionado.id;
        estado.data.destino_nome = grupoSelecionado.subject; // Salva o nome do grupo

        // Limpa a lista de grupos para economizar memória
        delete estado.data.gruposDisponiveis;

        estado.step = 2;
        agendamentoSteps.set(senderJid, estado);

        return `📅 *CRIAR AGENDAMENTO - Passo 2/4*

✅ Destino: *${grupoSelecionado.subject}*

Agora, digite a *mensagem* que será enviada:`;
    }

    // --- PASSO 1.5: PEGAR NÚMERO (se escolheu PV) ---
    if (estado.step === 1.5) {
        let numero = textoUsuario.replace(/\D/g, '');
        if (numero.length < 10) {
            return '❌ Número inválido. Tente novamente com DDD e código do país (55).';
        }
        if (!numero.startsWith('55')) numero = '55' + numero; // Assume BR se esquecer

        estado.data.destino_jid = numero + '@s.whatsapp.net';
        estado.data.destino_nome = numero; // Usa o número como nome para PV
        estado.step = 2;
        agendamentoSteps.set(senderJid, estado);
        return `📅 *CRIAR AGENDAMENTO - Passo 2/4*

✅ Destino: ${numero}

Agora, digite a *mensagem* que será enviada:`;
    }

    // --- PASSO 2: MENSAGEM ---
    if (estado.step === 2) {
        if (!textoUsuario) return '❌ A mensagem não pode ser vazia.';

        estado.data.mensagem = textoUsuario; // Pega mensagem original com formatação
        // Nota: args.join(' ') pode perder quebras de linha dependendo de como o handler passa.
        // Idealmente o handler passaria o msg.message.conversation ou extendedTextMessage.text
        // Vamos assumir que args.join(' ') é suficiente por enquanto ou ajustar no index.js

        estado.step = 3;
        agendamentoSteps.set(senderJid, estado);
        return `📅 *CRIAR AGENDAMENTO - Passo 3/4*

Mensagem salva! 📝

Agora, qual o *horário* de envio?
Digite no formato *HH:MM* (24h).
_Exemplo: 08:00 ou 14:30_`;
    }

    // --- PASSO 3: HORÁRIO ---
    if (estado.step === 3) {
        const horarioRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!horarioRegex.test(textoUsuario)) {
            return '❌ Formato inválido. Use HH:MM (ex: 14:30).';
        }

        estado.data.horario = textoUsuario;
        estado.step = 4;
        agendamentoSteps.set(senderJid, estado);
        return `📅 *CRIAR AGENDAMENTO - Passo 4/4*

Horário: ${textoUsuario} ⏰

Em quais dias enviar?

1️⃣ Todos os dias
2️⃣ Dias específicos

_Responda com o número da opção._`;
    }

    // --- PASSO 4: DIAS ---
    if (estado.step === 4) {
        if (textoUsuario === '1') {
            estado.data.dias_semana = null; // Todos os dias
            return finalizarCriacao(senderJid, estado.data, db, agendamentoSteps);
        }
        else if (textoUsuario === '2') {
            estado.step = 4.5;
            agendamentoSteps.set(senderJid, estado);
            return `📅 *SELECIONAR DIAS*

Digite os números dos dias separados por vírgula:

0 = Domingo
1 = Segunda
2 = Terça
3 = Quarta
4 = Quinta
5 = Sexta
6 = Sábado

_Exemplo: 1,3,5 (Seg, Qua, Sex)_`;
        }
        else {
            return '❌ Opção inválida. Responda com 1 ou 2.';
        }
    }

    // --- PASSO 4.5: SELECIONAR DIAS ESPECÍFICOS ---
    if (estado.step === 4.5) {
        const dias = textoUsuario.split(',').map(d => parseInt(d.trim()));
        const diasValidos = dias.every(d => !isNaN(d) && d >= 0 && d <= 6);

        if (!diasValidos || dias.length === 0) {
            return '❌ Formato inválido. Use números de 0 a 6 separados por vírgula.';
        }

        // Remove duplicatas e ordena
        estado.data.dias_semana = [...new Set(dias)].sort((a, b) => a - b);
        return finalizarCriacao(senderJid, estado.data, db, agendamentoSteps);
    }

    return '❌ Erro no fluxo. Digite "cancelar" para sair.';
}

function finalizarCriacao(senderJid, data, db, agendamentoSteps) {
    try {
        const id = db.schedule.criarAgendamento(
            senderJid,
            data.destino_tipo,
            data.destino_jid,
            data.mensagem,
            data.horario,
            data.dias_semana
        );

        agendamentoSteps.delete(senderJid);

        const diasStr = data.dias_semana ? formatarDias(data.dias_semana) : 'Todos os dias';
        const destinoDisplay = data.destino_nome || data.destino_jid.split('@')[0];

        return `✅ *AGENDAMENTO CRIADO!*

🆔 ID: *${id.lastInsertRowid}*
📍 Destino: ${destinoDisplay}
⏰ Horário: ${data.horario}
📅 Dias: ${diasStr}
💬 Mensagem: "${data.mensagem}"

O agendamento já está ativo!`;

    } catch (erro) {
        console.error(erro);
        agendamentoSteps.delete(senderJid);
        return '❌ Erro ao salvar agendamento no banco de dados.';
    }
}

function formatarDias(diasArray) {
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return diasArray.map(d => nomes[d]).join(', ');
}

module.exports = {
    name: 'agendar',
    aliases: ['agen', 'schedule'],
    category: 'util',
    description: 'Agendar mensagens automáticas',
    execute
};
