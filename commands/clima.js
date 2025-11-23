const axios = require('axios');

// Função para obter emoji baseado no código do clima
function getWeatherEmoji(weatherCode) {
    const emojiMap = {
        '01d': '☀️',  // céu limpo (dia)
        '01n': '🌙',  // céu limpo (noite)
        '02d': '⛅',  // poucas nuvens (dia)
        '02n': '☁️',  // poucas nuvens (noite)
        '03d': '☁️',  // nuvens dispersas
        '03n': '☁️',
        '04d': '☁️',  // nublado
        '04n': '☁️',
        '09d': '🌧️',  // chuva
        '09n': '🌧️',
        '10d': '🌦️',  // chuva leve (dia)
        '10n': '🌧️',  // chuva leve (noite)
        '11d': '⛈️',  // tempestade
        '11n': '⛈️',
        '13d': '❄️',  // neve
        '13n': '❄️',
        '50d': '🌫️',  // névoa
        '50n': '🌫️'
    };
    return emojiMap[weatherCode] || '🌍';
}

// Função para converter velocidade do vento de m/s para km/h
function convertWindSpeed(speedMs) {
    return (speedMs * 3.6).toFixed(1);
}

async function execute({ args }) {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
        return '❌ *Erro de Configuração*\n\nA chave da API do OpenWeatherMap não está configurada.\nPor favor, adicione OPENWEATHER_API_KEY no arquivo .env';
    }

    // Cidade padrão: Barroquinha-CE
    const cidade = args.length > 0 ? args.join(' ') : 'Barroquinha,CE,BR';

    try {
        // Fazer requisição à API do OpenWeatherMap
        const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
            params: {
                q: cidade,
                appid: apiKey,
                units: 'metric',  // Celsius
                lang: 'pt_br'     // Português brasileiro
            }
        });

        const data = response.data;

        // Extrair informações
        const nomeCidade = data.name;
        const pais = data.sys.country;
        const temperatura = Math.round(data.main.temp);
        const sensacao = Math.round(data.main.feels_like);
        const tempMin = Math.round(data.main.temp_min);
        const tempMax = Math.round(data.main.temp_max);
        const umidade = data.main.humidity;
        const descricao = data.weather[0].description;
        const icone = data.weather[0].icon;
        const vento = convertWindSpeed(data.wind.speed);
        const lat = data.coord.lat.toFixed(2);
        const lon = data.coord.lon.toFixed(2);

        // Emoji baseado no clima
        const emoji = getWeatherEmoji(icone);

        // Formatar resposta
        const resposta = `${emoji} *CLIMA EM ${nomeCidade.toUpperCase()}, ${pais}*

🌡️ *Temperatura:* ${temperatura}°C
🌡️ *Sensação térmica:* ${sensacao}°C
📊 *Mín/Máx:* ${tempMin}°C / ${tempMax}°C
💧 *Umidade:* ${umidade}%
💨 *Vento:* ${vento} km/h
☁️ *Condição:* ${descricao.charAt(0).toUpperCase() + descricao.slice(1)}

🌍 *Coordenadas:* ${lat}, ${lon}
🕐 *Consultado em:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`;

        return resposta;

    } catch (error) {
        if (error.response) {
            // Erro da API
            if (error.response.status === 404) {
                return `❌ *Cidade não encontrada*\n\nNão foi possível encontrar "${cidade}".\nVerifique o nome e tente novamente.\n\n💡 *Dica:* Use o formato "Cidade" ou "Cidade,Estado,País"`;
            } else if (error.response.status === 401) {
                return `❌ *Erro de Autenticação*\n\nChave da API inválida ou ainda não ativada.\n\n⏰ *Importante:* Chaves novas da API podem levar até 2 horas para serem ativadas.`;
            } else {
                return `❌ *Erro na API*\n\nCódigo: ${error.response.status}\nMensagem: ${error.response.data.message || 'Erro desconhecido'}`;
            }
        } else if (error.request) {
            // Erro de conexão
            return '❌ *Erro de Conexão*\n\nNão foi possível conectar à API do OpenWeatherMap.\nVerifique sua conexão com a internet.';
        } else {
            // Outro erro
            return `❌ *Erro Inesperado*\n\n${error.message}`;
        }
    }
}

module.exports = {
    name: 'clima',
    description: 'Consulta a previsão do tempo de qualquer cidade. Use !clima ou !clima <cidade>',
    category: 'utilitario',
    permission: 'user',
    execute,
};
