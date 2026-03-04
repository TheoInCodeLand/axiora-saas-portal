(function() {
    const scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"]');
    const userId = scriptTag.getAttribute('data-user');
    
    const serverUrl = 'http://localhost:3000'; 
    let chatHistory = [];

    const style = document.createElement('style');
    style.innerHTML = `
        #axiora-widget-container {
            position: fixed; bottom: 20px; right: 20px; z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        #axiora-chat-window {
            display: none; width: 350px; height: 500px; max-height: 80vh;
            background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            flex-direction: column; overflow: hidden; border: 1px solid #e2e8f0;
            margin-bottom: 15px; transition: all 0.3s ease;
        }
        #axiora-header {
            background: #0f172a; color: #fff; padding: 15px; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        #axiora-close-btn { background: none; border: none; color: #fff; cursor: pointer; font-size: 18px; }
        #axiora-messages { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8fafc; }
        .axiora-msg { padding: 10px 14px; border-radius: 8px; font-size: 14px; line-height: 1.4; max-width: 85%; word-wrap: break-word;}
        .axiora-user-msg { background: #2563eb; color: #fff; align-self: flex-end; border-bottom-right-radius: 2px;}
        .axiora-ai-msg { background: #e2e8f0; color: #1e293b; align-self: flex-start; border-bottom-left-radius: 2px;}
        .axiora-loading { font-style: italic; color: #64748b; font-size: 12px; align-self: flex-start; }
        #axiora-input-area { display: flex; padding: 10px; border-top: 1px solid #e2e8f0; background: #fff; }
        #axiora-input { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
        #axiora-input:focus { border-color: #2563eb; }
        #axiora-send-btn { background: #2563eb; color: #fff; border: none; padding: 0 15px; margin-left: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        #axiora-send-btn:hover { background: #1d4ed8; }
        #axiora-fab {
            width: 60px; height: 60px; background: #2563eb; border-radius: 50%;
            display: flex; justify-content: center; align-items: center; color: white;
            box-shadow: 0 4px 12px rgba(37,99,235,0.4); cursor: pointer; transition: transform 0.2s;
        }
        #axiora-fab:hover { transform: scale(1.05); }
        #axiora-fab svg { width: 30px; height: 30px; fill: currentColor; }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = 'axiora-widget-container';

    container.innerHTML = `
        <div id="axiora-chat-window">
            <div id="axiora-header">
                <span>AI Support</span>
                <button id="axiora-close-btn">✖</button>
            </div>
            <div id="axiora-messages">
                <div class="axiora-msg axiora-ai-msg">Hi there! How can I help you today?</div>
            </div>
            <div id="axiora-input-area">
                <input type="text" id="axiora-input" placeholder="Type your question..." autocomplete="off" />
                <button id="axiora-send-btn">Send</button>
            </div>
        </div>
        <div id="axiora-fab">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>
        </div>
    `;
    document.body.appendChild(container);

    const fab = document.getElementById('axiora-fab');
    const chatWindow = document.getElementById('axiora-chat-window');
    const closeBtn = document.getElementById('axiora-close-btn');
    const inputField = document.getElementById('axiora-input');
    const sendBtn = document.getElementById('axiora-send-btn');
    const messagesDiv = document.getElementById('axiora-messages');

    fab.addEventListener('click', () => {
        chatWindow.style.display = chatWindow.style.display === 'flex' ? 'none' : 'flex';
        if (chatWindow.style.display === 'flex') inputField.focus();
    });

    closeBtn.addEventListener('click', () => chatWindow.style.display = 'none');

    const sendMessage = async () => {
        const text = inputField.value.trim();
        if (!text) return;

        appendMessage(text, 'user');
        inputField.value = '';

        const loadingId = appendMessage('AI is typing...', 'loading');

        try {
            const response = await fetch(`${serverUrl}/engine/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    question: text,
                    history: chatHistory
                })
            });

            const data = await response.json();
            document.getElementById(loadingId).remove();

            if (response.ok) {
                appendMessage(data.answer, 'ai');
                chatHistory.push({ role: 'user', content: text });
                chatHistory.push({ role: 'assistant', content: data.answer });
            } else {
                appendMessage(data.error || 'System error. Please try again.', 'ai');
            }
        } catch (error) {
            document.getElementById(loadingId).remove();
            appendMessage('Network error. Unable to connect to the server.', 'ai');
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // UI Helper: Append message to chat window
    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        const id = 'msg-' + Date.now();
        msgDiv.id = id;
        
        if (sender === 'loading') {
            msgDiv.className = 'axiora-loading';
        } else {
            msgDiv.className = `axiora-msg axiora-${sender}-msg`;
        }
        
        msgDiv.innerHTML = text.replace(/\n/g, '<br>');
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return id;
    }
})();