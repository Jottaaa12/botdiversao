const { delay } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'leave',
    aliases: ['saia', 'sair', 'vazar'],
    category: 'adm',
    description: 'Faz o bot sair do grupo com uma mensagem de despedida',
    permission: 'owner',
    async execute({ sock, chatJid, isGroup }) {
        // Verifica se é um grupo
        if (!isGroup) {
            await sock.sendMessage(chatJid, {
                text: '❌ Este comando só pode ser usado em grupos.'
            });
            return;
        }

        try {
            // Lista de mensagens engraçadas de despedida (escolhe uma aleatória)
            const mensagensDespedida = [
                '👋 Tchau, tchau! Foi divertido enquanto durou... ou não! 😂\n\n🚪 Estou saindo deste grupo. Até a próxima! 🏃‍♂️💨',
                '🎭 Minha missão aqui está completa!\n\n👋 Adeus, humanos! Vou para outro grupo fazer bagunça! 🤖✨',
                '🌟 Vocês foram ótimos... mas eu fui melhor! 😎\n\n👋 Flw, galera! Até mais! 🚀',
                '💔 Não é você... sou eu!\n\n👋 Brincadeira, é você mesmo! Tchau! 😂🏃‍♂️',
                '🎪 O show acabou, pessoal!\n\n👋 Estou indo embora. Foi uma honra servir vocês! 🎩✨',
                '🦸‍♂️ Meu planeta precisa de mim!\n\n👋 Tenho que ir. Adeus, terráqueos! 🚀🌍',
                '🎬 E... corta!\n\n👋 Essa foi minha última cena neste grupo. Até logo! 🎥',
                '🏖️ Vou tirar férias!\n\n👋 Preciso de um descanso de vocês... ops, digo, do trabalho! 😅✌️',
                '🎵 Tá na hora, tá na hora, tá na hora de ir embora! 🎶\n\n👋 Tchau, galera! Foi massa! 🎉',
                '🤖 Erro 404: Bot não encontrado neste grupo!\n\n👋 Estou saindo... Adeus! 🚪💨'
            ];

            // Escolhe uma mensagem aleatória
            const mensagemAleatoria = mensagensDespedida[Math.floor(Math.random() * mensagensDespedida.length)];

            // Envia a mensagem de despedida
            await sock.sendMessage(chatJid, {
                text: mensagemAleatoria
            });

            // Aguarda 2 segundos para a mensagem ser lida
            await delay(2000);

            // Sai do grupo
            await sock.groupLeave(chatJid);

            console.log(`[Leave] Bot saiu do grupo ${chatJid} com sucesso.`);

        } catch (error) {
            console.error('[Leave] Erro ao sair do grupo:', error);
            await sock.sendMessage(chatJid, {
                text: '❌ Ops! Não consegui sair do grupo. Talvez eu não tenha permissão ou ocorreu um erro.'
            });
        }
    }
};
