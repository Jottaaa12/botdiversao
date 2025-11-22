module.exports = {
    name: 'lista_horario',
    aliases: [],
    category: 'grupo',
    description: 'Define o horário de envio automático da lista',
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
                text: '❌ Você precisa fornecer um horário!\n\n⏰ Uso: !lista_horario HH:MM\n\nExemplos:\n• !lista_horario 14:20\n• !lista_horario 09:00'
            });
            return;
        }

        const horario = args[0];

        // Valida formato HH:MM
        const regexHorario = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
        if (!regexHorario.test(horario)) {
            await sock.sendMessage(chatJid, {
                text: '❌ Formato de horário inválido!\n\n⏰ Use o formato HH:MM (24 horas)\n\nExemplos válidos:\n• 14:20\n• 09:00\n• 23:59'
            });
            return;
        }

        try {
            db.definirHorarioEnvioLista(chatJid, horario);

            await sock.sendMessage(chatJid, {
                text: `✅ Horário de envio configurado!\n\n⏰ A lista será enviada automaticamente todos os dias às ${horario}\n🔄 Reset automático: 00:00 (meia-noite)`
            });
        } catch (error) {
            console.error('[lista_horario] Erro:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Erro ao configurar horário. Tente novamente.'
            });
        }
    }
};
