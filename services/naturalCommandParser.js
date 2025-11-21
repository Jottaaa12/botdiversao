const { executeRawPrompt } = require('./geminiService');

// Lista de comandos que a IA pode reconhecer
const RECOGNIZABLE_COMMANDS = [
    { name: 'play', description: 'Downloads audio from a YouTube video.', aliases: ['yt-audio', 'youtube audio', 'musica'] },
    { name: 'ytmp3', description: 'Downloads audio from a YouTube video as an MP3 file.', aliases: ['youtube mp3'] },
    { name: 'ytmp4', description: 'Downloads a video from YouTube in MP4 format.', aliases: ['yt-video', 'youtube video', 'video'] },
    { name: 'tiktok', description: 'Downloads a video from TikTok.', aliases: ['tk', 'tiktok video'] },
    { name: 'instagram', description: 'Downloads a video or image from Instagram.', aliases: ['ig', 'insta'] },
    { name: 'twitter', description: 'Downloads a video or image from Twitter/X.', aliases: ['tw', 'x'] },
    { name: 'facebook', description: 'Downloads a video from Facebook.', aliases: ['fb', 'facebook video'] },
    { name: 'vendas_hoje', description: 'Mostra o relatório de vendas de hoje.', aliases: ['vendas hoje', 'relatório de vendas', 'vendemos hoje'] }
];

/**
 * Analisa a mensagem em busca de comandos de vendas.
 * @param {string} messageText O texto da mensagem do usuário.
 * @returns {{command: string, argument: string}|null}
 */
function parseSalesCommand(messageText) {
    const lowerCaseMessage = messageText.toLowerCase();
    const salesKeywords = ['vendas', 'relatório', 'vendemos'];
    const todayKeywords = ['hoje', 'agora', 'dia'];

    const hasSalesKeyword = salesKeywords.some(kw => lowerCaseMessage.includes(kw));
    const hasTodayKeyword = todayKeywords.some(kw => lowerCaseMessage.includes(kw));

    if (hasSalesKeyword && hasTodayKeyword) {
        return { command: 'vendas_hoje', argument: '' };
    }

    return null;
}

/**
 * Usa a IA para analisar uma mensagem de texto e determinar se ela corresponde a um comando conhecido.
 * @param {string} messageText O texto da mensagem do usuário.
 * @returns {Promise<{command: string, argument: string}|null>} Um objeto com o comando e o argumento, ou nulo se nenhum comando for encontrado.
 */
async function parseNaturalCommand(messageText) {
    // 1. Tenta primeiro o parser específico de vendas, que é mais rápido
    const salesCommand = parseSalesCommand(messageText);
    if (salesCommand) {
        return salesCommand;
    }

    // 2. Se não for um comando de vendas, continua com a lógica de URL
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = messageText.match(urlRegex);
    if (!urlMatch) {
        return null; // Se não houver URL, não é um comando de download provável.
    }
    const argument = urlMatch[0];

    // 3. Construir a lista de comandos para o prompt da IA.
    const commandListForPrompt = RECOGNIZABLE_COMMANDS.map(cmd => 
        `- "${cmd.name}": ${cmd.description} (keywords: ${cmd.aliases.join(', ')})`
    ).join('\n');

    // 4. Construir o prompt para a IA.
    const prompt = `
        You are an expert command router for a WhatsApp bot. Your task is to analyze the user's message and determine which command should be executed.

        Here is the user's message:
        "${messageText}"

        Here is the list of available commands:
        ${commandListForPrompt}

        Analyze the user's intent and the URL provided (${argument}). Based on the text (like "baixe a musica" or "download video") and the domain of the URL, identify the single most appropriate command from the list.

        Respond ONLY with a JSON object in the following format:
        {
          "command": "command_name",
          "argument": "the_full_url"
        }

        - The "command" must be one of the exact command names from the list (e.g., "play", "tiktok").
        - The "argument" must be the full URL found in the message.
        - If no command accurately matches the user's intent or the URL domain, respond with:
        {
          "command": null,
          "argument": null
        }
        
        IMPORTANT: Do not add any introductory text, conversation, or explanation. Your entire output must be ONLY the raw JSON object.
    `;

    try {
        // 5. Chamar a IA e obter a resposta.
        const aiResponse = await executeRawPrompt(prompt);
        if (!aiResponse) {
            console.error('[NaturalCommandParser] A chamada para a IA retornou nulo ou vazio.');
            return null;
        }
        console.log(`[NaturalCommandParser] Raw AI Response: "${aiResponse}"`);

        // 6. Limpar e parsear a resposta JSON da IA de forma robusta.
        let jsonString = aiResponse;

        // Tenta extrair o JSON de dentro de um bloco de markdown, se houver.
        if (jsonString.includes('```json')) {
            jsonString = jsonString.split('```json')[1].split('```')[0];
        }

        // Como fallback, encontra o primeiro '{' e o último '}' para isolar o objeto JSON.
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }

        jsonString = jsonString.trim();
        
        const parsedResponse = JSON.parse(jsonString);

        if (parsedResponse && parsedResponse.command && RECOGNIZABLE_COMMANDS.some(c => c.name === parsedResponse.command)) {
            console.log(`[NaturalCommandParser] IA identificou o comando: ${parsedResponse.command}`);
            return {
                command: parsedResponse.command,
                argument: parsedResponse.argument || argument, // Garante que o argumento seja a URL
            };
        } else {
            console.log('[NaturalCommandParser] IA não identificou um comando válido na resposta JSON.');
            return null;
        }
    } catch (error) {
        console.error('[NaturalCommandParser] Erro ao processar o comando com a IA:', error);
        return null;
    }
}

module.exports = { parseNaturalCommand };
