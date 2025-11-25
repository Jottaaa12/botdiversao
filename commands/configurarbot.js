const db = require('../database');
const profileManager = require('../utils/profileManager');
const path = require('path');

// Estados para aguardar foto de perfil
const photoStates = new Map();

/**
 * Verifica se o comando está sendo executado no PV ou em grupo
 */
function isPrivateChat(chatJid) {
    return !chatJid.endsWith('@g.us');
}

/**
 * Formata data/hora para exibição
 */
function formatDateTime() {
    const now = new Date();
    return now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Converte valor booleano de string
 */
function parseBoolean(value) {
    const normalized = String(value).toLowerCase();
    return ['on', 'true', '1', 'sim', 'ativado'].includes(normalized);
}

/**
 * Menu principal no PV
 */
function getMainMenuPV() {
    return `⚙️ *CONFIGURAÇÃO DO BOT* ⚙️

Escolha uma categoria:

0️⃣ Perfil (nome, foto, status, bio)
1️⃣ Básico (prefixo, dono, idioma)
2️⃣ Comportamento (modo, IA, limites)
3️⃣ Segurança (antispam, blacklist)
4️⃣ Mensagens (boas-vindas, rodapé)
5️⃣ Logs (nível, destino)
6️⃣ Performance (cache, timeout)
7️⃣ Notificações (erros, grupos)
8️⃣ Visual (emoji, estilo)
9️⃣ Avançado (exportar, resetar)

📋 *listar* - Ver todas as configurações
❓ *ajuda* - Ajuda completa

Digite o número da categoria ou use:
/cb [comando] [valor]`;
}

/**
 * Menu em grupo
 */
function getMainMenuGroup() {
    return `⚙️ *CONFIGURAÇÃO DO GRUPO* ⚙️

Configurações disponíveis para este grupo:

1️⃣ Básico (prefixo do grupo)
2️⃣ Comportamento (IA, limites)
3️⃣ Segurança (antispam, blacklist)
4️⃣ Mensagens (boas-vindas, despedida)
8️⃣ Visual (emoji, estilo)

📋 *listar* - Ver configurações do grupo
❓ *ajuda* - Ajuda

💡 Para configurações globais do bot,
   use /cb no privado!

Digite o número ou use:
/cb [comando] [valor]`;
}

/**
 * Ajuda completa
 */
function getHelpText(isPrivate) {
    if (isPrivate) {
        return `📚 *AJUDA - CONFIGURAÇÃO DO BOT* 📚

*PERFIL DO BOT* (apenas PV):
• /cb nome [nome] - Altera nome do bot
• /cb foto - Aguarda imagem para foto
• /cb foto remover - Remove foto
• /cb status [texto] - Altera status
• /cb bio [texto] - Altera biografia

*BÁSICO*:
• /cb prefixo [símbolo] - Define prefixo
• /cb dono [nome] - Define nome do dono
• /cb contato [número] - Define contato
• /cb idioma [pt|en|es] - Define idioma
• /cb versao [número] - Define versão

*COMPORTAMENTO*:
• /cb modo [público|privado|híbrido]
• /cb ia [on|off] - IA automática
• /cb limite_usuario [número]
• /cb limite_grupo [número]
• /cb manutencao [on|off]

*SEGURANÇA*:
• /cb antispam [on|off]
• /cb blacklist add [palavra]
• /cb blacklist remove [palavra]
• /cb blacklist listar
• /cb whitelist add [grupo_id]
• /cb whitelist remove [grupo_id]

*MENSAGENS*:
• /cb bemvindo [texto]
• /cb despedida [texto]
• /cb rodape [texto]

*AVANÇADO*:
• /cb listar - Lista configurações
• /cb exportar - Exporta em JSON
• /cb resetar - Reseta tudo`;
    } else {
        return `📚 *AJUDA - CONFIGURAÇÃO DO GRUPO* 📚

*BÁSICO*:
• /cb prefixo [símbolo] - Prefixo do grupo

*COMPORTAMENTO*:
• /cb ia [on|off] - IA neste grupo

*SEGURANÇA*:
• /cb antispam [on|off] - Anti-spam
• /cb blacklist add [palavra]
• /cb blacklist remove [palavra]

*MENSAGENS*:
• /cb bemvindo [texto] - Boas-vindas
• /cb despedida [texto] - Despedida

*VISUAL*:
• /cb emoji [emoji] - Emoji padrão
• /cb estilo [formal|casual|divertido]

💡 Use /cb no PV para configurações globais!`;
    }
}

/**
 * Lista todas as configurações
 */
function listAllConfigs(isPrivate, groupJid = null) {
    let output = '📋 *CONFIGURAÇÕES ATUAIS* 📋\n\n';

    // Configurações básicas
    output += '*BÁSICO:*\n';
    output += `• Prefixo: ${db.config.obterConfiguracao('prefixo') || '/'}\n`;
    output += `• Dono: ${db.config.obterConfiguracao('dono') || 'Não definido'}\n`;
    output += `• Contato: ${db.config.obterConfiguracao('contato_dono') || 'Não definido'}\n`;
    output += `• Idioma: ${db.config.obterConfiguracao('idioma') || 'pt'}\n`;
    output += `• Versão: ${db.config.obterConfiguracao('versao') || '1.0.0'}\n\n`;

    if (isPrivate) {
        // Configurações avançadas (apenas no PV)
        const comportamento = db.config.listarConfiguracoesPorCategoria('comportamento');
        if (comportamento.length > 0) {
            output += '*COMPORTAMENTO:*\n';
            comportamento.forEach(c => {
                output += `• ${c.chave}: ${c.valor}\n`;
            });
            output += '\n';
        }

        const seguranca = db.config.listarConfiguracoesPorCategoria('seguranca');
        if (seguranca.length > 0) {
            output += '*SEGURANÇA:*\n';
            seguranca.forEach(c => {
                output += `• ${c.chave}: ${c.valor}\n`;
            });
            output += '\n';
        }
    } else if (groupJid) {
        // Configurações do grupo
        output += '*CONFIGURAÇÕES DO GRUPO:*\n';
        const prefixoGrupo = db.config.obterConfiguracaoGrupo(groupJid, 'prefixo');
        if (prefixoGrupo) {
            output += `• Prefixo: ${prefixoGrupo}\n`;
        }

        const iaGrupo = db.config.obterConfiguracaoGrupo(groupJid, 'ia_ativa');
        if (iaGrupo !== null) {
            output += `• IA: ${iaGrupo === 'true' ? 'Ativada' : 'Desativada'}\n`;
        }
    }

    return output;
}

/**
 * Comando principal
 */
async function execute({ sock, chatJid, senderId, args, isGroup, permissionLevel, message }) {
    const isPrivate = isPrivateChat(chatJid);

    // Verifica permissões
    if (permissionLevel !== 'owner') {
        return '❌ Apenas o dono do bot pode usar este comando!';
    }

    // Se não tem argumentos, mostra menu
    if (args.length === 0) {
        return isPrivate ? getMainMenuPV() : getMainMenuGroup();
    }

    const [comando, ...valores] = args;
    const valor = valores.join(' ');

    switch (comando.toLowerCase()) {
        // ========== MENU E AJUDA ==========
        case 'ajuda':
        case 'help':
            return getHelpText(isPrivate);

        case 'listar':
        case 'list':
            return listAllConfigs(isPrivate, isGroup ? chatJid : null);

        // ========== PERFIL DO BOT (APENAS PV) ==========
        case 'nome':
        case 'name':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!\n💡 Abra uma conversa com o bot para usar esta função.';
            }

            if (!valor) {
                return '❌ Digite o novo nome do bot!\n\nExemplo: /cb nome Severino Bot Oficial';
            }

            const nameResult = await profileManager.updateProfileName(sock, valor);

            if (nameResult.success) {
                return `✅ Nome do bot alterado com sucesso!\n\n📝 Nome novo: ${nameResult.newName}\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                return `❌ Erro ao alterar nome: ${nameResult.error}`;
            }

        case 'foto':
        case 'photo':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (valor === 'remover' || valor === 'remove') {
                const removeResult = await profileManager.removeProfilePicture(sock);

                if (removeResult.success) {
                    return `✅ Foto de perfil removida com sucesso!\n⏰ Atualizado em: ${formatDateTime()}`;
                } else {
                    return `❌ Erro ao remover foto: ${removeResult.error}`;
                }
            }

            // Aguarda imagem
            photoStates.set(senderId, {
                timestamp: Date.now(),
                timeout: setTimeout(() => {
                    photoStates.delete(senderId);
                }, 60000) // 60 segundos
            });

            return `📸 Envie a imagem que deseja usar como foto de perfil.\n\n⏱️ Você tem 60 segundos para enviar.`;

        case 'status':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (!valor) {
                return '❌ Digite o novo status!\n\nExemplo: /cb status Assistente virtual 24/7 🤖';
            }

            const statusResult = await profileManager.updateProfileStatus(sock, valor);

            if (statusResult.success) {
                return `✅ Status atualizado com sucesso!\n\n📝 Status novo: ${statusResult.newStatus}\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                return `❌ Erro ao atualizar status: ${statusResult.error}`;
            }

        case 'bio':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (!valor) {
                return '❌ Digite a nova biografia!\n\nExemplo: /cb bio Bot de automação e diversão!';
            }

            // Bio é o mesmo que status no WhatsApp
            const bioResult = await profileManager.updateProfileStatus(sock, valor);

            if (bioResult.success) {
                return `✅ Biografia atualizada com sucesso!\n\n📝 Bio nova: ${bioResult.newStatus}\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                return `❌ Erro ao atualizar biografia: ${bioResult.error}`;
            }

        // ========== CONFIGURAÇÕES BÁSICAS ==========
        case 'prefixo':
        case 'prefix':
            if (!valor) {
                return '❌ Digite o novo prefixo!\n\nExemplo: /cb prefixo !';
            }

            if (isGroup) {
                // Salva prefixo específico do grupo
                db.config.salvarConfiguracaoGrupo(chatJid, 'prefixo', valor);
                return `✅ Prefixo do grupo alterado!\n\n📝 Prefixo: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                // Salva prefixo global
                db.config.salvarConfiguracao('prefixo', valor);
                return `✅ Prefixo global alterado!\n\n📝 Prefixo: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;
            }

        case 'dono':
        case 'owner':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (!valor) {
                return '❌ Digite o nome do dono!';
            }

            db.config.salvarConfiguracao('dono', valor);
            return `✅ Nome do dono definido!\n\n📝 Dono: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;

        case 'contato':
        case 'contact':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (!valor) {
                return '❌ Digite o contato do dono!';
            }

            db.config.salvarConfiguracao('contato_dono', valor);
            return `✅ Contato do dono definido!\n\n📝 Contato: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;

        case 'idioma':
        case 'language':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            const idiomasValidos = ['pt', 'en', 'es'];
            if (!idiomasValidos.includes(valor)) {
                return `❌ Idioma inválido!\n\nUse: ${idiomasValidos.join(', ')}`;
            }

            db.config.salvarConfiguracao('idioma', valor);
            return `✅ Idioma alterado!\n\n📝 Idioma: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;

        case 'versao':
        case 'version':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (!valor) {
                return '❌ Digite a versão!';
            }

            db.config.salvarConfiguracao('versao', valor);
            return `✅ Versão definida!\n\n📝 Versão: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;

        // ========== COMPORTAMENTO ==========
        case 'modo':
        case 'mode':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            const modosValidos = ['público', 'publico', 'privado', 'híbrido', 'hibrido'];
            if (!modosValidos.includes(valor.toLowerCase())) {
                return '❌ Modo inválido!\n\nUse: público, privado ou híbrido';
            }

            db.config.salvarConfiguracaoAvancada('comportamento', 'modo', valor, 'string');
            return `✅ Modo de operação alterado!\n\n📝 Modo: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;

        case 'ia':
            const iaValue = parseBoolean(valor);

            if (isGroup) {
                db.config.salvarConfiguracaoGrupo(chatJid, 'ia_ativa', String(iaValue));
                return `✅ IA ${iaValue ? 'ativada' : 'desativada'} neste grupo!\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                db.config.salvarConfiguracaoAvancada('comportamento', 'ia_ativa', iaValue, 'boolean');
                return `✅ IA ${iaValue ? 'ativada' : 'desativada'} globalmente!\n⏰ Atualizado em: ${formatDateTime()}`;
            }

        case 'manutencao':
        case 'maintenance':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            const manutencaoValue = parseBoolean(valor);
            db.config.salvarConfiguracaoAvancada('comportamento', 'manutencao', manutencaoValue, 'boolean');
            return `✅ Modo manutenção ${manutencaoValue ? 'ativado' : 'desativado'}!\n⏰ Atualizado em: ${formatDateTime()}`;

        // ========== SEGURANÇA ==========
        case 'antispam':
            const antispamValue = parseBoolean(valor);

            if (isGroup) {
                db.config.salvarConfiguracaoGrupo(chatJid, 'antispam', String(antispamValue));
                return `✅ Anti-spam ${antispamValue ? 'ativado' : 'desativado'} neste grupo!\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                db.config.salvarConfiguracaoAvancada('seguranca', 'antispam', antispamValue, 'boolean');
                return `✅ Anti-spam ${antispamValue ? 'ativado' : 'desativado'} globalmente!\n⏰ Atualizado em: ${formatDateTime()}`;
            }

        case 'blacklist':
            if (valores.length < 2) {
                return '❌ Use: /cb blacklist [add|remove|listar] [palavra]';
            }

            const blacklistAction = valores[0].toLowerCase();
            const blacklistWord = valores.slice(1).join(' ');

            const blacklistKey = isGroup ? `blacklist_${chatJid}` : 'blacklist_global';
            let blacklist = db.config.obterConfiguracaoAvancada('seguranca', blacklistKey) || [];

            if (blacklistAction === 'add' || blacklistAction === 'adicionar') {
                if (!blacklistWord) {
                    return '❌ Digite a palavra para adicionar!';
                }

                if (!blacklist.includes(blacklistWord)) {
                    blacklist.push(blacklistWord);
                    db.config.salvarConfiguracaoAvancada('seguranca', blacklistKey, blacklist, 'json');
                    return `✅ Palavra adicionada à blacklist!\n\n📝 Palavra: ${blacklistWord}\n⏰ Atualizado em: ${formatDateTime()}`;
                } else {
                    return '⚠️ Palavra já está na blacklist!';
                }
            } else if (blacklistAction === 'remove' || blacklistAction === 'remover') {
                if (!blacklistWord) {
                    return '❌ Digite a palavra para remover!';
                }

                const index = blacklist.indexOf(blacklistWord);
                if (index > -1) {
                    blacklist.splice(index, 1);
                    db.config.salvarConfiguracaoAvancada('seguranca', blacklistKey, blacklist, 'json');
                    return `✅ Palavra removida da blacklist!\n\n📝 Palavra: ${blacklistWord}\n⏰ Atualizado em: ${formatDateTime()}`;
                } else {
                    return '⚠️ Palavra não encontrada na blacklist!';
                }
            } else if (blacklistAction === 'listar' || blacklistAction === 'list') {
                if (blacklist.length === 0) {
                    return '📋 Blacklist vazia!';
                }

                return `📋 *BLACKLIST*\n\n${blacklist.map((w, i) => `${i + 1}. ${w}`).join('\n')}`;
            }

            return '❌ Ação inválida! Use: add, remove ou listar';

        // ========== MENSAGENS ==========
        case 'bemvindo':
        case 'welcome':
            if (!valor) {
                return '❌ Digite a mensagem de boas-vindas!';
            }

            if (isGroup) {
                db.config.salvarConfiguracaoGrupo(chatJid, 'msg_bemvindo', valor);
                return `✅ Mensagem de boas-vindas do grupo definida!\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                db.config.salvarConfiguracaoAvancada('mensagens', 'bemvindo', valor, 'string');
                return `✅ Mensagem de boas-vindas global definida!\n⏰ Atualizado em: ${formatDateTime()}`;
            }

        case 'despedida':
        case 'goodbye':
            if (!valor) {
                return '❌ Digite a mensagem de despedida!';
            }

            if (isGroup) {
                db.config.salvarConfiguracaoGrupo(chatJid, 'msg_despedida', valor);
                return `✅ Mensagem de despedida do grupo definida!\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                db.config.salvarConfiguracaoAvancada('mensagens', 'despedida', valor, 'string');
                return `✅ Mensagem de despedida global definida!\n⏰ Atualizado em: ${formatDateTime()}`;
            }

        case 'rodape':
        case 'footer':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (!valor) {
                return '❌ Digite o rodapé das mensagens!';
            }

            db.config.salvarConfiguracaoAvancada('mensagens', 'rodape', valor, 'string');
            return `✅ Rodapé definido!\n\n📝 Rodapé: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;

        // ========== VISUAL ==========
        case 'emoji':
            if (!valor) {
                return '❌ Digite o emoji padrão!';
            }

            if (isGroup) {
                db.config.salvarConfiguracaoGrupo(chatJid, 'emoji', valor);
                return `✅ Emoji do grupo definido!\n\n📝 Emoji: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                db.config.salvarConfiguracaoAvancada('visual', 'emoji', valor, 'string');
                return `✅ Emoji global definido!\n\n📝 Emoji: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;
            }

        case 'estilo':
        case 'style':
            const estilosValidos = ['formal', 'casual', 'divertido'];
            if (!estilosValidos.includes(valor.toLowerCase())) {
                return `❌ Estilo inválido!\n\nUse: ${estilosValidos.join(', ')}`;
            }

            if (isGroup) {
                db.config.salvarConfiguracaoGrupo(chatJid, 'estilo', valor);
                return `✅ Estilo do grupo definido!\n\n📝 Estilo: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;
            } else {
                db.config.salvarConfiguracaoAvancada('visual', 'estilo', valor, 'string');
                return `✅ Estilo global definido!\n\n📝 Estilo: ${valor}\n⏰ Atualizado em: ${formatDateTime()}`;
            }

        // ========== AVANÇADO ==========
        case 'exportar':
        case 'export':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            const configs = db.config.exportarConfiguracoes();
            const jsonString = JSON.stringify(configs, null, 2);

            return `📦 *EXPORTAÇÃO DE CONFIGURAÇÕES*\n\n\`\`\`json\n${jsonString}\n\`\`\`\n\n💡 Copie este JSON para fazer backup!`;

        case 'resetar':
        case 'reset':
            if (!isPrivate) {
                return '❌ Este comando só pode ser usado no privado!';
            }

            if (!valor) {
                // Reseta tudo
                db.config.resetarTudo();
                return `✅ Todas as configurações avançadas foram resetadas!\n⏰ ${formatDateTime()}`;
            } else {
                // Reseta categoria específica
                db.config.resetarCategoria(valor);
                return `✅ Configurações da categoria "${valor}" resetadas!\n⏰ ${formatDateTime()}`;
            }

        default:
            return `❌ Comando inválido!\n\nUse /cb para ver o menu ou /cb ajuda para ajuda completa.`;
    }
}

/**
 * Processa mensagem de imagem para foto de perfil
 */
async function handlePhotoMessage(sock, senderId, message) {
    const state = photoStates.get(senderId);

    if (!state) {
        return null; // Não está aguardando foto
    }

    // Limpa timeout e estado
    clearTimeout(state.timeout);
    photoStates.delete(senderId);

    // Processa a imagem
    const result = await profileManager.processImageMessage(sock, message);

    if (result.success) {
        return `✅ Foto de perfil atualizada com sucesso!\n⏰ Atualizado em: ${formatDateTime()}`;
    } else {
        return `❌ Erro ao atualizar foto: ${result.error}`;
    }
}

module.exports = {
    name: 'configurarbot',
    description: 'Sistema completo de configuração do bot.',
    category: 'adm',
    permission: 'owner',
    execute,
    handlePhotoMessage,
    photoStates,
    aliases: ['configbot', 'botconfig', 'cb'],
};
