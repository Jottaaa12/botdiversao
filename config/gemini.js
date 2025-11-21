const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config.json');

// Configuração da API do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || config.apiKeys.gemini;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

module.exports = { model };
