const { delay } = require('@whiskeysockets/baileys');

// Lista de palavras para o jogo
const palavras = [
    'abacaxi', 'banana', 'computador', 'desenvolvimento', 'elefante',
    'futebol', 'girafa', 'hipopotamo', 'internet', 'jacare',
    'kiwi', 'limao', 'macaco', 'navio', 'oculos',
    'pato', 'queijo', 'rato', 'sapo', 'tigre',
    'uva', 'vaca', 'xadrez', 'zebra', 'brasil',
    'programacao', 'javascript', 'bot', 'whatsapp', 'inteligencia',
    'guitarra', 'bateria', 'floresta', 'montanha', 'oceano',
    'planeta', 'universo', 'galaxia', 'estrela', 'lua',
    'sol', 'chuva', 'vento', 'fogo', 'agua',
    'terra', 'arvore', 'flor', 'jardim', 'parque',
    'escola', 'universidade', 'livro', 'caderno', 'caneta',
    'lapis', 'borracha', 'mesa', 'cadeira', 'sofa',
    'cama', 'travesseiro', 'cobertor', 'janela', 'porta',
    'casa', 'predio', 'cidade', 'estado', 'pais',
    'continente', 'mundo', 'pessoa', 'homem', 'mulher',
    'crianca', 'bebe', 'idoso', 'familia', 'amigo',
    'amor', 'felicidade', 'tristeza', 'raiva', 'medo',
    'coragem', 'esperanca', 'sonho', 'pesadelo', 'vida'
];

// Desenhos da forca (ASCII Art com emoji apenas na cabeça)
const boneco = [
    `
  +---+
  |   |
      |
      |
      |
      |
=========`,
    `
  +---+
  |   |
  😵  |
      |
      |
      |
=========`,
    `
  +---+
  |   |
  😵  |
  |   |
      |
      |
=========`,
    `
  +---+
  |   |
  😵  |
 /|   |
      |
      |
=========`,
    `
  +---+
  |   |
  😵  |
 /|\\  |
      |
      |
=========`,
    `
  +---+
  |   |
  😵  |
 /|\\  |
 /    |
      |
=========`,
    `
  +---+
  |   |
  💀  |
 /|\\  |
 / \\  |
      |
=========`,
];

// Função para normalizar strings (remover acentos)
function normalize(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function execute({ sock, msg, args, chatJid, commandName, forcaGames, senderJid, prefixo }) {
    const cmd = commandName.toLowerCase();

    // --- COMANDOS DE AJUDA ---
    if (['regrasforca', 'ajudaforca', 'hf'].includes(cmd)) {
        const helpText = `
🎮 *JOGO DA FORCA* 🎮

Comandos disponíveis:

*Iniciar o jogo:*
!forca, !f, !jogarforca, !game

*Chutar uma letra:*
!letra [letra], !l [letra], !chute [letra]

*Arriscar a palavra:*
!palavra [texto], !p [texto], !arriscar [texto]

*Ver status:*
!status, !ver, !boneco

*Parar o jogo:*
!encerrar, !desistir, !cancelar
`;
        await sock.sendMessage(chatJid, { text: helpText });
        return;
    }

    // --- COMANDOS DE INÍCIO ---
    if (['forca', 'f', 'jogarforca', 'game'].includes(cmd)) {
        if (forcaGames.has(chatJid)) {
            return '❌ Já existe um jogo da forca em andamento neste grupo! Use !status para ver o progresso ou !cancelar para parar.';
        }

        const palavraOriginal = palavras[Math.floor(Math.random() * palavras.length)];
        const palavraLimpa = normalize(palavraOriginal);

        const gameState = {
            palavraOriginal,
            palavraLimpa,
            letrasDescobertas: new Set(),
            letrasErradas: new Set(),
            erros: 0,
            maxErros: 6,
            status: 'playing'
        };

        // Revelar hífens ou espaços se houver (embora nossa lista seja palavras simples)
        for (let i = 0; i < palavraLimpa.length; i++) {
            if (palavraLimpa[i] === '-' || palavraLimpa[i] === ' ') {
                gameState.letrasDescobertas.add(palavraLimpa[i]);
            }
        }

        forcaGames.set(chatJid, gameState);

        const displayWord = palavraOriginal.split('').map(char =>
            gameState.letrasDescobertas.has(normalize(char)) ? char : '_'
        ).join(' ');

        await sock.sendMessage(chatJid, {
            text: `🎮 *JOGO DA FORCA INICIADO!* 🎮\n\n${boneco[0]}\n\nPalavra: ${displayWord}\n\nDica: A palavra tem ${palavraOriginal.length} letras.\nUse ${prefixo}letra [letra] para chutar!`
        });
        return;
    }

    // --- VERIFICAÇÃO DE JOGO ATIVO ---
    const game = forcaGames.get(chatJid);
    if (!game) {
        // Se tentou usar um comando de jogo mas não tem jogo ativo
        if (['letra', 'l', 'tentar', 'chute', 'palavra', 'p', 'chutar', 'arriscar', 'resposta', 'status', 'ver', 'boneco', 'progresso', 'tabuleiro', 'encerrar', 'desistir', 'parar', 'resetforca', 'cancelar'].includes(cmd)) {
            return `❌ Não há nenhum jogo da forca ativo neste grupo. Use ${prefixo}forca para iniciar um novo jogo.`;
        }
        return;
    }

    // --- COMANDOS DE CANCELAMENTO ---
    if (['encerrar', 'desistir', 'parar', 'resetforca', 'cancelar'].includes(cmd)) {
        forcaGames.delete(chatJid);
        await sock.sendMessage(chatJid, { text: `🏳️ O jogo da forca foi encerrado. A palavra era: *${game.palavraOriginal}*` });
        return;
    }

    // --- COMANDOS DE STATUS ---
    if (['status', 'ver', 'boneco', 'progresso', 'tabuleiro'].includes(cmd)) {
        const displayWord = game.palavraOriginal.split('').map(char =>
            game.letrasDescobertas.has(normalize(char)) ? char : '_'
        ).join(' ');

        const letrasErradasStr = Array.from(game.letrasErradas).join(', ').toUpperCase();

        await sock.sendMessage(chatJid, {
            text: `📊 *STATUS DO JOGO* 📊\n\n${boneco[game.erros]}\n\nPalavra: ${displayWord}\nErros: ${game.erros}/${game.maxErros}\nLetras erradas: ${letrasErradasStr}`
        });
        return;
    }

    // --- COMANDOS DE CHUTE DE LETRA ---
    if (['letra', 'l', 'tentar', 'chute'].includes(cmd)) {
        if (args.length === 0) {
            return '⚠️ Você precisa informar uma letra! Ex: !letra A';
        }

        const letra = normalize(args[0].charAt(0));

        if (!/[a-z]/.test(letra)) {
            return '⚠️ Por favor, digite apenas uma letra válida.';
        }

        if (game.letrasDescobertas.has(letra) || game.letrasErradas.has(letra)) {
            return `⚠️ A letra "${letra.toUpperCase()}" já foi tentada!`;
        }

        if (game.palavraLimpa.includes(letra)) {
            game.letrasDescobertas.add(letra);

            // Verificar vitória
            const todasDescobertas = game.palavraLimpa.split('').every(char => game.letrasDescobertas.has(char));

            if (todasDescobertas) {
                forcaGames.delete(chatJid);
                await sock.sendMessage(chatJid, {
                    text: `🎉 *PARABÉNS!* 🎉\n\nVocê acertou a palavra: *${game.palavraOriginal.toUpperCase()}*\n\n${boneco[game.erros]}`
                });
            } else {
                const displayWord = game.palavraOriginal.split('').map(char =>
                    game.letrasDescobertas.has(normalize(char)) ? char : '_'
                ).join(' ');

                await sock.sendMessage(chatJid, {
                    text: `✅ Acertou!\n\n${boneco[game.erros]}\n\nPalavra: ${displayWord}`
                });
            }
        } else {
            game.letrasErradas.add(letra);
            game.erros++;

            // Verificar derrota
            if (game.erros >= game.maxErros) {
                forcaGames.delete(chatJid);
                await sock.sendMessage(chatJid, {
                    text: `💀 *GAME OVER* 💀\n\nO bonequinho morreu! A palavra era: *${game.palavraOriginal.toUpperCase()}*\n\n${boneco[6]}`
                });
            } else {
                const displayWord = game.palavraOriginal.split('').map(char =>
                    game.letrasDescobertas.has(normalize(char)) ? char : '_'
                ).join(' ');

                await sock.sendMessage(chatJid, {
                    text: `❌ Errou!\n\n${boneco[game.erros]}\n\nPalavra: ${displayWord}\nErros: ${game.erros}/${game.maxErros}`
                });
            }
        }
        return;
    }

    // --- COMANDOS DE CHUTE DE PALAVRA ---
    if (['palavra', 'p', 'chutar', 'arriscar', 'resposta'].includes(cmd)) {
        if (args.length === 0) {
            return '⚠️ Você precisa informar a palavra completa! Ex: !palavra abacaxi';
        }

        const chute = normalize(args.join(''));

        if (chute === game.palavraLimpa) {
            forcaGames.delete(chatJid);
            await sock.sendMessage(chatJid, {
                text: `🎉 *PARABÉNS!* 🎉\n\nVocê acertou a palavra em cheio: *${game.palavraOriginal.toUpperCase()}*\n\n${boneco[game.erros]}`
            });
        } else {
            game.erros++;

            // Verificar derrota
            if (game.erros >= game.maxErros) {
                forcaGames.delete(chatJid);
                await sock.sendMessage(chatJid, {
                    text: `💀 *GAME OVER* 💀\n\nVocê errou a palavra e o bonequinho morreu! A palavra era: *${game.palavraOriginal.toUpperCase()}*\n\n${boneco[6]}`
                });
            } else {
                await sock.sendMessage(chatJid, {
                    text: `❌ Palavra incorreta! O risco custou um erro.\n\n${boneco[game.erros]}\nErros: ${game.erros}/${game.maxErros}`
                });
            }
        }
        return;
    }
}

module.exports = {
    name: 'forca',
    description: 'Jogo da Forca',
    aliases: [
        'f', 'jogarforca', 'game',
        'letra', 'l', 'tentar', 'chute',
        'palavra', 'p', 'chutar', 'arriscar', 'resposta',
        'status', 'ver', 'boneco', 'progresso', 'tabuleiro',
        'encerrar', 'desistir', 'parar', 'resetforca', 'cancelar',
        'regrasforca', 'ajudaforca', 'hf'
    ],
    category: 'jogos',
    execute
};
