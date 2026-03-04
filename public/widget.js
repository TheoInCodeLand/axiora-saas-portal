(function() {
    const scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"]');
    const userId = scriptTag.getAttribute('data-user');
    const serverUrl = 'http://localhost:3000'; 
    let chatHistory = [];

    // 1. Enhanced, Professional CSS
    const style = document.createElement('style');
    style.innerHTML = `
        #axiora-widget-container {
            position: fixed; bottom: 24px; right: 24px; z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        #axiora-chat-window {
            display: none; width: 360px; height: 550px; max-height: 80vh;
            background: #ffffff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            flex-direction: column; overflow: hidden; border: 1px solid #f1f5f9;
            margin-bottom: 20px; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        #axiora-header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; 
            padding: 18px 20px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px;
            display: flex; justify-content: space-between; align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05); z-index: 10;
        }
        #axiora-header-title { display: flex; align-items: center; gap: 8px; }
        .axiora-status-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px rgba(34,197,94,0.6); }
        #axiora-close-btn { background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 20px; transition: color 0.2s; padding: 0;}
        #axiora-close-btn:hover { color: #ffffff; }
        
        #axiora-messages { 
            flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; background: #f8fafc; scroll-behavior: smooth;
        }
        /* Custom Scrollbar for sleekness */
        #axiora-messages::-webkit-scrollbar { width: 6px; }
        #axiora-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        
        .axiora-msg { padding: 12px 16px; border-radius: 12px; font-size: 14.5px; line-height: 1.5; max-width: 85%; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05);}
        .axiora-user-msg { background: #2563eb; color: #ffffff; align-self: flex-end; border-bottom-right-radius: 4px;}
        .axiora-ai-msg { background: #ffffff; color: #334155; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0;}
        
        /* The Professional Link Styling */
        .axiora-link {
            display: inline-flex; align-items: center; gap: 4px;
            color: #2563eb; font-weight: 600; text-decoration: none;
            background: #eff6ff; padding: 2px 8px; border-radius: 6px;
            margin: 2px 0; transition: all 0.2s ease; border: 1px solid transparent;
        }
        .axiora-link:hover { background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; transform: translateY(-1px); }
        .axiora-link svg { width: 14px; height: 14px; }
        
        /* Animated Typing Dots */
        .axiora-typing { display: flex; gap: 5px; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; border-bottom-left-radius: 4px; align-self: flex-start; width: fit-content; box-shadow: 0 1px 2px rgba(0,0,0,0.05);}
        .axiora-dot { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: axiora-bounce 1.4s infinite ease-in-out both; }
        .axiora-dot:nth-child(1) { animation-delay: -0.32s; }
        .axiora-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes axiora-bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        
        #axiora-input-area { display: flex; padding: 14px; border-top: 1px solid #e2e8f0; background: #ffffff; align-items: center; gap: 10px;}
        #axiora-input { flex: 1; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; font-size: 14px; transition: border-color 0.2s; background: #f8fafc;}
        #axiora-input:focus { border-color: #2563eb; background: #ffffff; box-shadow: 0 0 0 3px rgba(37,99,235,0.1);}
        #axiora-send-btn { background: #2563eb; color: #ffffff; border: none; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s;}
        #axiora-send-btn:hover { background: #1d4ed8; transform: scale(1.05);}
        #axiora-send-btn svg { width: 18px; height: 18px; fill: currentColor; }
        
        #axiora-fab {
            width: 64px; height: 64px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 50%;
            display: flex; justify-content: center; align-items: center; color: white;
            box-shadow: 0 6px 16px rgba(37,99,235,0.4); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
        }
        #axiora-fab:hover { transform: scale(1.08); box-shadow: 0 8px 20px rgba(37,99,235,0.5); }
        #axiora-fab svg { width: 32px; height: 32px; fill: currentColor; }
    `;
    document.head.appendChild(style);

    // 2. Construct DOM Elements
    const container = document.createElement('div');
    container.id = 'axiora-widget-container';
    container.innerHTML = `
        <div id="axiora-chat-window">
            <div id="axiora-header">
                <div id="axiora-header-title">
                    <div class="axiora-status-dot"></div>
                    Expert Support
                </div>
                <button id="axiora-close-btn">✖</button>
            </div>
            <div id="axiora-messages">
                <div class="axiora-msg axiora-ai-msg">Hello! I'm here to help you navigate our services. How can I assist you today?</div>
            </div>
            <div id="axiora-input-area">
                <input type="text" id="axiora-input" placeholder="Type your message..." autocomplete="off" />
                <button id="axiora-send-btn">
                    <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                </button>
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

    // 3. The Formatter: Converts raw AI text into beautiful HTML
    function formatMessageText(text) {
        let formatted = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Basic XSS protection
        
        // Convert **bold** text to <strong> tags
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert Markdown Links [Title](URL) to styled anchor tags with an external icon
        const linkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        
        formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, 
            `<a href="$2" target="_blank" class="axiora-link">$1 ${linkIcon}</a>`
        );
        
        // Convert raw URLs (that aren't already part of an anchor tag)
        formatted = formatted.replace(/(^|[^"'])(https?:\/\/[^\s]+)/g, 
            `$1<a href="$2" target="_blank" class="axiora-link">View Resource ${linkIcon}</a>`
        );

        // Handle line breaks
        return formatted.replace(/\n/g, '<br>');
    }

    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        const id = 'msg-' + Date.now();
        msgDiv.id = id;
        
        if (sender === 'loading') {
            msgDiv.className = 'axiora-typing';
            msgDiv.innerHTML = '<div class="axiora-dot"></div><div class="axiora-dot"></div><div class="axiora-dot"></div>';
        } else {
            msgDiv.className = `axiora-msg axiora-${sender}-msg`;
            msgDiv.innerHTML = formatMessageText(text);
        }
        
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return id;
    }

    // 4. Send Message Logic
    const sendMessage = async () => {
        const text = inputField.value.trim();
        if (!text) return;

        appendMessage(text, 'user');
        inputField.value = '';

        const loadingId = appendMessage('', 'loading');

        try {
            const response = await fetch(`${serverUrl}/engine/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, question: text, history: chatHistory })
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

})();