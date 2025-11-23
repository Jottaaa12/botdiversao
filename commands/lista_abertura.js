module.exports = {
    name: 'lista_abertura',
    aliases: [],
    category: 'grupo',
    description: 'Define o horário e dias para abertura automática da lista',
    permission: 'admin',
    async execute({ sock, chatJid, args, db }) {
        // Verifica se é um grupo
        if (!chatJid.endsWith('@g.us')) {
            await sock.sendMessage(chatJid, {
                text: '❌ Este comando só pode ser usado em grupos.'
            });
            return;
        }

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
