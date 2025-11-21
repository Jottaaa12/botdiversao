const axios = require('axios');

/**
 * Serviço para buscar GIFs dinamicamente do Giphy
 * 
 * IMPORTANTE: Para usar este serviço, você precisa:
 * 1. Criar uma conta gratuita em https://developers.giphy.com/
 * 2. Obter uma API Key
 * 3. Criar um arquivo .env na raiz do projeto
 * 4. Adicionar: GIPHY_API_KEY=sua_chave_aqui
 */

// Configuração da API
const GIPHY_API_KEY = 'wMtmRu6AbnpFYAUVzzXwnfUuOZaC85rC'; // API Key configurada
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

/**
 * Busca um GIF aleatório baseado em uma query
 * @param {string} searchQuery - Termo de busca (ex: 'slap', 'laugh', 'cry')
 * @param {string} rating - Classificação (g, pg, pg-13, r) - padrão: 'g'
 * @returns {Promise<string>} URL do GIF encontrado
 */
async function getRandomGif(searchQuery, rating = 'g') {
    try {
        const response = await axios.get(`${GIPHY_BASE_URL}/random`, {
            params: {
                api_key: GIPHY_API_KEY,
                tag: searchQuery,
                rating: rating
            }
        });

        if (response.data && response.data.data) {
            // Retorna a URL do GIF no formato original
            return response.data.data.images.original.mp4 || response.data.data.images.original.url;
        }

        throw new Error('Nenhum GIF encontrado');
    } catch (error) {
        console.error(`[GiphyService] Erro ao buscar GIF para "${searchQuery}":`, error.message);
        throw error;
    }
}

/**
 * Busca múltiplos GIFs baseado em uma query e retorna um aleatório
 * @param {string} searchQuery - Termo de busca
 * @param {number} limit - Quantidade de resultados para escolher (padrão: 25)
 * @param {string} rating - Classificação (g, pg, pg-13, r) - padrão: 'g'
 * @returns {Promise<string>} URL do GIF escolhido aleatoriamente
 */
async function getRandomFromSearch(searchQuery, limit = 25, rating = 'g') {
    try {
        const response = await axios.get(`${GIPHY_BASE_URL}/search`, {
            params: {
                api_key: GIPHY_API_KEY,
                q: searchQuery,
                limit: limit,
                rating: rating,
                lang: 'pt' // Busca em português
            }
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
            // Escolhe um GIF aleatório dos resultados
            const randomIndex = Math.floor(Math.random() * response.data.data.length);
            return response.data.data[randomIndex].images.original.mp4 || response.data.data[randomIndex].images.original.url;
        }

        throw new Error('Nenhum GIF encontrado');
    } catch (error) {
        console.error(`[GiphyService] Erro ao buscar GIFs para "${searchQuery}":`, error.message);
        throw error;
    }
}

/**
 * Busca um GIF em português (trending no Brasil)
 * @returns {Promise<string>} URL de um GIF trending
 */
async function getTrendingGif() {
    try {
        const response = await axios.get(`${GIPHY_BASE_URL}/trending`, {
            params: {
                api_key: GIPHY_API_KEY,
                limit: 50,
                rating: 'g'
            }
        });

        if (response.data && response.data.data && response.data.data.length > 0) {
            const randomIndex = Math.floor(Math.random() * response.data.data.length);
            return response.data.data[randomIndex].images.original.mp4 || response.data.data[randomIndex].images.original.url;
        }

        throw new Error('Nenhum GIF trending encontrado');
    } catch (error) {
        console.error('[GiphyService] Erro ao buscar GIFs trending:', error.message);
        throw error;
    }
}

/**
 * Busca GIF por ID específico (útil para ter um fallback)
 * @param {string} gifId - ID do GIF no Giphy
 * @returns {Promise<string>} URL do GIF
 */
async function getGifById(gifId) {
    try {
        const response = await axios.get(`${GIPHY_BASE_URL}/${gifId}`, {
            params: {
                api_key: GIPHY_API_KEY
            }
        });

        if (response.data && response.data.data) {
            return response.data.data.images.original.mp4 || response.data.data.images.original.url;
        }

        throw new Error('GIF não encontrado');
    } catch (error) {
        console.error(`[GiphyService] Erro ao buscar GIF por ID "${gifId}":`, error.message);
        throw error;
    }
}

module.exports = {
    getRandomGif,
    getRandomFromSearch,
    getTrendingGif,
    getGifById
};
