const cron = require('node-cron');
const { canSendMessages } = require('../utils/connectionStatus');

function iniciarAgendamentos(sock, db) {
    console.log('[Scheduler] Iniciando serviço de agendamento de listas...');

    // 1. Reset automático à meia-noite (00:00)
    // Expressão cron: 0 0 * * * (Minuto 0, Hora 0, Qualquer dia, Qualquer mês, Qualquer dia da semana)
    cron.schedule('0 0 * * *', () => {
        console.log('[Scheduler] Executando reset diário de listas...');
        try {
            const count = db.list.resetarListasAtivas();
            console.log(`[Scheduler] Reset concluído. ${count} listas foram encerradas.`);
        } catch (error) {
            console.error('[Scheduler] Erro ao resetar listas:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });

    // 2. Envio automático e Abertura automática
    // Verifica a cada minuto
    cron.schedule('* * * * *', async () => {
        // Verifica se o bot está conectado antes de processar agendamentos
        if (!canSendMessages(sock)) {
            console.log('⚠️ [Scheduler] Bot desconectado - Pulando verificação de listas agendadas');
            return;
        }

        // Obtém a data/hora atual no fuso horário de São Paulo
        const agora = new Date();
        const agoraSaoPaulo = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

        // Formata hora atual para HH:MM
        const horas = String(agoraSaoPaulo.getHours()).padStart(2, '0');
        const minutos = String(agoraSaoPaulo.getMinutes()).padStart(2, '0');
        const horarioAtual = `${horas}:${minutos}`;
        const diaSemana = agoraSaoPaulo.getDay(); // 0 (Dom) a 6 (Sab)

        try {
            // --- ENVIO AUTOMÁTICO ---
            const gruposEnvio = db.list.obterGruposComEnvioAtivo();

            for (const config of gruposEnvio) {
                if (config.horario_envio === horarioAtual) {
                    // Verifica dias de envio
                    const diasConfigurados = config.dias_envio ? config.dias_envio.split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6]; // Padrão: todos os dias se null

                    if (diasConfigurados.includes(diaSemana)) {
                        const chatJid = config.id_grupo;
                        const listaAtiva = db.list.obterListaAtiva(chatJid);

                        if (listaAtiva) {
                            console.log(`[Scheduler] Enviando lista automática para o grupo ${chatJid}...`);
                            await enviarListaAtualizada(sock, chatJid, db, listaAtiva.id);
                        } else {
                            // Registra erro no histórico (lista não encontrada/ativa)
                            db.list.registrarEnvioLista(chatJid, false, 'Nenhuma lista ativa encontrada no momento do envio.');
                        }
                    }
                }
            }

            // --- ABERTURA AUTOMÁTICA ---
            const gruposAbertura = db.list.obterGruposComAberturaAtiva();

            for (const config of gruposAbertura) {
                // Verifica horário
                if (config.horario_abertura === horarioAtual) {
                    // Verifica dias (padrão 1,2,3,4,5 se null)
                    const diasConfigurados = config.dias_abertura ? config.dias_abertura.split(',').map(Number) : [1, 2, 3, 4, 5];

                    if (diasConfigurados.includes(diaSemana)) {
                        const chatJid = config.id_grupo;

                        // Verifica se já existe lista ativa
                        const listaAtiva = db.list.obterListaAtiva(chatJid);
                        if (!listaAtiva) {
                            console.log(`[Scheduler] Abrindo lista automática para ${chatJid}...`);

                            const tituloPadrao = db.list.obterTituloPadraoLista(chatJid) || "Lista do Dia";
                            // Usamos o ID do bot como criador se possível, ou um placeholder
                            const botId = sock.user?.id || 'sistema';

                            db.list.criarLista(chatJid, tituloPadrao, botId);
                            const novaLista = db.list.obterListaAtiva(chatJid);

                            await enviarListaAtualizada(sock, chatJid, db, novaLista.id);

                            await sock.sendMessage(chatJid, {
                                text: '✅ Lista aberta automaticamente!'
                            });
                        }
                    }
                }
            }

        } catch (error) {
            console.error('[Scheduler] Erro ao processar agendamentos:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });

    console.log('[Scheduler] Agendamentos configurados com sucesso.');
}

// Função auxiliar para enviar a lista
async function enviarListaAtualizada(sock, chatJid, db, idLista) {
    // Verifica conexão antes de enviar
    if (!canSendMessages(sock)) {
        console.warn(`⚠️ [Scheduler] Não foi possível enviar lista - Bot desconectado`);
        return;
    }

    const lista = db.list.obterListaAtiva(chatJid);
    if (!lista) return;

    const membros = db.list.obterMembrosLista(lista.id);

    const dataCriacao = new Date(lista.data_criacao);
    const dataFormatada = dataCriacao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let mensagem = `📋 *${lista.titulo.toUpperCase()}*\n`;
    mensagem += `📅 ${dataFormatada}\n\n`;

    if (membros.length === 0) {
        mensagem += "_A lista está vazia._\n";
    } else {
        for (let i = 0; i < membros.length; i++) {
            const membro = membros[i];
            const usuarioDb = db.user.obterUsuario(membro.id_usuario);
            const numero = membro.id_usuario.split(':')[0].replace('@s.whatsapp.net', '');
            const nome = usuarioDb?.nome || numero;

            mensagem += `${i + 1}. ${nome}\n`;
        }
    }

    mensagem += `\n━━━━━━━━━━━━━━━━━━━\n`;
    mensagem += `ℹ️ Para entrar: !l seu nome\n`;
    mensagem += `ℹ️ Para sair: !l sair`;

    try {
        await sock.sendMessage(chatJid, { text: mensagem });
        console.log(`✅ [Scheduler] Lista enviada com sucesso para ${chatJid}`);
        db.list.registrarEnvioLista(chatJid, true); // Registra sucesso
    } catch (e) {
        console.error(`❌ [Scheduler] Falha ao enviar mensagem para ${chatJid}:`, e.message);
        db.list.registrarEnvioLista(chatJid, false, e.message); // Registra erro
    }
}

module.exports = { iniciarAgendamentos };
