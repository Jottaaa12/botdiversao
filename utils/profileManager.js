const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

/**
 * Gerenciador de Perfil do Bot
 * Responsável por atualizar nome, foto, status e biografia do bot
 */

/**
 * Atualiza o nome de exibição do bot
 * @param {Object} sock - Instância do socket Baileys
 * @param {string} name - Novo nome do bot
 * @returns {Promise<Object>} Resultado da operação
 */
async function updateProfileName(sock, name) {
    try {
        if (!name || name.trim().length === 0) {
            return {
                success: false,
                error: 'Nome não pode estar vazio!'
            };
        }

        if (name.length > 25) {
            return {
                success: false,
                error: 'Nome muito longo! Máximo de 25 caracteres.'
            };
        }

        await sock.updateProfileName(name);

        return {
            success: true,
            oldName: null, // Poderia armazenar o nome anterior se necessário
            newName: name
        };
    } catch (error) {
        console.error('[Profile Manager] Erro ao atualizar nome:', error);
        return {
            success: false,
            error: `Erro ao atualizar nome: ${error.message}`
        };
    }
}

/**
 * Atualiza a foto de perfil do bot
 * @param {Object} sock - Instância do socket Baileys
 * @param {string} imagePath - Caminho da imagem
 * @returns {Promise<Object>} Resultado da operação
 */
async function updateProfilePicture(sock, imagePath) {
    try {
        if (!fs.existsSync(imagePath)) {
            return {
                success: false,
                error: 'Arquivo de imagem não encontrado!'
            };
        }

        // Verifica se é uma imagem válida
        const validExtensions = ['.jpg', '.jpeg', '.png'];
        const ext = path.extname(imagePath).toLowerCase();

        if (!validExtensions.includes(ext)) {
            return {
                success: false,
                error: 'Formato inválido! Use JPG ou PNG.'
            };
        }

        // Verifica tamanho do arquivo (máximo 5MB)
        const stats = fs.statSync(imagePath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        if (fileSizeInMB > 5) {
            return {
                success: false,
                error: 'Imagem muito grande! Máximo de 5MB.'
            };
        }

        const imageBuffer = fs.readFileSync(imagePath);
        await sock.updateProfilePicture(sock.user.id, imageBuffer);

        return {
            success: true,
            message: 'Foto de perfil atualizada com sucesso!'
        };
    } catch (error) {
        console.error('[Profile Manager] Erro ao atualizar foto:', error);
        return {
            success: false,
            error: `Erro ao atualizar foto: ${error.message}`
        };
    }
}

/**
 * Remove a foto de perfil do bot
 * @param {Object} sock - Instância do socket Baileys
 * @returns {Promise<Object>} Resultado da operação
 */
async function removeProfilePicture(sock) {
    try {
        await sock.removeProfilePicture(sock.user.id);

        return {
            success: true,
            message: 'Foto de perfil removida com sucesso!'
        };
    } catch (error) {
        console.error('[Profile Manager] Erro ao remover foto:', error);
        return {
            success: false,
            error: `Erro ao remover foto: ${error.message}`
        };
    }
}

/**
 * Atualiza o status/recado do bot
 * @param {Object} sock - Instância do socket Baileys
 * @param {string} status - Novo status
 * @returns {Promise<Object>} Resultado da operação
 */
async function updateProfileStatus(sock, status) {
    try {
        if (!status || status.trim().length === 0) {
            return {
                success: false,
                error: 'Status não pode estar vazio!'
            };
        }

        if (status.length > 139) {
            return {
                success: false,
                error: 'Status muito longo! Máximo de 139 caracteres.'
            };
        }

        await sock.updateProfileStatus(status);

        return {
            success: true,
            newStatus: status
        };
    } catch (error) {
        console.error('[Profile Manager] Erro ao atualizar status:', error);
        return {
            success: false,
            error: `Erro ao atualizar status: ${error.message}`
        };
    }
}

/**
 * Obtém informações do perfil do bot
 * @param {Object} sock - Instância do socket Baileys
 * @returns {Promise<Object>} Informações do perfil
 */
async function getProfileInfo(sock) {
    try {
        const profilePicUrl = await sock.profilePictureUrl(sock.user.id, 'image').catch(() => null);
        const status = await sock.fetchStatus(sock.user.id).catch(() => ({ status: 'Não disponível' }));

        return {
            success: true,
            info: {
                name: sock.user.name || 'Não disponível',
                id: sock.user.id,
                profilePicUrl: profilePicUrl,
                status: status.status || 'Não disponível'
            }
        };
    } catch (error) {
        console.error('[Profile Manager] Erro ao obter informações:', error);
        return {
            success: false,
            error: `Erro ao obter informações: ${error.message}`
        };
    }
}

/**
 * Processa uma mensagem de imagem para atualizar foto de perfil
 * @param {Object} sock - Instância do socket Baileys
 * @param {Object} message - Mensagem contendo a imagem
 * @returns {Promise<Object>} Resultado da operação
 */
async function processImageMessage(sock, message) {
    try {
        const messageType = Object.keys(message.message)[0];

        if (messageType !== 'imageMessage') {
            return {
                success: false,
                error: 'Mensagem não contém uma imagem!'
            };
        }

        // Baixa a imagem
        const buffer = await downloadMediaMessage(message, 'buffer', {});

        // Salva temporariamente
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempPath = path.join(tempDir, `profile_${Date.now()}.jpg`);
        fs.writeFileSync(tempPath, buffer);

        // Atualiza a foto
        const result = await updateProfilePicture(sock, tempPath);

        // Remove arquivo temporário
        try {
            fs.unlinkSync(tempPath);
        } catch (e) {
            console.error('[Profile Manager] Erro ao remover arquivo temporário:', e);
        }

        return result;
    } catch (error) {
        console.error('[Profile Manager] Erro ao processar imagem:', error);
        return {
            success: false,
            error: `Erro ao processar imagem: ${error.message}`
        };
    }
}

module.exports = {
    updateProfileName,
    updateProfilePicture,
    removeProfilePicture,
    updateProfileStatus,
    getProfileInfo,
    processImageMessage
};
