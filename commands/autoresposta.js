const { delay } = require('@whiskeysockets/baileys');

async function execute({ sock, msg, args, senderJid, chatJid, prefixo, db, autoRespostaSteps }) {
    const isGroup = chatJid.endsWith('@g.us');
    if (!isGroup) {
        return '❌ Este comando só pode ser usado em grupos.';
    }

    const fullText = args.join(' ');

    // Listar gatilhos
    if (!fullText || fullText.toLowerCase() === 'listar') {
        const triggers = db.listarAutoRespostas(chatJid);
        if (triggers.length === 0) {
            return 'ℹ️ Não há auto-respostas configuradas neste grupo.';
        }
        let response = '*Auto-Respostas Configuradas:*\n\n';
        triggers.forEach(t => {
            response += `🔹 *${t.gatilho}* ➡️ ${t.resposta.substring(0, 20)}${t.resposta.length > 20 ? '...' : ''}\n`;
        });
        return response;
    }

    // Remover gatilho
    if (fullText.toLowerCase().startsWith('remover ') || fullText.toLowerCase().startsWith('deletar ')) {
        const triggerToRemove = fullText.split(' ').slice(1).join(' ').toLowerCase();
        const result = db.removerAutoResposta(triggerToRemove, chatJid);
        if (result.changes > 0) {
            return `✅ Auto-resposta para *"${triggerToRemove}"* removida com sucesso.`;
        } else {
            return `❌ Gatilho *"${triggerToRemove}"* não encontrado.`;
        }
    }

    // Adicionar gatilho (Lógica Flexível)
    let trigger = '';
    let responseText = '';

    // 1. Tenta separar por pipe (|)
    if (fullText.includes('|')) {
        const parts = fullText.split('|');
        trigger = parts[0].trim().toLowerCase();
        responseText = parts.slice(1).join('|').trim();
    }
    // 2. Tenta separar por vírgula (,) - apenas a primeira
    else if (fullText.includes(',')) {
        const parts = fullText.split(',');
        trigger = parts[0].trim().toLowerCase();
        responseText = parts.slice(1).join(',').trim();
    }
    // 3. Se não tiver separador, assume que é fluxo interativo
    else {
        trigger = fullText.trim().toLowerCase();
        // Salva o estado e pede a resposta
        autoRespostaSteps.set(senderJid, { trigger, chatJid });
        return `Qual a resposta para o gatilho *"${trigger}"*?\n\n_Responda com a mensagem que o bot deve enviar._`;
    }

    if (!trigger) {
        return '❌ Gatilho inválido.';
    }

    if (!responseText) {
        // Caso tenha separador mas sem resposta (ex: "gatilho | ")
        return '❌ A resposta não pode ser vazia.';
    }

    try {
        db.adicionarAutoResposta(trigger, responseText, chatJid, senderJid);
        return `✅ Auto-resposta configurada!\n\n🗣️ *Gatilho:* "${trigger}"\n🤖 *Resposta:* "${responseText}"`;
    } catch (error) {
        console.error('Erro ao salvar auto-resposta:', error);
        return '❌ Erro ao salvar auto-resposta. Tente novamente.';
    }
}

module.exports = {
    name: 'autoresposta',
    description: 'Cria respostas automáticas para o grupo.',
    aliases: ['gatilho', 'gerargatilho'],
    category: 'adm',
    permission: 'admin', // Apenas admins podem criar gatilhos para evitar spam
    execute
};
