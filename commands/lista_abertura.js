module.exports = {
    name: 'lista_abertura',
    aliases: [],
    category: 'grupo',
    description: 'Define o horário e dias para abertura automática da lista',
    permission: 'admin',
    async execute({ sock, chatJid, args, db, listaAberturaSteps, senderJid, isGroup, permissionLevel }) {

        // --- LÓGICA PV (CHAT PRIVADO) ---
        if (!isGroup) {
            // Verifica permissão (apenas admin/owner)
            if (permissionLevel !== 'admin' && permissionLevel !== 'owner') {
                return '❌ Você não tem permissão para usar este comando.';
            }

            // Se estiver em um fluxo interativo
            if (listaAberturaSteps.has(senderJid)) {
                return processarPassoInterativo(sock, args, senderJid, chatJid, db, listaAberturaSteps);
            }

            const subcomando = args[0] ? args[0].toLowerCase() : null;

            // --- SUBCOMANDO: STATUS GLOBAL ---
            if (subcomando === 'status' || subcomando === 'ver' || subcomando === 'info') {
                const gruposAtivos = db.list.obterGruposComAberturaAtiva();

                if (gruposAtivos.length === 0) {
                    return 'ℹ️ Nenhum grupo com abertura automática ativa no momento.';
                }

                const mapaDias = {
                    '0,1,2,3,4,5,6': 'Todos os dias',
                    '1,2,3,4,5': 'Segunda a Sexta',
                    '0,6': 'Fim de Semana'
                };

                let resposta = '📋 *GRUPOS COM ABERTURA AUTOMÁTICA ATIVA:*\n\n';
                for (const g of gruposAtivos) {
                    let nomeGrupo = g.id_grupo;
                    try {
                        const metadata = await sock.groupMetadata(g.id_grupo);
                        nomeGrupo = metadata.subject;
                    } catch (e) { /* Ignora erro ao buscar nome */ }

                    const diasTexto = mapaDias[g.dias_abertura] || g.dias_abertura;
                    resposta += `🔹 *${nomeGrupo}*\n   ⏰ Horário: ${g.horario_abertura}\n   📅 Dias: ${diasTexto}\n   🆔 ID: ${g.id_grupo}\n\n`;
                }
                return resposta;
            }

            // --- INÍCIO DO FLUXO INTERATIVO ---
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupsList = Object.values(groups).map(g => ({ id: g.id, subject: g.subject }));

                if (groupsList.length === 0) {
                    return '❌ Não encontrei nenhum grupo onde eu sou participante.';
                }

                listaAberturaSteps.set(senderJid, {
                    step: 'selecionar_grupo',
                    gruposDisponiveis: groupsList
                });

                let msg = '🤖 *CONFIGURAR ABERTURA AUTOMÁTICA*\n\nSelecione o grupo onde deseja configurar:\n\n';
                groupsList.forEach((g, index) => {
                    msg += `${index + 1} - ${g.subject}\n`;
                });
                msg += '\n_Responda com o número do grupo ou "cancelar" para sair._';

                await sock.sendMessage(chatJid, { text: msg });
                return;

            } catch (error) {
                console.error('Erro ao buscar grupos:', error);
                return '❌ Erro ao buscar lista de grupos.';
            }
        }

        // --- LÓGICA DE GRUPO (MANTIDA) ---

        const subcomando = args[0] ? args[0].toLowerCase() : null;

        // --- SUBCOMANDO: STATUS ---
        if (subcomando === 'status' || subcomando === 'ver' || subcomando === 'info') {
            const config = db.list.obterHorarioAberturaLista(chatJid);

            if (!config || !config.horario) {
                await sock.sendMessage(chatJid, {
                    text: '❌ Não há abertura automática configurada para este grupo.\n\n💡 Use: !lista_abertura HH:MM [dias]\n\nExemplo: !lista_abertura 08:00 seg-sex'
                });
                return;
            }

            const mapaDias = {
                '0,1,2,3,4,5,6': 'Todos os dias',
                '1,2,3,4,5': 'Segunda a Sexta',
                '0,6': 'Fim de Semana'
            };

            const diasTexto = mapaDias[config.dias] || config.dias;

            // Verifica se está ativa
            const configCompleta = db.list.obterGruposComAberturaAtiva().find(c => c.id_grupo === chatJid);
            const statusAtivo = configCompleta ? '✅ Ativa' : '⏸️ Pausada';

            await sock.sendMessage(chatJid, {
                text: `📊 *STATUS DA ABERTURA AUTOMÁTICA*\n\n⏰ Horário: ${config.horario}\n📅 Dias: ${diasTexto}\n${statusAtivo}\n\n━━━━━━━━━━━━━━━━━━━\n💡 Comandos disponíveis:\n• !lista_abertura pausar\n• !lista_abertura reativar\n• !lista_abertura cancelar`
            });
            return;
        }

        // --- SUBCOMANDO: PAUSAR ---
        if (subcomando === 'pausar' || subcomando === 'pause') {
            const config = db.list.obterHorarioAberturaLista(chatJid);

            if (!config || !config.horario) {
                await sock.sendMessage(chatJid, {
                    text: '❌ Não há abertura automática configurada para pausar.'
                });
                return;
            }

            const resultado = db.list.pausarAberturaLista(chatJid);

            if (resultado) {
                await sock.sendMessage(chatJid, {
                    text: '⏸️ Abertura automática pausada!\n\n✅ A configuração foi mantida.\n💡 Use !lista_abertura reativar para reativar.'
                });
            } else {
                await sock.sendMessage(chatJid, {
                    text: '❌ Erro ao pausar abertura automática.'
                });
            }
            return;
        }

        // --- SUBCOMANDO: REATIVAR ---
        if (subcomando === 'reativar' || subcomando === 'ativar' || subcomando === 'retomar') {
            const config = db.list.obterHorarioAberturaLista(chatJid);

            if (!config || !config.horario) {
                await sock.sendMessage(chatJid, {
                    text: '❌ Não há configuração de abertura para reativar.\n\n💡 Configure primeiro: !lista_abertura HH:MM [dias]'
                });
                return;
            }

            const resultado = db.list.reativarAberturaLista(chatJid);

            if (resultado) {
                const mapaDias = {
                    '0,1,2,3,4,5,6': 'Todos os dias',
                    '1,2,3,4,5': 'Segunda a Sexta',
                    '0,6': 'Fim de Semana'
                };

                await sock.sendMessage(chatJid, {
                    text: `✅ Abertura automática reativada!\n\n⏰ Horário: ${config.horario}\n📅 Dias: ${mapaDias[config.dias] || config.dias}\n\nA lista será criada automaticamente.`
                });
            } else {
                await sock.sendMessage(chatJid, {
                    text: '❌ Erro ao reativar abertura automática.'
                });
            }
            return;
        }

        // --- SUBCOMANDO: CANCELAR ---
        if (subcomando === 'cancelar' || subcomando === 'desativar' || subcomando === 'remover') {
            const config = db.list.obterHorarioAberturaLista(chatJid);

            if (!config || !config.horario) {
                await sock.sendMessage(chatJid, {
                    text: '❌ Não há abertura automática configurada para cancelar.'
                });
                return;
            }

            const resultado = db.list.cancelarAberturaLista(chatJid);

            if (resultado) {
                await sock.sendMessage(chatJid, {
                    text: '🗑️ Abertura automática cancelada!\n\n✅ Toda a configuração foi removida.\n💡 Configure novamente: !lista_abertura HH:MM [dias]'
                });
            } else {
                await sock.sendMessage(chatJid, {
                    text: '❌ Erro ao cancelar abertura automática.'
                });
            }
            return;
        }

        // --- CONFIGURAÇÃO DE HORÁRIO ---
        // Verifica se foi fornecido um horário
        if (!subcomando) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você precisa fornecer um horário ou subcomando!\n\n⏰ Uso: !lista_abertura HH:MM [dias]\n\nExemplos:\n• !lista_abertura 08:00 seg-sex\n• !lista_abertura 09:00 todos\n\nSubcomandos:\n• !lista_abertura status\n• !lista_abertura pausar\n• !lista_abertura reativar\n• !lista_abertura cancelar'
            });
            return;
        }

        const horario = args[0];
        let dias = args[1] ? args[1].toLowerCase() : 'seg-sex'; // Padrão: segunda a sexta

        // Valida formato HH:MM
        const regexHorario = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
        if (!regexHorario.test(horario)) {
            await sock.sendMessage(chatJid, {
                text: '❌ Formato de horário inválido!\n\n⏰ Use o formato HH:MM (24 horas)\n\nExemplos válidos:\n• 08:00\n• 14:30'
            });
            return;
        }

        // Mapeia dias para números (0-6, onde 0 é domingo)
        let diasNumeros = '';

        if (dias === 'todos' || dias === 'diario') {
            diasNumeros = '0,1,2,3,4,5,6';
        } else if (dias === 'seg-sex' || dias === 'semana') {
            diasNumeros = '1,2,3,4,5';
        } else if (dias === 'fimdesemana' || dias === 'fds') {
            diasNumeros = '0,6';
        } else {
            // Se não reconhecer, assume seg-sex e avisa
            diasNumeros = '1,2,3,4,5';
            await sock.sendMessage(chatJid, {
                text: '⚠️ Dias não reconhecidos. Configurando para Segunda a Sexta.\nUse: todos, seg-sex, ou fds.'
            });
        }

        try {
            db.list.definirHorarioAberturaLista(chatJid, horario, diasNumeros);

            const mapaDias = {
                '0,1,2,3,4,5,6': 'Todos os dias',
                '1,2,3,4,5': 'Segunda a Sexta',
                '0,6': 'Fim de Semana'
            };

            await sock.sendMessage(chatJid, {
                text: `✅ Abertura automática configurada!\n\n⏰ Horário: ${horario}\n📅 Dias: ${mapaDias[diasNumeros]}\n\nA lista será criada automaticamente nestes dias e horários.\n\n━━━━━━━━━━━━━━━━━━━\n💡 Comandos úteis:\n• !lista_abertura status - Ver configuração\n• !lista_abertura pausar - Pausar temporariamente\n• !lista_abertura cancelar - Remover configuração`
            });
        } catch (error) {
            console.error('[lista_abertura] Erro:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Erro ao configurar abertura automática. Tente novamente.'
            });
        }
    }
};

async function processarPassoInterativo(sock, args, senderJid, chatJid, db, listaAberturaSteps) {
    const estado = listaAberturaSteps.get(senderJid);
    const textoUsuario = args.join(' ');

    // Cancelamento
    if (textoUsuario.toLowerCase() === 'cancelar') {
        listaAberturaSteps.delete(senderJid);
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
        listaAberturaSteps.set(senderJid, estado);

        return `✅ Grupo selecionado: *${grupoSelecionado.subject}*\n\nAgora, digite o *horário* de abertura (formato HH:MM, ex: 08:00):`;
    }

    // --- PASSO: DEFINIR HORÁRIO ---
    if (estado.step === 'definir_horario') {
        const horarioRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
        if (!horarioRegex.test(textoUsuario)) {
            return '❌ Formato inválido. Use HH:MM (ex: 08:00).';
        }

        estado.horario = textoUsuario;
        estado.step = 'selecionar_dias';
        listaAberturaSteps.set(senderJid, estado);

        return `⏰ Horário definido: *${textoUsuario}*\n\nAgora selecione os dias:\n\n• *todos* (Todos os dias)\n• *seg-sex* (Segunda a Sexta)\n• *fds* (Fim de semana)\n\nDigite uma das opções acima:`;
    }

    // --- PASSO: SELECIONAR DIAS ---
    if (estado.step === 'selecionar_dias') {
        let diasNumeros = '';
        const dias = textoUsuario.toLowerCase();

        if (dias === 'todos' || dias === 'diario') {
            diasNumeros = '0,1,2,3,4,5,6';
        } else if (dias === 'seg-sex' || dias === 'semana') {
            diasNumeros = '1,2,3,4,5';
        } else if (dias === 'fimdesemana' || dias === 'fds') {
            diasNumeros = '0,6';
        } else {
            return '❌ Opção inválida. Use: todos, seg-sex, ou fds.';
        }

        return finalizarConfiguracao(estado, db, listaAberturaSteps, senderJid, diasNumeros);
    }
}

function finalizarConfiguracao(estado, db, listaAberturaSteps, senderJid, diasNumeros) {
    try {
        db.list.definirHorarioAberturaLista(estado.chatJid, estado.horario, diasNumeros);
        listaAberturaSteps.delete(senderJid);

        const mapaDias = {
            '0,1,2,3,4,5,6': 'Todos os dias',
            '1,2,3,4,5': 'Segunda a Sexta',
            '0,6': 'Fim de Semana'
        };

        return `✅ *CONFIGURAÇÃO SALVA COM SUCESSO!* 🎉\n\n` +
            `🆔 Grupo: ${estado.nomeGrupo}\n` +
            `⏰ Horário: ${estado.horario}\n` +
            `📅 Dias: ${mapaDias[diasNumeros]}\n\n` +
            `A lista será aberta automaticamente nestes dias e horário.`;
    } catch (error) {
        console.error('Erro ao salvar lista abertura:', error);
        listaAberturaSteps.delete(senderJid);
        return '❌ Ocorreu um erro ao salvar a configuração.';
    }
}
