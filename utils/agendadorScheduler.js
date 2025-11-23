const cron = require('node-cron');
const { canSendMessages } = require('./connectionStatus');

/**
 * Aguarda um tempo específico (em milissegundos)
 * @param {number} ms - Milissegundos para aguardar
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Tenta enviar uma mensagem com retry automático
 * @param {Object} sock - Socket do Baileys
 * @param {string} jid - Destinatário
 * @param {string} mensagem - Texto da mensagem
 * @param {number} agendamentoId - ID do agendamento
 * @returns {Promise<boolean>} - true se enviou com sucesso
 */
async function enviarComRetry(sock, jid, mensagem, agendamentoId) {
    const maxTentativas = 3;
    const delays = [0, 5000, 15000]; // 0s, 5s, 15s

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            // Aguarda o delay antes da tentativa (exceto na primeira)
            if (tentativa > 1) {
                const delayMs = delays[tentativa - 1];
                console.log(`⏳ [Agendador] Aguardando ${delayMs / 1000}s antes da tentativa ${tentativa}/${maxTentativas}...`);
                await sleep(delayMs);
            }

            // Verifica se ainda está conectado antes de tentar
            if (!canSendMessages(sock)) {
                console.warn(`⚠️ [Agendador] Tentativa ${tentativa}/${maxTentativas} cancelada - Bot desconectado`);
                if (tentativa === maxTentativas) {
                    return false;
                }
                continue;
            }

            // Tenta enviar
            await sock.sendMessage(jid, { text: mensagem });

            if (tentativa > 1) {
                console.log(`✅ [Agendador] Agendamento #${agendamentoId} enviado com sucesso na tentativa ${tentativa}`);
            } else {
                console.log(`✅ [Agendador] Agendamento #${agendamentoId} enviado com sucesso`);
            }

            return true;

        } catch (erro) {
            console.error(`❌ [Agendador] Tentativa ${tentativa}/${maxTentativas} falhou para agendamento #${agendamentoId}:`, erro.message);

            // Se foi a última tentativa, retorna false
            if (tentativa === maxTentativas) {
                console.error(`❌ [Agendador] Todas as tentativas falharam para agendamento #${agendamentoId}`);
                return false;
            }
        }
    }

    return false;
}

function iniciarAgendador(sock, db) {
    console.log('⏰ Agendador de mensagens iniciado!');

    // Roda a cada minuto
    cron.schedule('* * * * *', async () => {
        try {
            // Verifica se o bot está conectado antes de processar agendamentos
            if (!canSendMessages(sock)) {
                console.log('⚠️ [Agendador] Bot desconectado - Pulando verificação de agendamentos');
                return;
            }

            const agora = new Date();
            const diaSemana = agora.getDay(); // 0 = Domingo, 6 = Sábado

            // Formata hora atual HH:MM
            const horas = String(agora.getHours()).padStart(2, '0');
            const minutos = String(agora.getMinutes()).padStart(2, '0');
            const horarioAtual = `${horas}:${minutos}`;

            // Obtém todos os agendamentos ativos
            const agendamentos = db.schedule.listarTodosAgendamentosAtivos();

            for (const ag of agendamentos) {
                // 1. Verifica Horário
                if (ag.horario !== horarioAtual) continue;

                // 2. Verifica Dia da Semana
                if (ag.dias_semana && !ag.dias_semana.includes(diaSemana)) continue;

                // 3. Verifica se já foi enviado hoje (evitar duplicidade no mesmo minuto)
                if (ag.ultimo_envio) {
                    const ultimo = new Date(ag.ultimo_envio);
                    // Se foi enviado a menos de 2 minutos, ignora
                    const diff = agora - ultimo;
                    if (diff < 60000 * 1.5) continue;
                }

                // --- ENVIAR MENSAGEM COM RETRY ---
                console.log(`📤 [Agendador] Executando agendamento #${ag.id} para ${ag.destino_jid}`);

                const sucesso = await enviarComRetry(sock, ag.destino_jid, ag.mensagem, ag.id);

                if (sucesso) {
                    // Atualiza último envio
                    db.schedule.registrarEnvioAgendamento(ag.id);
                } else {
                    console.error(`❌ [Agendador] Falha ao enviar agendamento #${ag.id} após todas as tentativas`);
                    // Opcional: Notificar dono ou marcar como falha no banco
                }
            }

        } catch (erro) {
            console.error('❌ [Agendador] Erro no processamento do agendador:', erro);
        }
    });
}

module.exports = { iniciarAgendador };
