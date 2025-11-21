const geminiService = require('./geminiService');
const openRouterProvider = require('./openRouterProvider');

async function generateChatResponse(message, usuario, prefixo = '/') {
    try {
        console.log('[AIService] Tentando provedor primário: Gemini');
        const geminiResponse = await geminiService.generateResponse(message, usuario, prefixo);

        // Check for Gemini's specific error message indicating overload
        if (geminiResponse.includes('Upsi! Parece que meu cérebro de IA está um pouco sobrecarregado')) {
             throw new Error('Gemini is overloaded');
        }
        return geminiResponse;

    } catch (error) {
        console.warn('[AIService] Gemini falhou. Acionando fallback: OpenRouter.', error.message);

        try {
            console.log('[AIService] Tentando provedor secundário: OpenRouter');
            // We need to reconstruct a simpler prompt for the fallback, as it doesn't know the persona.
            // The OpenRouter model will act as a general helpful assistant.
            const userName = usuario?.nome?.split(' ')[0] || 'amigo(a)';
            const simplePrompt = `Você é um assistente prestativo e conciso. Responda à mensagem do usuário de forma útil e direta. O usuário é ${userName}. Mensagem: "${message}"`;
            const openRouterResponse = await openRouterProvider.generateOpenRouterResponse(simplePrompt);

            if (openRouterResponse) {
                return openRouterResponse;
            } else {
                throw new Error('OpenRouter also failed');
            }
        } catch (fallbackError) {
            console.error('[AIService] Fallback OpenRouter também falhou.', fallbackError.message);
            return '🤖 Desculpe, todos os meus sistemas de IA parecem estar ocupados no momento. Por favor, tente novamente mais tarde.';
        }
    }
}

module.exports = { generateChatResponse };
