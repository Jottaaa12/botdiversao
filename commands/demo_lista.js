const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    name: 'demo_lista',
    aliases: ['demonstracao_lista'],
    category: 'adm',
    description: 'Demonstra o funcionamento completo do sistema de listas',
    permission: 'admin',
    async execute({ sock, chatJid, args }) {
        // Verifica se é um grupo
        if (!chatJid.endsWith('@g.us')) {
            await sock.sendMessage(chatJid, { text: '❌ Este comando só pode ser usado em grupos.' });
            return;
        }

        // Função auxiliar para simular digitação e enviar mensagem
        const enviarMensagemSimulada = async (texto, tempoDigitando = 2000) => {
            await sock.sendPresenceUpdate('composing', chatJid);
            await delay(tempoDigitando);
            await sock.sendPresenceUpdate('paused', chatJid);
            await sock.sendMessage(chatJid, { text: texto });
            await delay(1000);
        };

        // Início da demonstração
        await enviarMensagemSimulada('👋 Olá mestre! Vou demonstrar como funciona o sistema de listas do seu bot.', 2000);

        const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        // 1. CRIAR LISTA
        await enviarMensagemSimulada('📝 *PASSO 1: CRIAR UMA LISTA*\n\nQuando alguém digita *!lista* (ou *!l*), uma nova lista é criada automaticamente e a pessoa já entra nela:', 2500);
        await enviarMensagemSimulada('💻 Comando: *!lista*', 1500);

        let listaExemplo = `📋 *LISTA GERAL*\n📅 ${dataHoje}\n\n1. Pedro\n\n━━━━━━━━━━━━━━━━━━━\nℹ️ *!l [nome]* para entrar\nℹ️ *!l sair* para sair\nℹ️ *!l ajuda* para ver mais opções`;
        await enviarMensagemSimulada(listaExemplo, 1500);

        // 2. ADICIONAR MEMBROS
        await enviarMensagemSimulada('👥 *PASSO 2: ADICIONAR MEMBROS*\n\nOutras pessoas podem entrar digitando *!l* seguido do nome delas:', 2500);
        await enviarMensagemSimulada('💻 Comando: *!l João*\n💻 Comando: *!l Maria*', 1500);

        listaExemplo = `📋 *LISTA GERAL*\n📅 ${dataHoje}\n\n1. Pedro\n2. João\n3. Maria\n\n━━━━━━━━━━━━━━━━━━━\nℹ️ *!l [nome]* para entrar\nℹ️ *!l sair* para sair\nℹ️ *!l ajuda* para ver mais opções`;
        await enviarMensagemSimulada(listaExemplo, 1500);

        // 3. ADICIONAR NOME MANUAL
        await enviarMensagemSimulada('📝 *PASSO 3: ADICIONAR NOMES MANUAIS*\n\nPode adicionar pessoas que não estão no grupo usando *!l add*:', 2500);
        await enviarMensagemSimulada('💻 Comando: *!l add Carlos*', 1500);

        listaExemplo = `📋 *LISTA GERAL*\n📅 ${dataHoje}\n\n1. Pedro\n2. João\n3. Maria\n4. Carlos\n\n━━━━━━━━━━━━━━━━━━━\nℹ️ *!l [nome]* para entrar\nℹ️ *!l sair* para sair\nℹ️ *!l ajuda* para ver mais opções`;
        await enviarMensagemSimulada(listaExemplo, 1500);

        // 4. CHAMAR MEMBROS
        await enviarMensagemSimulada('📢 *PASSO 4: CHAMAR/MENCIONAR MEMBROS*\n\nVocê pode marcar todos ou alguém específico:', 2500);
        await enviarMensagemSimulada('💻 *!l chamar* → Marca todos\n💻 *!l chamar Vamos!* → Marca todos com mensagem\n💻 *!l chamar João Traz o carvão!* → Marca só o João', 2000);
        await enviarMensagemSimulada('📢 *ATENÇÃO @João!* 📢\n\nTraz o carvão!', 1500);

        // 5. REMOVER E SAIR
        await enviarMensagemSimulada('� *PASSO 5: SAIR OU REMOVER*\n\nQualquer um pode sair, mas só admins podem remover outros:', 2500);
        await enviarMensagemSimulada('💻 *!l sair* → Você sai da lista\n💻 *!l remover 3* → Admin remove o membro 3\n💻 *!l remover Maria* → Admin remove por nome', 2000);

        // 6. FECHAR LISTA
        await enviarMensagemSimulada('🔒 *PASSO 6: ENCERRAR LISTA*\n\nSó admins ou quem criou a lista podem encerrá-la:', 2500);
        await enviarMensagemSimulada('💻 Comando: *!l fechar*', 1500);
        await enviarMensagemSimulada('✅ Lista encerrada com sucesso!', 1000);

        // RESUMO FINAL
        await enviarMensagemSimulada('✨ *RESUMO DOS RECURSOS:*\n\n✅ Criação automática ao usar !lista\n✅ Menções funcionais (@nome)\n✅ Mensagens personalizadas\n✅ Adicionar nomes manuais\n✅ Comandos admin (remover/fechar)\n✅ Reset automático à meia-noite\n✅ Envio e abertura programada\n\n📚 Digite *!lista ajuda* para ver todos os comandos disponíveis!', 3000);
    }
};
