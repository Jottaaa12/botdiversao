const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'add',
    description: 'Adiciona um usuário ao grupo, tentando com e sem o 9º dígito.',
    aliases: ['adicionar'],
    category: 'adm',
    permission: 'user', // A verificação de admin do grupo é feita internamente

    /**
     * @param {object} context
     * @param {import('@whiskeysockets/baileys').WASocket} context.sock
     * @param {string[]} context.args
     * @param {string} context.chatJid
     * @param {string} context.senderJid
     */
    async execute({ sock, args, chatJid, senderJid, permissionLevel }) {
        // 1. Verificar se é um grupo
        if (!chatJid.endsWith('@g.us')) {
            return 'Este comando só pode ser usado em grupos.';
        }

        // 2. Validar input
        if (!args[0]) {
            return '🤖 Por favor, forneça o número de telefone que deseja adicionar.\n\n*Exemplo:* `!add 88912345678`';
        }

        // 3. Obter metadados e verificar permissões
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatJid);
        } catch (e) {
            console.error('[Comando Add] Erro ao obter metadados do grupo:', e);
            return 'Ocorreu um erro ao verificar as informações deste grupo.';
        }

        const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
        const isBotAdmin = permissionLevel === 'admin' || permissionLevel === 'owner';

        if (!senderParticipant?.admin && !isBotAdmin) {
            return '❌ Apenas administradores do grupo podem usar este comando.';
        }

        const botPnJid = jidNormalizedUser(sock.user.id);
        let botIsAdmin = false;
        for (const p of groupMetadata.participants) {
            if (p.admin) {
                let adminId = p.id;
                if (adminId.endsWith('@lid')) {
                    try {
                        const resolved = await sock.signalRepository.lidMapping.getPNForLID(adminId);
                        if (resolved) adminId = resolved;
                    } catch (e) { /* Ignora */ }
                }
                if (jidNormalizedUser(adminId) === botPnJid) {
                    botIsAdmin = true;
                    break;
                }
            }
        }
        if (!botIsAdmin) {
            return '❌ Eu preciso ser um administrador neste grupo para poder adicionar novos membros.';
        }

        // 4. Gerar variações do número
        const phoneInput = args[0].replace(/[^0-9]/g, '');
        const ddd = phoneInput.substring(0, 2);
        const numberPart = phoneInput.substring(2);

        let numbersToTry = [];
        if (numberPart.length === 9 && numberPart.startsWith('9')) {
            numbersToTry.push(phoneInput);
            numbersToTry.push(ddd + numberPart.substring(1));
        } else if (numberPart.length === 8) {
            numbersToTry.push(phoneInput);
            numbersToTry.push(ddd + '9' + numberPart);
        } else {
            numbersToTry.push(phoneInput);
        }

        // 5. Tentar adicionar cada variação
        for (const phone of numbersToTry) {
            const userJid = `55${phone}@s.whatsapp.net`;

            const [check] = await sock.onWhatsApp(userJid);
            if (!check?.exists) {
                console.log(`[Comando Add] Número ${phone} não existe no WhatsApp. Tentando a próxima variação...`);
                continue;
            }

            let wasSuccessful = false;

            try {
                const response = await sock.groupParticipantsUpdate(chatJid, [userJid], 'add');
                const result = response[0];

                // Se a API responder sem erro, verificamos o status
                if (result.status === '200') {
                    wasSuccessful = true;
                } else if (result.status === '409') {
                    return `ℹ️ O usuário @${phone} já está neste grupo.`;
                } else if (result.status === '403') {
                    await sock.sendMessage(chatJid, { text: `❌ Não foi possível adicionar @${phone}. O usuário tem restrições de privacidade.`, mentions: [userJid] });
                    return null;
                }

            } catch (error) {
                console.warn(`[Comando Add] Erro na API para ${phone} (código: ${error.data}). Verificando manualmente se o usuário foi adicionado...`);
                // Mesmo com erro, vamos verificar se funcionou (workaround para o 'bad-request')
                await new Promise(resolve => setTimeout(resolve, 1500)); // Espera 1.5s para o grupo atualizar
                const newMetadata = await sock.groupMetadata(chatJid);
                const isUserNowInGroup = newMetadata.participants.find(p => jidNormalizedUser(p.id) === jidNormalizedUser(userJid));

                if (isUserNowInGroup) {
                    console.log(`[Comando Add] Verificação manual confirmou a adição de ${phone}.`);
                    wasSuccessful = true;
                }
            }

            if (wasSuccessful) {
                await sock.sendMessage(chatJid, { text: `✅ Usuário @${phone} adicionado ao grupo!`, mentions: [userJid] });
                return null; // Sucesso, encerra a execução
            }
        }

        // Se o loop terminar sem sucesso
        return `❌ Falha ao adicionar. Nenhuma das tentativas funcionou. Verifique o número ou as permissões de privacidade do usuário.`;
    }
};
