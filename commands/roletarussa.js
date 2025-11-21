module.exports = {
    name: 'roletarussa',
    aliases: ['rr'],
    description: 'Desafie um membro para a roleta russa. (!roletarussa @membro)',
    category: 'Jogos',
    permission: 'admin',
    async execute({ sock, msg, chatJid, senderJid, args, db, roletaRussaGames, getPermissionLevel }) {
        if (!chatJid.endsWith('@g.us')) {
            return 'Este jogo só pode ser jogado em grupos.'
        }

        if (roletaRussaGames.has(chatJid)) {
            const currentGame = roletaRussaGames.get(chatJid)
            return `Calma! Já tem uma roleta russa em andamento neste grupo com o jogador @${currentGame.playerJid.split('@')[0]}.`
        }

        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        if (mentionedJids.length === 0) {
            return 'Você precisa marcar um jogador para desafiar! Ex: `!rr @usuario`'
        }

        const targetJid = mentionedJids[0]

        if (targetJid === senderJid) {
            return 'Você não pode jogar roleta russa consigo mesmo, covarde! 😝'
        }
        if (targetJid === sock.user.id.split(':')[0] + '@s.whatsapp.net') {
            return 'Eu? Eu sou a casa, eu não jogo. 🎲'
        }

        // Verifica se o alvo é admin
        const targetPermission = await getPermissionLevel(sock, targetJid)
        if (targetPermission === 'admin' || targetPermission === 'owner') {
            return 'HAHAHA, achou mesmo que poderia desafiar um dos Deuses deste grupo? Tente com um mero mortal.'
        }

        const bullet = Math.floor(Math.random() * 6) + 1
        const playerJid = targetJid

        // Inicia o timeout de 1 minuto
        const timeoutId = setTimeout(async () => {
            if (roletaRussaGames.has(chatJid)) {
                await sock.sendMessage(chatJid, { 
                    text: `O tempo acabou! ⏳ @${playerJid.split('@')[0]} hesitou demais e a pressão foi insuportável... Adeus!`,
                    mentions: [playerJid]
                })
                try {
                    await sock.groupParticipantsUpdate(chatJid, [playerJid], 'remove')
                } catch (e) {
                    console.error("Erro ao remover por timeout na roleta russa:", e)
                    await sock.sendMessage(chatJid, { text: 'Eu ia remover, mas parece que estou sem poderes para isso. Sorte a sua... por agora.' })
                }
                roletaRussaGames.delete(chatJid)
            }
        }, 60000) // 60 segundos

        // Salva o estado do jogo
        roletaRussaGames.set(chatJid, { playerJid, bullet, timeoutId })

        // Envia a mensagem de desafio
        await sock.sendMessage(chatJid, {
            text: `Olá, @${playerJid.split('@')[0]}! 😈\n\nVocê foi escolhido para jogar a Roleta Russa. Eu tenho um revólver com 6 câmaras e apenas uma bala. Escolha um número de 1 a 6 e me diga qual. Você tem 1 minuto para responder...\n\nTic, tac... ⏰`,
            mentions: [playerJid]
        })
    },
}