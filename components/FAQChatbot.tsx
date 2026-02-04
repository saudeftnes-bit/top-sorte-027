import React, { useState, useRef, useEffect } from 'react';
import type { Raffle } from '../types/database';

interface Message {
    text: string;
    isBot: boolean;
    timestamp: Date;
}

interface FAQChatbotProps {
    raffle?: Raffle;
}

const FAQChatbot: React.FC<FAQChatbotProps> = ({ raffle }) => {
    const [isOpen, setIsOpen] = useState(false);
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
        const msg = userMessage.toLowerCase();

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

        // 8. Atendimento/Ajuda
        if (msg.includes('atendente') || msg.includes('ajuda') || msg.includes('falar') || msg.includes('contato')) {
            return `Claro! Nosso David está à disposição! 😊\n\nClique no botão abaixo para falar diretamente com ele pelo WhatsApp:`;
        }

        // Fallback - não entendeu
        return `Hmm, não entendi muito bem sua dúvida... 🤔\n\nMas não se preocupe! O David pode te ajudar com qualquer coisa. Clique no botão abaixo para falar com ele:`;
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

            // Adicionar botão WhatsApp se for sobre contato ou não entendeu
            const msg = messageText.toLowerCase();
            if (msg.includes('atendente') || msg.includes('ajuda') || msg.includes('falar') ||
                (!msg.includes('funciona') && !msg.includes('valor') && !msg.includes('pagamento') &&
                    !msg.includes('tempo') && !msg.includes('prêmio') && !msg.includes('escolher') &&
                    !msg.includes('quantos'))) {
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
            {/* Botão flutuante */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform active:scale-95 flex items-center gap-2"
                style={{ width: isOpen ? 'auto' : '64px', height: '64px' }}
            >
                {isOpen ? (
                    <>
                        <span className="text-2xl">✕</span>
                        <span className="font-bold pr-2">Fechar</span>
                    </>
                ) : (
                    <span className="text-3xl">💬</span>
                )}
            </button>

            {/* Chat window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-3xl shadow-2xl border-2 border-purple-200 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl">
                            🎯
                        </div>
                        <div>
                            <h3 className="font-black text-lg">Assistente Top Sorte</h3>
                            <p className="text-xs opacity-90">Online • Responde na hora!</p>
                        </div>
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
                                            href="https://wa.me/5527999752623?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20sorteio"
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
