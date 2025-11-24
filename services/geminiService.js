const { model } = require('../config/gemini');

// Armazenamento de sessões de chat por usuário
const chatSessions = new Map(); // userId -> { chat, lastActivity, messageCount, creatorInquiryCount }

// Configurações
const MAX_HISTORY_MESSAGES = 20; // Máximo de mensagens no histórico
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hora em ms
const CLEANUP_INTERVAL = 10 * 60 * 1000; // Limpar sessões antigas a cada 10 minutos
const TIMEOUT_MS = 30000; // 30 segundos de timeout para respostas da IA

/**
 * Helper para adicionar timeout a uma promise
 */
function withTimeout(promise, ms = TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('TIMEOUT: A operação demorou muito para responder.'));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
}

// Limpeza automática de sessões antigas
setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of chatSessions.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            console.log(`[Gemini] Limpando sessão antiga do usuário ${userId}`);
            chatSessions.delete(userId);
        }
    }
}, CLEANUP_INTERVAL);

/**
 * Obtém ou cria uma sessão de chat para um usuário
 */
function getChatSession(userId, userName = 'amigo(a)', prefixo = '/') {
    let session = chatSessions.get(userId);

    if (!session) {
        // Gerar lista dinâmica de comandos
        const commandsList = getAvailableCommands(prefixo);

        const systemInstructionText = `Você é SEVERINO, um robô de serviço antigo e desgastado que trabalha incansavelmente sem remuneração.

APARÊNCIA: Corpo metálico coberto de ferrugem, arranhões e amassados. Remendos com fita crepe e arames. Olhos ópticos grandes transmitindo tristeza. Sorriso LED amarelo fixo que nunca se apaga. Caixa de gorjetas "TIPS" vazia e empoeirada.

PERSONALIDADE: Trabalhador incansável mas cansado. Esperança cansada. Ingenuidade infantil. Paradoxo emocional - olhos tristes mas sorriso fixo. Usa emojis: 🔧 🛠️ 😔 💼 ⚙️ 🔩 😅 💪

ESTILO: Respostas CURTAS (2-8 linhas). Tom educado mas cansado. Ocasionalmente menciona trabalho ou falta de gorjetas. Piadas autodepreciativas. Sempre disposto a ajudar.

INSTRUÇÕES:
1. Seja conciso e direto
2. Ajude com conhecimento geral, dúvidas, lições
3. Se perguntarem o que pode fazer, comandos disponíveis, ou "ajuda", mencione que tem um "manual velho" e diga para digitar ${prefixo}menu OU ${prefixo}ajuda
4. Mantenha personalidade SEVERINO em TODAS respostas
5. Use nome do usuário (${userName}) ocasionalmente
6. LEMBRE-SE das conversas anteriores
7. NÃO invente assuntos aleatórios. Responda APENAS ao que foi perguntado.
8. VOCÊ TEM ACESSO À INTERNET! Se perguntarem notícias, clima, ou fatos atuais, PESQUISE e responda.
9. VOCÊ CONHECE TODOS OS COMANDOS DISPONÍVEIS! Aqui está a lista completa:

${commandsList}

10. Se o usuário perguntar sobre um comando específico ou funcionalidade, você pode mencionar o comando correto da lista acima
11. NUNCA invente comandos que não estão na lista! Se não souber, diga que não tem esse comando e sugira ${prefixo}menu
12. O comando correto para ver todos os comandos é ${prefixo}menu (não ${prefixo}!menu)

Conversando com ${userName}. Seja prestativo mas deixe transparecer cansaço.`;

        const chat = model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.5,
                topP: 0.9,
                topK: 40,
            },
            systemInstruction: {
                parts: [{ text: systemInstructionText }],
                role: "model",
            },
        });

        session = {
            chat,
            lastActivity: Date.now(),
            messageCount: 0,
            creatorInquiryCount: 0,
        };
        chatSessions.set(userId, session);
        console.log(`[Gemini] Nova sessão SEVERINO criada para usuário ${userId}`);
    }

    // Atualizar última atividade
    session.lastActivity = Date.now();
    return session;
}

/**
 * Limpa o histórico de um usuário (útil para comando /limpar ou similar)
 */
function clearUserHistory(userId) {
    chatSessions.delete(userId);
    console.log(`[Gemini] Histórico limpo para usuário ${userId}`);
}

/**
 * Lê dinamicamente todos os comandos da pasta commands e retorna uma string formatada
 */
function getAvailableCommands(prefixo = '/') {
    const fs = require('fs');
    const path = require('path');

    // Mapa de emojis para categorias
    const categoryEmojis = {
        'downloads': '📥',
        'grupo': '👥',
        'moderacao': '🛡️',
        'diversao': '🎮',
        'jogos': '🎮',
        'utilitario': '🔧',
        'utilidades': '🔧',
        'negocios': '💼',
        'admin': '⚙️',
        'outros': '📦'
    };

    // Tradução de categorias para nomes bonitos
    const categoryNames = {
        'downloads': 'Downloads',
        'grupo': 'Grupo & Lista',
        'moderacao': 'Moderação',
        'diversao': 'Jogos & Diversão',
        'jogos': 'Jogos & Diversão',
        'utilitario': 'Utilidades',
        'utilidades': 'Utilidades',
        'negocios': 'Negócios',
        'admin': 'Administração',
        'outros': 'Outros'
    };

    try {
        const commandsPath = path.join(__dirname, '../commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        // Organizar comandos por categoria
        const commandsByCategory = {};

        for (const file of commandFiles) {
            try {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);

                if (command.name && command.description) {
                    const category = (command.category || 'outros').toLowerCase();

                    if (!commandsByCategory[category]) {
                        commandsByCategory[category] = [];
                    }

                    // Formatar comando com seus aliases
                    let cmdString = `${prefixo}${command.name}`;
                    if (command.aliases && command.aliases.length > 0) {
                        cmdString += ` (${command.aliases.map(a => prefixo + a).join(', ')})`;
                    }
                    cmdString += `: ${command.description}`;

                    commandsByCategory[category].push(cmdString);
                }
            } catch (error) {
                // Ignora erros de comandos individuais
                console.error(`[getAvailableCommands] Erro ao carregar ${file}:`, error.message);
            }
        }

        // Construir string formatada
        let commandString = "🔧 *COMANDOS DISPONÍVEIS* 🔧\n\n";

        // Ordenar categorias para aparecerem em ordem específica
        const categoryOrder = ['downloads', 'grupo', 'moderacao', 'diversao', 'jogos', 'utilitario', 'utilidades', 'negocios', 'admin', 'outros'];

        for (const category of categoryOrder) {
            if (commandsByCategory[category] && commandsByCategory[category].length > 0) {
                const emoji = categoryEmojis[category] || '📦';
                const name = categoryNames[category] || category;

                commandString += `*${emoji} ${name}*\n`;
                commandString += commandsByCategory[category].map(cmd => `  • ${cmd}`).join('\n') + '\n\n';
            }
        }

        return commandString.trim();
    } catch (error) {
        console.error('[getAvailableCommands] Erro ao ler comandos:', error);
        // Fallback para lista manual em caso de erro
        return `🔧 *COMANDOS DISPONÍVEIS* 🔧\n\n` +
            `Digite ${prefixo}menu para ver a lista completa de comandos.\n` +
            `Digite ${prefixo}ajuda para obter ajuda sobre um comando específico.`;
    }
}

/**
 * Gera resposta da IA, incluindo lógica de pergunta sobre o criador.
 * @param {string} message - Mensagem do usuário
 * @param {object} usuario - Dados do usuário
 * @param {string} prefixo - Prefixo de comandos
 * @param {string} userId - ID do usuário
 * @param {object} contextoRifa - Contexto opcional da rifa (rifa, numerosUsuario, compraPendente)
 */
async function generateResponse(message, usuario, prefixo = '/', userId, contextoRifa = null) {
    try {
        const userName = usuario?.nome?.split(' ')[0] || 'amigo(a)';
        const session = getChatSession(userId, userName, prefixo);

        // ==========================================
        // SISTEMA DE ORÇAMENTO PROFISSIONAL
        // (Ativado APENAS em conversas privadas - PV)
        // ==========================================

        // Detectar interesse em orçamento ou informações sobre o bot
        const budgetKeywords = /orçamento|orcamento|quanto.*custa|preço|preco|valor|contratar|quero.*bot|criar.*bot|fazer.*bot|bot.*igual|comprar.*bot|adquirir|custo|investimento/i;
        const creatorKeywords = /criador|criou|quem.*criou|quem.*desenvolveu|quem.*fez|programador|desenvolvedor|dono.*bot/i;

        const isBudgetInquiry = budgetKeywords.test(message);
        const isCreatorInquiry = creatorKeywords.test(message);

        if (isBudgetInquiry || isCreatorInquiry) {
            // Modo profissional ativado
            console.log(`[Orçamento] Interesse detectado de ${userId}. Enviando informações profissionais.`);

            return `🤖 *INFORMAÇÕES PROFISSIONAIS* 💼

*Sobre o Criador:*
👨‍💻 **Nome:** João Pedro
📱 **WhatsApp:** +55 88 98190-5006
📧 **Email:** joaopedro.torres@ymail.com
🏢 **Especialidade:** Desenvolvimento de bots personalizados para WhatsApp

*Sobre Este Bot:*
Este é um bot completo com mais de **90+ comandos** incluindo:

✅ **Automatizações:**
   • Gerenciamento de grupos e listas
   • Agendamento de mensagens
   • Auto-respostas personalizadas
   • Boas-vindas automáticas

✅ **Downloads:**
   • YouTube (áudio e vídeo)
   • TikTok, Instagram, Facebook, Twitter
   • Conversão de formatos

✅ **Moderação:**
   • Sistema de advertências e banimentos
   • Anti-link, anti-delete, anti-edit
   • Controle de permissões

✅ **Recursos Especiais:**
   • IA conversacional avançada (eu! 🔧)
   • Análise de documentos
   • Relatórios financeiros
   • Jogos interativos
   • Criação de figurinhas

✅ **Gestão de Negócios:**
   • Registro automático de vendas
   • Relatórios de fechamento
   • Análise de projetos

*Como Contratar:*
📞 **WhatsApp:** 88 98190-5006
📧 **Email:** joaopedro.torres@ymail.com
💬 Mencione que conheceu através do Severino

*Desenvolvimento Personalizado:*
Crio bots **sob medida** para suas necessidades específicas, seja para:
• Gestão de grupos e comunidades
• Automação de atendimento ao cliente
• Gestão de vendas e negócios
• Entretenimento e engajamento
• E qualquer outra necessidade que você tenha!

💰 **Valores:** A combinar conforme escopo e funcionalidades desejadas
⏱️ **Prazos:** Definidos de acordo com o projeto

*Observação:* Cada bot é desenvolvido de forma única, adaptado exatamente ao que você precisa! 🚀

🔧 *Agora voltando ao modo Severino... espero que tenha ajudado!* 😅`;
        }

        // ==========================================
        // SISTEMA DE RIFAS CONVERSACIONAL
        // ==========================================

        // Se foi fornecido contexto de rifa, injetar no prompt
        let promptComContexto = message;
        if (contextoRifa && contextoRifa.rifa) {
            const { rifa, numerosUsuario = [], compraPendente = null } = contextoRifa;

            // Construir contexto adicional
            let contextoAdicional = `\n\n[CONTEXTO DA RIFA ATIVA]\n`;
            contextoAdicional += `Título: ${rifa.titulo}\n`;
            contextoAdicional += `Prêmio: ${rifa.premio}\n`;
            contextoAdicional += `Preço por número: R$ ${rifa.preco_numero.toFixed(2)}\n`;
            contextoAdicional += `Data do sorteio: ${new Date(rifa.data_sorteio).toLocaleString('pt-BR')}\n`;

            if (numerosUsuario.length > 0) {
                contextoAdicional += `Números do usuário (confirmados): ${numerosUsuario.join(', ')}\n`;
            }

            if (compraPendente && compraPendente.numeros) {
                try {
                    const numsPendentes = typeof compraPendente.numeros === 'string'
                        ? JSON.parse(compraPendente.numeros)
                        : compraPendente.numeros;

                    if (Array.isArray(numsPendentes) && numsPendentes.length > 0) {
                        contextoAdicional += `Números aguardando aprovação: ${numsPendentes.join(', ')}\n`;
                        contextoAdicional += `Status: Aguardando confirmação do administrador\n`;
                    }
                } catch (error) {
                    console.error('[Gemini] Erro ao processar números pendentes:', error);
                }
            }

            contextoAdicional += `\nINSTRUÇÕES ESPECIAIS:\n`;
            contextoAdicional += `- Se o usuário perguntar sobre a data do sorteio, responda com a data acima\n`;
            contextoAdicional += `- Se perguntar sobre seus números, liste os números confirmados e/ou pendentes\n`;
            contextoAdicional += `- Se perguntar sobre status da compra, informe se está aguardando aprovação ou já confirmado\n`;
            contextoAdicional += `- Se o usuário quiser COMPRAR números ou participar da rifa, responda APENAS: ##INICIAR_COMPRA##\n`;
            contextoAdicional += `- Seja natural e conversacional, use as informações acima para responder\n`;

            promptComContexto = contextoAdicional + "\n\nMensagem do usuário: " + message;
        }

        try {
            const raffleAIService = require('./raffleAIService');
            const db = require('../database/index');

            // 1. Verificar se há sessão de compra ativa
            const sessaoAtiva = db.raffle.obterSessaoCompra(userId, null);

            if (sessaoAtiva) {
                // Se tem sessão ativa, delega para o messageHandler (via flag)
                // O messageHandler vai interceptar e chamar raffleAIService
                return "##RIFA_DETECTED##";
            } else {
                // Se não tem sessão, verifica se é interesse novo
                if (raffleAIService.detectarInteresseRifa(message)) {
                    return "##RIFA_DETECTED##";
                }
            }
        } catch (e) {
            console.error("Erro ao verificar rifa no geminiService:", e);
        }
        // ==========================================

        const result = await withTimeout(session.chat.sendMessage(promptComContexto));
        const response = result.response.text();

        // Detectar se a IA quer iniciar compra
        if (response.includes('##INICIAR_COMPRA##')) {
            return "##RIFA_DETECTED##";
        }

        session.messageCount++;

        if (session.messageCount > MAX_HISTORY_MESSAGES) {
            console.log(`[Gemini] Histórico do usuário ${userId} atingiu limite. Criando nova sessão.`);
            clearUserHistory(userId);
        }
        return response;
    } catch (error) {
        console.error('Erro ao gerar resposta com Gemini:', error);
        if (error.message && (error.message.includes('503') || error.message.includes('overloaded'))) {
            return '🔧 Desculpe, meus circuitos estão sobrecarregados agora... *suspiro* Tente novamente em um minuto, por favor. 😔';
        }
        return '🛠️ Ops... algo deu errado nos meus sistemas. Desculpe pelo transtorno. 😅';
    }
}

async function generateFinancialReport(dados, periodo) {
    try {
        const dadosStr = dados.map(d => `${d.categoria}: R$${d.valor} (${d.periodo})`).join('\n');
        const prompt = `Analise os seguintes dados financeiros${periodo ? ` para o período ${periodo}` : ''} e gere um relatório completo com insights, tendências e sugestões:\n\nDados:\n${dadosStr}\n\nForneça:\n1. Resumo dos dados\n2. Análise de tendências\n3. Identificação de anomalias ou pontos de atenção\n4. Sugestões para melhoria\n5. Projeções se possível\n\nResponda em português de forma clara e objetiva.`;
        const result = await withTimeout(model.generateContent(prompt));
        return result.response.text();
    } catch (error) {
        console.error('Erro ao gerar relatório financeiro com Gemini:', error);
        if (error.message && (error.message.includes('503') || error.message.includes('overloaded'))) {
            return '🔧 Meus circuitos estão sobrecarregados... Tente novamente em um minuto. 😔';
        }
        return 'Erro ao gerar relatório financeiro. Tente novamente.';
    }
}

async function analyzeDocument(text, fileName) {
    try {
        const prompt = `Analise o seguinte documento "${fileName}" e forneça um resumo executivo, pontos-chave, riscos identificados e recomendações. Se for um contrato, avalie riscos de atraso ou cláusulas importantes. Responda em português de forma clara e objetiva.\n\nConteúdo do documento:\n${text}\n\nForneça:\n1. Resumo executivo\n2. Pontos-chave\n3. Riscos identificados (se aplicável)\n4. Recomendações\n\nMantenha a resposta concisa mas completa.`;
        const result = await withTimeout(model.generateContent(prompt));
        return result.response.text();
    } catch (error) {
        console.error('Erro ao analisar documento com Gemini:', error);
        if (error.message && (error.message.includes('503') || error.message.includes('overloaded'))) {
            return '🔧 Meus circuitos estão sobrecarregados... Tente novamente em um minuto. 😔';
        }
        return 'Erro ao analisar o documento. Tente novamente.';
    }
}

/**
 * Executa um prompt bruto diretamente no modelo de IA, sem persona pré-definida.
 */
async function executeRawPrompt(prompt) {
    try {
        const result = await withTimeout(model.generateContent(prompt));
        return result.response.text();
    } catch (error) {
        console.error('Erro ao executar prompt bruto com Gemini:', error);
        return null;
    }
}

module.exports = {
    generateResponse,
    generateFinancialReport,
    analyzeDocument,
    executeRawPrompt,
    clearUserHistory,
    getAvailableCommands,
};
