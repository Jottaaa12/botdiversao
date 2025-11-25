const logger = require('./logger');

class ErrorNotifier {
    constructor() {
        this.ownerPhone = process.env.OWNER_PHONE;
        this.errorQueue = [];
        this.lastNotificationTime = 0;
        this.notificationCooldown = 10000; // 10 segundos entre notificações
        this.maxErrorsPerMinute = 5;
        this.errorTimestamps = [];
    }

    /**
     * Formata informações do erro para envio
     */
    formatErrorMessage(errorInfo) {
        const {
            error,
            command,
            userName,
            userPhone,
            chatId,
            timestamp = new Date()
        } = errorInfo;

        let message = '🚨 *ERRO NO BOT DETECTADO*\n\n';
        message += `⏰ *Horário:* ${timestamp.toLocaleString('pt-BR')}\n`;
        message += `━━━━━━━━━━━━━━━━━━━\n\n`;

        if (command) {
            message += `⚙️ *Comando:* \`${command}\`\n`;
        }

        if (userName) {
            message += `👤 *Usuário:* ${userName}\n`;
        }

        if (userPhone) {
            message += `📱 *Telefone:* ${userPhone}\n`;
        }

        if (chatId) {
            message += `💬 *Chat ID:* \`${chatId}\`\n`;
        }

        message += `\n━━━━━━━━━━━━━━━━━━━\n`;
        message += `❌ *Erro:*\n\`\`\`${error.message || error}\`\`\`\n`;

        if (error.stack) {
            // Pega apenas as primeiras 3 linhas do stack trace
            const stackLines = error.stack.split('\n').slice(0, 4).join('\n');
            message += `\n📍 *Stack Trace:*\n\`\`\`${stackLines}\`\`\``;
        }

        return message;
    }

    /**
     * Verifica se pode enviar notificação (rate limiting)
     */
    canSendNotification() {
        const now = Date.now();

        // Remove timestamps antigos (mais de 1 minuto)
        this.errorTimestamps = this.errorTimestamps.filter(
            time => now - time < 60000
        );

        // Verifica se atingiu o limite
        if (this.errorTimestamps.length >= this.maxErrorsPerMinute) {
            logger.warn('Rate limit de notificações de erro atingido');
            return false;
        }

        // Verifica cooldown
        if (now - this.lastNotificationTime < this.notificationCooldown) {
            logger.debug('Cooldown de notificação ainda ativo');
            return false;
        }

        return true;
    }

    /**
     * Envia notificação de erro para o owner
     */
    async notifyError(sock, errorInfo) {
        // Valida se owner phone está configurado
        if (!this.ownerPhone) {
            logger.warn('OWNER_PHONE não configurado. Notificação de erro não enviada.');
            return false;
        }

        // Verifica rate limiting
        if (!this.canSendNotification()) {
            logger.debug('Notificação de erro bloqueada por rate limiting');
            return false;
        }

        try {
            const message = this.formatErrorMessage(errorInfo);
            const ownerJid = this.ownerPhone.includes('@')
                ? this.ownerPhone
                : `${this.ownerPhone}@s.whatsapp.net`;

            await sock.sendMessage(ownerJid, { text: message });

            // Atualiza controles de rate limiting
            this.lastNotificationTime = Date.now();
            this.errorTimestamps.push(Date.now());

            logger.info('Notificação de erro enviada para o owner');
            return true;
        } catch (error) {
            logger.error('Erro ao enviar notificação de erro:', error);
            return false;
        }
    }

    /**
     * Método auxiliar para capturar e notificar erro
     */
    async captureAndNotify(sock, error, context = {}) {
        // Loga o erro
        logger.errorWithContext(error, context);

        // Envia notificação
        await this.notifyError(sock, {
            error,
            ...context
        });
    }
}

// Singleton
const errorNotifier = new ErrorNotifier();

module.exports = errorNotifier;
