module.exports = async (context, next) => {
    const { db, senderJid, msg, message, isGroup, chatJid } = context;

    // Ignorar mensagens próprias e broadcasts de status
    if (!msg.key.fromMe && senderJid && msg.key.remoteJid !== 'status@broadcast') {

        // Incrementar contador de mensagens processadas
        db.config.incrementarContador('total_mensagens');

        // Salvar ou atualizar usuário (usando o senderJid real)
        let usuario = db.user.obterUsuario(senderJid);
        if (!usuario) {
            // Novo usuário
            db.user.salvarUsuario(senderJid, msg.pushName || null, []);
            usuario = db.user.obterUsuario(senderJid);
            // Incrementar contador de usuários ativos
            db.config.incrementarContador('usuarios_ativos');
        }

        // Adiciona o usuário ao contexto para uso nos comandos
        context.usuario = usuario;

        // Atualizar histórico de interações
        const historico = usuario.historico_interacoes || [];
        historico.push({
            timestamp: new Date().toISOString(),
            mensagem: message || '[Mensagem com anexo]',
            tipo: 'recebida'
        });

        // Manter apenas as últimas 100 interações
        if (historico.length > 100) {
            historico.splice(0, historico.length - 100);
        }

        db.user.atualizarHistoricoUsuario(senderJid, historico);

        // Registrar atividade no grupo (para !ranking e !fantasmas)
        if (isGroup) {
            db.groupInteraction.registrarAtividadeGrupo(chatJid, senderJid);
        }
    }

    await next();
};
