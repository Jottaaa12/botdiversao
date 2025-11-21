const OpenAI = require('openai');

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function generateOpenRouterResponse(prompt) {
  try {
    const completion = await openRouter.chat.completions.create({
      model: "mistralai/mistral-7b-instruct:free", // A good free model
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Erro ao gerar resposta com OpenRouter:", error);
    return null; // Return null on failure
  }
}

module.exports = { generateOpenRouterResponse };
