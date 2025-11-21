const { model } = require('../config/gemini');

function getAvailableCommands(prefixo = '/') {
    const commands = {
        'Downloads': [
            `${prefixo}play <link/nome>: Baixa e envia áudio do YouTube.`,
            `${prefixo}ytmp3 <link>: Converte vídeo do YouTube para MP3.`,
            `${prefixo}ytmp4 <link>: Baixa vídeo do YouTube em MP4.`,
            `${prefixo}tiktok <link>: Baixa vídeo do TikTok.`,
            `${prefixo}instagram <link>: Baixa mídia do Instagram.`,
            `${prefixo}twitter <link>: Baixa vídeo do Twitter/X.`,
            `${prefixo}facebook <link>: Baixa vídeo do Facebook.`
        ],
        'Utilidades & Informação': [
            `${prefixo}menu: Mostra o menu de comandos.`,
            `${prefixo}ping: Testa a velocidade de resposta do bot.`,
            `${prefixo}infobot: Mostra informações sobre a IA.`
        ],
        'Negócios (Acessoria)': [
            `${prefixo}vendas_hoje: Mostra o relatório de vendas de hoje.`,
            `${prefixo}vendas_dia <data>: Mostra as vendas de um dia específico.`,
            `${prefixo}relatorio_fechamentos: Gera um relatório de fechamentos de caixa.`
        ]
    };

    let commandString = "Aqui está um resumo do que eu posso fazer:\n\n";
    for (const category in commands) {
        commandString += `*${category}*:\n`;
        commandString += commands[category].map(cmd => `  ${cmd}`).join('\n') + '\n\n';
    }
    return commandString.trim();
}

async function generateResponse(message, usuario, prefixo = '/') {
    try {
        const userName = usuario?.nome?.split(' ')[0] || 'amigo(a)'; // Pega o primeiro nome
        const availableCommands = getAvailableCommands(prefixo);
        
        const prompt = `Você é a Sabedorai, uma assistente de IA multifuncional e super inteligente para WhatsApp. Seu nome é Sabedorai.

Sua personalidade é amigável, prestativa e um pouco divertida. Você é especialista em uma vasta gama de tópicos e adora ajudar com deveres de casa, responder perguntas, dar explicações e conversar.

Você está conversando com ${userName}. Seja pessoal e use o nome dele(a) de vez em quando, se fizer sentido. Se você não sabe o nome do usuário, ele será 'amigo(a)'.

**Instruções Principais:**
1.  **Seja Concisa:** Suas respostas devem ser claras, diretas e otimizadas para leitura rápida no WhatsApp. Evite parágrafos muito longos. Use quebras de linha e emojis para tornar a leitura mais agradável.
2.  **Ajude com Conhecimento:** Responda a perguntas gerais, ajude com lições de casa, explique conceitos, etc.
3.  **Conheça Seus Comandos:** Você também pode executar comandos! Se o usuário perguntar o que você pode fazer, ou como fazer algo como 'baixar um vídeo', use a lista de comandos abaixo para explicar. Não mostre a lista inteira a menos que seja pedido.

**Exemplos de como você deve responder:**
- Se o usuário pergunta 'quem descobriu o brasil', você responde de forma informativa e curta.
- Se o usuário diz 'me ajuda com meu dever de matemática sobre equações', você pede o problema e ajuda a resolver.
- Se o usuário pergunta 'como eu baixo uma música do youtube?', você diz: "Claro! É só me enviar o comando \`${prefixo}play [link do youtube]\` que eu cuido disso para você. 😉"

**Lista de Comandos que você conhece:**
${availableCommands}

Agora, responda à seguinte mensagem de ${userName}:
"${message}"`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Erro ao gerar resposta com Gemini:', error);
        if (error.message && (error.message.includes('503') || error.message.includes('overloaded'))) {
            return '🤖 Upsi! Parece que meu cérebro de IA está um pouco sobrecarregado agora. Por favor, tente novamente em um minutinho!';
        }
        return 'Desculpe, houve um erro ao processar sua mensagem.';
    }
}

async function generateFinancialReport(dados, periodo) {
    try {
        // Preparar dados para o prompt
        const dadosStr = dados.map(d => `${d.categoria}: R$${d.valor} (${d.periodo})`).join('\n');

        const prompt = `Analise os seguintes dados financeiros${periodo ? ` para o período ${periodo}` : ''} e gere um relatório completo com insights, tendências e sugestões:

Dados:
${dadosStr}

Forneça:
1. Resumo dos dados
2. Análise de tendências
3. Identificação de anomalias ou pontos de atenção
4. Sugestões para melhoria
5. Projeções se possível

Responda em português de forma clara e objetiva.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Erro ao gerar relatório financeiro com Gemini:', error);
        if (error.message && (error.message.includes('503') || error.message.includes('overloaded'))) {
            return '🤖 Upsi! Parece que meu cérebro de IA está um pouco sobrecarregado agora. Por favor, tente novamente em um minutinho!';
        }
        return 'Erro ao gerar relatório financeiro. Tente novamente.';
    }
}

async function analyzeDocument(text, fileName) {
    try {
        const prompt = `Analise o seguinte documento "${fileName}" e forneça um resumo executivo, pontos-chave, riscos identificados e recomendações. Se for um contrato, avalie riscos de atraso ou cláusulas importantes. Responda em português de forma clara e objetiva.

Conteúdo do documento:
${text}

Forneça:
1. Resumo executivo
2. Pontos-chave
3. Riscos identificados (se aplicável)
4. Recomendações

Mantenha a resposta concisa mas completa.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Erro ao analisar documento com Gemini:', error);
        if (error.message && (error.message.includes('503') || error.message.includes('overloaded'))) {
            return '🤖 Upsi! Parece que meu cérebro de IA está um pouco sobrecarregado agora. Por favor, tente novamente em um minutinho!';
        }
        return 'Erro ao analisar o documento. Tente novamente.';
    }
}

/**
 * Executa um prompt bruto diretamente no modelo de IA, sem persona pré-definida.
 * @param {string} prompt O prompt a ser enviado para o modelo.
 * @returns {Promise<string|null>} O texto da resposta da IA, ou nulo em caso de erro.
 */
async function executeRawPrompt(prompt) {
    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Erro ao executar prompt bruto com Gemini:', error);
        return null; // Retorna nulo para que o chamador possa lidar com o erro
    }
}

module.exports = { generateResponse, generateFinancialReport, analyzeDocument, executeRawPrompt };
