document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    
    const ingestForm = document.getElementById('ingestForm');
    const ingestBtn = document.getElementById('ingestBtn');
    const ingestStatus = document.getElementById('ingestStatus');
    
    const testChatBtn = document.getElementById('testChatBtn');
    const testChatInput = document.getElementById('testChatInput');
    const testChatWindow = document.getElementById('testChatWindow');
    const hiddenUserId = document.getElementById('hiddenUserId');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        });
    }
    if (ingestForm) {
        ingestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const targetUrl = document.getElementById('targetUrl').value.trim();
            if (!targetUrl) return;

            ingestBtn.disabled = true;
            ingestBtn.innerText = 'Processing...';
            ingestBtn.classList.add('opacity-70', 'cursor-not-allowed');
            ingestStatus.classList.remove('hidden', 'text-red-600', 'text-green-600');
            ingestStatus.classList.add('text-blue-600');
            ingestStatus.innerHTML = 'Connecting to AI Engine... Please wait.';

            try {
                const response = await fetch('/engine/ingest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetUrl })
                });

                const data = await response.json();

                if (response.ok) {
                    ingestStatus.classList.replace('text-blue-600', 'text-green-600');
                    ingestStatus.innerHTML = `✅ Success! ${data.chunks_saved_to_db || data.chunks || 'Data'} vectors saved. Reloading...`;
                    
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    ingestStatus.classList.replace('text-blue-600', 'text-red-600');
                    ingestStatus.innerHTML = `❌ Error: ${data.error || 'Failed to ingest.'}`;
                    resetBtn();
                }
            } catch (error) {
                ingestStatus.classList.replace('text-blue-600', 'text-red-600');
                ingestStatus.innerHTML = '❌ Network connection failed.';
                resetBtn();
            }
        });
    }

    function resetBtn() {
        ingestBtn.disabled = false;
        ingestBtn.innerText = 'Ingest Data';
        ingestBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    }

    let testChatHistory = [];

    function formatMessageText(text) {
        let formatted = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        const linkIcon = `<svg style="width:14px;height:14px;display:inline;margin-left:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        
        formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, 
            `<a href="$2" target="_blank" class="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center hover:underline">$1 ${linkIcon}</a>`
        );
        formatted = formatted.replace(/(^|[^"'])(https?:\/\/[^\s]+)/g, 
            `$1<a href="$2" target="_blank" class="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center hover:underline">View Resource ${linkIcon}</a>`
        );

        return formatted.replace(/\n/g, '<br>');
    }

    if (testChatBtn && testChatInput && testChatWindow && hiddenUserId) {
        const userId = hiddenUserId.value;

        const appendMessage = (text, sender) => {
            const msgDiv = document.createElement('div');
            const id = 'msg-' + Date.now();
            msgDiv.id = id;
            
            if (sender === 'loading') {
                msgDiv.className = 'italic text-slate-500 text-xs self-start ml-1';
                msgDiv.innerHTML = text;
            } else if (sender === 'user') {
                msgDiv.className = 'bg-blue-600 text-white p-3 rounded-lg rounded-br-none self-end max-w-[85%] shadow-sm text-sm';
                msgDiv.innerHTML = text.replace(/\n/g, '<br>');
            } else {
                msgDiv.className = 'bg-white border border-gray-200 text-slate-800 p-3 rounded-lg rounded-tl-none self-start max-w-[85%] shadow-sm text-sm';
                msgDiv.innerHTML = formatMessageText(text);
            }
            
            testChatWindow.appendChild(msgDiv);
            testChatWindow.scrollTop = testChatWindow.scrollHeight;
            return id;
        };

        const sendTestMessage = async () => {
            const text = testChatInput.value.trim();
            if (!text) return;

            appendMessage(text, 'user');
            testChatInput.value = '';

            const loadingId = appendMessage('AI is thinking...', 'loading');

            try {
                const response = await fetch('/engine/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        question: text,
                        history: testChatHistory
                    })
                });

                const data = await response.json();
                
                document.getElementById(loadingId).remove();

                if (response.ok) {
                    appendMessage(data.answer, 'ai');
                    
                    testChatHistory.push({ role: 'user', content: text });
                    testChatHistory.push({ role: 'assistant', content: data.answer });
                } else {
                    appendMessage(`Error: ${data.error}`, 'ai');
                }
            } catch (error) {
                document.getElementById(loadingId).remove();
                appendMessage('Network error. Ensure the Python engine is running on port 8000.', 'ai');
            }
        };

        testChatBtn.addEventListener('click', sendTestMessage);
        testChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendTestMessage();
        });
    }
});


window.deleteKb = async (kbId) => {
    if (!confirm('Are you sure you want to delete this knowledge base? The AI will no longer know about this URL.')) {
        return;
    }

    try {
        const response = await fetch(`/engine/knowledge-base/${kbId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            window.location.reload();
        } else {
            const data = await response.json();
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert('Network error while trying to delete.');
    }
};

window.resyncUrl = (url) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 2. Populate the input field
    const urlInput = document.getElementById('targetUrl');
    urlInput.value = url;
    
    urlInput.classList.add('ring-2', 'ring-green-500');
    setTimeout(() => urlInput.classList.remove('ring-2', 'ring-green-500'), 1500);
    document.getElementById('ingestForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
};