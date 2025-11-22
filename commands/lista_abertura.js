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

        // Verifica se foi fornecido um horário
        if (args.length === 0) {
            await sock.sendMessage(chatJid, {
                text: '❌ Você precisa fornecer um horário!\n\n⏰ Uso: !lista_abertura HH:MM [dias]\n\nExemplos:\n• !lista_abertura 08:00 seg-sex\n• !lista_abertura 09:00 todos'
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
        // node-cron usa 0-6 (Domingo-Sábado) ou nomes em inglês
        // Vamos salvar como string de números para facilitar: "1,2,3,4,5"
        let diasNumeros = '';

        if (dias === 'todos' || dias === 'diario') {
            diasNumeros = '0,1,2,3,4,5,6';
        } else if (dias === 'seg-sex' || dias === 'semana') {
            diasNumeros = '1,2,3,4,5';
        } else if (dias === 'fimdesemana' || dias === 'fds') {
            diasNumeros = '0,6';
        } else {
            // Tenta interpretar dias específicos? Por enquanto vamos simplificar.
            // Se não reconhecer, assume seg-sex e avisa
            diasNumeros = '1,2,3,4,5';
            await sock.sendMessage(chatJid, {
                text: '⚠️ Dias não reconhecidos. Configurando para Segunda a Sexta.\nUse: todos, seg-sex, ou fds.'
            });
        }

        try {
            db.definirHorarioAberturaLista(chatJid, horario, diasNumeros);

            const mapaDias = {
                '0,1,2,3,4,5,6': 'Todos os dias',
                '1,2,3,4,5': 'Segunda a Sexta',
                '0,6': 'Fim de Semana'
            };

            await sock.sendMessage(chatJid, {
                text: `✅ Abertura automática configurada!\n\n⏰ Horário: ${horario}\n📅 Dias: ${mapaDias[diasNumeros]}\n\nA lista será criada automaticamente nestes dias e horários.`
            });
        } catch (error) {
            console.error('[lista_abertura] Erro:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Erro ao configurar abertura automática. Tente novamente.'
            });
        }
    }
};
