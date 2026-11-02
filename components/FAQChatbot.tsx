import React, { useState, useRef, useEffect } from 'react';
import type { Raffle } from '../types/database';
import type { ReservationMap } from '../App';

interface Message {
    text: string;
    isBot: boolean;
    timestamp: Date;
}

interface FAQChatbotProps {
    raffle?: Raffle;
    reservations?: ReservationMap;
    isOpen?: boolean;
    onToggle?: (open: boolean) => void;
}

const FAQChatbot: React.FC<FAQChatbotProps> = ({ raffle, reservations = {}, isOpen: externalIsOpen, onToggle }) => {
    const [localIsOpen, setLocalIsOpen] = useState(false);

    // Sincronizar ou usar estado local
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : localIsOpen;
    const setIsOpen = (val: boolean) => {
        if (onToggle) onToggle(val);
        setLocalIsOpen(val);
    };
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            // Mensagem de boas-vindas
            addBotMessage(
                `Olá! 👋 Sou o assistente da Top Sorte!\n\nEstou aqui para te ajudar com qualquer dúvida sobre o sorteio. Como posso te ajudar hoje?`,
                true
            );
        }
    }, [isOpen]);

    const addBotMessage = (text: string, withSuggestions = false) => {
        setMessages(prev => [...prev, { text, isBot: true, timestamp: new Date() }]);

        if (withSuggestions) {
            // Aguardar um pouco antes de mostrar sugestões
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    text: 'SUGGESTIONS',
                    isBot: true,
                    timestamp: new Date()
                }]);
            }, 500);
        }
    };

    const addUserMessage = (text: string) => {
        setMessages(prev => [...prev, { text, isBot: false, timestamp: new Date() }]);
    };

    const getBotResponse = (userMessage: string): string => {
        // Normalizar texto removendo acentos
        const normalizeText = (text: string) => {
            return text
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
        };

        const msg = normalizeText(userMessage);

        // 0. Saudações
        if (msg.match(/^(oi|olá|ola|hey|opa|bom dia|boa tarde|boa noite|e aí|eai|eae|salve)\b/i)) {
            const greetings = [
                `Oi! 👋 Seja muito bem-vindo(a) à Top Sorte! 😊\n\nEstou aqui para te ajudar com qualquer dúvida sobre nossos sorteios. O que você gostaria de saber?`,
                `Olá! 🎉 Que bom te ver por aqui!\n\nSou o assistente da Top Sorte e estou pronto para te ajudar. Em que posso te auxiliar hoje?`,
                `E aí! 😄 Tudo bem?\n\nSeja bem-vindo(a)! Estou aqui para esclarecer suas dúvidas sobre o sorteio. Como posso te ajudar?`,
                `Opa! 🎯 Prazer em te atender!\n\nTenho todas as informações sobre o sorteio aqui. O que você quer saber?`
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }

        // 1. Como funciona
        if (msg.includes('funciona') || msg.includes('como') && msg.includes('sorteio')) {
            return `É super simples! 😊\n\n1️⃣ Você escolhe seus números da sorte\n2️⃣ Faz o pagamento via PIX\n3️⃣ Envia o comprovante\n4️⃣ Participa do sorteio!\n\nO resultado é sorteado pela Loteria Federal, totalmente transparente! 🎯`;
        }

        // 2. Valor/Preço
        if (msg.includes('valor') || msg.includes('preço') || msg.includes('custa') || msg.includes('quanto')) {
            const price = raffle?.price_per_number || 13;
            return `Cada número custa apenas **R$ ${price.toFixed(2).replace('.', ',')}**! 💰\n\nÉ super acessível e você pode escolher quantos números quiser. Quanto mais números, mais chances de ganhar! 🍀`;
        }

        // 3. Pagamento
        if (msg.includes('pagamento') || msg.includes('pagar') || msg.includes('pix')) {
            return `O pagamento é via **PIX** - super rápido e seguro! ⚡\n\nApós escolher seus números, você vai:\n1. Ver os dados do PIX\n2. Fazer o pagamento\n3. Enviar o comprovante\n\nE pronto! Seus números ficam reservados! 🎉`;
        }

        // 4. Tempo de confirmação
        if (msg.includes('tempo') || msg.includes('demora') || msg.includes('confirma')) {
            return `Após enviar o comprovante, confirmamos em poucos minutos! ⏱️\n\nVocê receberá uma notificação assim que seus números forem confirmados. Geralmente é bem rapidinho! 😉`;
        }

        // 5. Prêmio
        if (msg.includes('prêmio') || msg.includes('premio') || msg.includes('ganhar')) {
            const title = raffle?.title || 'prêmio incrível';
            return `O prêmio deste sorteio é:\n\n🏆 **${title}** 🏆\n\nImagina você ganhando isso! 😍`;
        }

        // 6. Como escolher números
        if (msg.includes('escolher') && msg.includes('número')) {
            return `É fácil escolher seus números! 🎯\n\n- **Verde**: números disponíveis (clique para escolher)\n- **Roxo**: já escolhidos por você\n- **Amarelo**: outros participantes estão reservando\n- **Cinza**: já vendidos\n\nÉ só clicar nos verdes que você quer! 😊`;
        }

        // 7. Múltiplos números
        if (msg.includes('mais de um') || msg.includes('vários') || msg.includes('quantos')) {
            return `Pode escolher quantos números quiser! 🎰\n\nNão tem limite! Quanto mais números você tiver, maiores suas chances de ganhar. Muita gente escolhe vários de uma vez! 🍀`;
        }

        // 8. Números disponíveis
        if (msg.includes('disponí') || msg.includes('livre') || msg.includes('restam') || msg.includes('sobraram') ||
            (msg.match(/\b(tem|têm|ainda|ha|há)\b/i) && msg.match(/\b(número|numero)\b/i)) ||
            (msg.includes('quantos') && msg.includes('número'))) {
            const totalNumbers = raffle?.total_numbers || 100;
            const reservedCount = Object.keys(reservations).length;
            const availableCount = totalNumbers - reservedCount;
            const percentage = ((availableCount / totalNumbers) * 100).toFixed(0);

            if (availableCount > 50) {
                return `Temos ${availableCount} números disponíveis de ${totalNumbers}! 🎯\n\nIsso é ${percentage}% ainda livre! Muitas opções para você escolher! 😊\n\nCorra e garanta seus números da sorte! 🍀`;
            } else if (availableCount > 20) {
                return `Restam ${availableCount} números disponíveis de ${totalNumbers}! ⚡\n\nEstá vendendo rápido! Apenas ${percentage}% ainda disponível.\n\nGaranta os seus antes que acabem! 🏃‍♂️`;
            } else if (availableCount > 0) {
                return `🔥 Últimas chances! Apenas ${availableCount} números restantes de ${totalNumbers}!\n\nO sorteio está quase completo (só ${percentage}% disponível).\n\nCorra! Não perca essa oportunidade! ⏰`;
            } else {
                return `Ops! Todos os números já foram vendidos! 😮\n\nMas fique de olho que em breve teremos um novo sorteio incrível!\n\nQuer falar com o David para saber quando sai o próximo?`;
            }
        }

        // 9. Atendimento/Ajuda
        if (msg.includes('atendente') || msg.includes('ajuda') || msg.includes('falar') || msg.includes('contato')) {
            return `Claro! Nosso David está à disposição! 😊\n\nClique no botão abaixo para falar diretamente com ele pelo WhatsApp:`;
        }

        // Agradecimentos
        if (msg.match(/\b(obrigad[oa]|valeu|vlw|brigad[oa]|thanks)\b/i)) {
            return `Por nada! 😊 Fico feliz em ajudar!\n\nSe tiver mais alguma dúvida, é só perguntar! Estou aqui! 🎯`;
        }

        // Despedidas
        if (msg.match(/\b(tchau|até logo|até mais|adeus|flw|falou|bye)\b/i)) {
            return `Até logo! 👋 Foi um prazer te atender!\n\nBoa sorte no sorteio! 🍀✨`;
        }

        // Confirmações positivas
        if (msg.match(/^(sim|yes|ok|certo|entendi|beleza|blz|show)$/i)) {
            return `Ótimo! 👍\n\nAlguma outra dúvida que posso esclarecer?`;
        }

        // Negações
        if (msg.match(/^(não|nao|no)$/i)) {
            return `Tudo bem! 😊\n\nEstou aqui se precisar de ajuda!`;
        }

        // Perguntas sobre sorteio/resultado
        if (msg.includes('quando') && (msg.includes('sorteio') || msg.includes('resultado'))) {
            return `O sorteio segue o calendário da Loteria Federal! 🎲\n\nA data exata é informada pelo David no WhatsApp quando você reserva seus números. Quer falar com ele?`;
        }

        // Perguntas sobre segurança/confiança
        if (msg.includes('confiável') || msg.includes('seguro') || msg.includes('fraude') || msg.includes('golpe')) {
            return `Somos 100% transparentes! 😊\n\n✅ Sorteio pela Loteria Federal\n✅ Pagamento via PIX\n✅ Comprovante enviado\n✅ Ganhadores divulgados\n\nTodos os participantes podem acompanhar! Alguma dúvida específica?`;
        }

        // Fallback - não entendeu mas oferece ajuda contextual
        const fallbacks = [
            `Hmm, não entendi muito bem... 🤔\n\nMas talvez eu possa te ajudar com:\n• Como funciona o sorteio\n• Valor dos números\n• Forma de pagamento\n• Qual o prêmio\n\nOu clique abaixo para falar com o David!`,
            `Desculpa, não peguei essa! 😅\n\nQue tal perguntar sobre:\n• Como escolher números\n• Quanto tempo para confirmar\n• Como fazer o PIX\n\nOu converse direto com nosso atendente!`,
            `Ops, acho que não entendi... 🙈\n\nPosso te explicar:\n• O processo do sorteio\n• Valores e pagamento\n• Prêmio atual\n\nOu você pode falar com o David pelo botão abaixo!`
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    };

    const handleSuggestionClick = (suggestion: string) => {
        handleSendMessage(suggestion);
    };

    const handleSendMessage = (text?: string) => {
        const messageText = text || inputValue.trim();
        if (!messageText) return;

        addUserMessage(messageText);
        setInputValue('');

        // Simular digitação do bot
        setTimeout(() => {
            const response = getBotResponse(messageText);
            addBotMessage(response);

            // Adicionar sugestões para saudações
            const msg = messageText.toLowerCase();
            if (msg.match(/^(oi|olá|ola|hey|opa|bom dia|boa tarde|boa noite|e aí|eai|eae|salve)\b/i)) {
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        text: 'SUGGESTIONS',
                        isBot: true,
                        timestamp: new Date()
                    }]);
                }, 500);
            }
            // Não mostrar botão para agradecimentos, despedidas e confirmações
            else if (msg.match(/\b(obrigad[oa]|valeu|vlw|brigad[oa]|thanks|tchau|até logo|até mais|adeus|flw|falou|bye|sim|yes|ok|certo|entendi|beleza|blz|show|não|nao|no)\b/i)) {
                // Não faz nada - resposta simples sem botão
            }
            // Adicionar botão WhatsApp se for sobre contato ou não entendeu
            else if (msg.includes('atendente') || msg.includes('ajuda') || msg.includes('falar') ||
                msg.includes('quando') ||  // Para perguntas de data que sugerem falar com David
                (!msg.includes('funciona') && !msg.includes('valor') && !msg.includes('pagamento') &&
                    !msg.includes('tempo') && !msg.includes('prêmio') && !msg.includes('escolher') &&
                    !msg.includes('quantos') && !msg.includes('confiável') && !msg.includes('seguro'))) {
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        text: 'WHATSAPP_BUTTON',
                        isBot: true,
                        timestamp: new Date()
                    }]);
                }, 500);
            }
        }, 800);
    };

    const suggestions = [
        '💰 Qual o valor?',
        '🎯 Como funciona?',
        '💳 Como pagar?',
        '🏆 Qual o prêmio?',
        '💬 Falar com atendente'
    ];

    return (
        <>
            {/* Chat window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)] bg-white rounded-3xl shadow-2xl border-2 border-purple-200 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl">
                            🎯
                        </div>
                        <div className="flex-1">
                            <h3 className="font-black text-lg leading-none">Assistente Top Sorte</h3>
                            <p className="text-[10px] opacity-90 mt-1 uppercase tracking-wider font-bold">Online • Responde na hora!</p>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-10 h-10 bg-black/10 hover:bg-black/20 rounded-full flex items-center justify-center transition-all active:scale-95"
                            title="Fechar Assistente"
                        >
                            <span className="text-xl font-black">✕</span>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto h-96 bg-gradient-to-b from-purple-50 to-white">
                        {messages.map((msg, idx) => {
                            // Renderizar sugestões
                            if (msg.text === 'SUGGESTIONS') {
                                return (
                                    <div key={idx} className="flex flex-wrap gap-2 justify-center my-3">
                                        {suggestions.map((sug, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSuggestionClick(sug)}
                                                className="bg-white border-2 border-purple-300 text-purple-700 px-3 py-2 rounded-full text-xs font-bold hover:bg-purple-100 transition-colors"
                                            >
                                                {sug}
                                            </button>
                                        ))}
                                    </div>
                                );
                            }

                            // Renderizar botão WhatsApp
                            if (msg.text === 'WHATSAPP_BUTTON') {
                                return (
                                    <div key={idx} className="flex justify-center my-3">
                                        <a
                                            href="https://wa.me/5527992429263?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20sorteio"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="bg-green-500 hover:bg-green-600 text-white font-black px-6 py-3 rounded-full flex items-center gap-2 shadow-lg transition-all active:scale-95"
                                        >
                                            <span className="text-xl">📱</span>
                                            Falar com David
                                        </a>
                                    </div>
                                );
                            }

                            // Renderizar mensagens normais
                            return (
                                <div
                                    key={idx}
                                    className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl ${msg.isBot
                                            ? 'bg-white border-2 border-purple-200 text-slate-800'
                                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-line leading-relaxed">
                                            {msg.text}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t-2 border-purple-100 bg-white">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Digite sua pergunta..."
                                className="flex-1 px-4 py-3 rounded-full border-2 border-purple-300 focus:border-purple-600 focus:outline-none text-sm"
                            />
                            <button
                                onClick={() => handleSendMessage()}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-full hover:scale-110 transition-transform active:scale-95"
                            >
                                <span className="text-xl">➤</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FAQChatbot;
