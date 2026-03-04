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
                    ingestStatus.innerHTML = `✅ Success! ${data.chunks} vectors saved. Reloading...`;
                    
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    ingestStatus.classList.replace('text-blue-600', 'text-red-600');
                    ingestStatus.innerHTML = `❌ Error: ${data.error}`;
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

    if (testChatBtn && testChatInput && testChatWindow && hiddenUserId) {
        const userId = hiddenUserId.value;

        const appendMessage = (text, sender) => {
            const msgDiv = document.createElement('div');
            const id = 'msg-' + Date.now();
            msgDiv.id = id;
            
            if (sender === 'loading') {
                msgDiv.className = 'italic text-slate-500 text-xs self-start ml-1';
            } else if (sender === 'user') {
                msgDiv.className = 'bg-blue-600 text-white p-3 rounded-lg rounded-br-none self-end max-w-[85%] shadow-sm text-sm';
            } else {
                msgDiv.className = 'bg-white border border-gray-200 text-slate-800 p-3 rounded-lg rounded-tl-none self-start max-w-[85%] shadow-sm text-sm';
            }
            
            msgDiv.innerHTML = text.replace(/\n/g, '<br>');
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