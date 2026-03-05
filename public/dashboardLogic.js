// dashboardLogic.js - Enterprise-Grade Secure Implementation

document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTS ===
    const logoutBtn = document.getElementById('logoutBtn');
    const ingestForm = document.getElementById('ingestForm');
    const ingestBtn = document.getElementById('ingestBtn');
    const ingestStatus = document.getElementById('ingestStatus');
    const testChatBtn = document.getElementById('testChatBtn');
    const testChatInput = document.getElementById('testChatInput');
    const testChatWindow = document.getElementById('testChatWindow');
    const hiddenUserId = document.getElementById('hiddenUserId');
    const aiState = document.getElementById('aiState');
    const debugPanel = document.getElementById('debugPanel');
    const debugContent = document.getElementById('debugContent');

    // === CONFIGURATION ===
    const MAX_MESSAGE_LENGTH = 1000;
    const MAX_HISTORY_LENGTH = 50;
    const API_TIMEOUT = 30000; // 30 seconds
    const RETRY_ATTEMPTS = 2;

    // === TEST SCENARIOS FOR CONVERSATIONAL AI ===
    const testScenarios = {
        angry: {
            text: "This is the THIRD time I've tried this and it STILL doesn't work!!! I'm so frustrated with your terrible system.",
            emotion: "frustrated",
            expectedPhase: "OBJECTION_HANDLING"
        },
        confused: {
            text: "Umm... so like how do I make it do the thing? I'm lost and don't understand any of this.",
            emotion: "confused",
            expectedPhase: "CLARIFICATION"
        },
        urgent: {
            text: "URGENT - Site is down, launch in 30 minutes. HELP. This is critical!",
            emotion: "urgent",
            expectedPhase: "SOLUTION_PRESENTATION"
        },
        technical: {
            text: "Getting 403 on webhook callback with OAuth2 PKCE. Scope check fails despite valid token. What's the issue?",
            emotion: "neutral",
            expectedPhase: "SOLUTION_PRESENTATION"
        },
        vague: {
            text: "Hi",
            emotion: "neutral",
            expectedPhase: "GREETING"
        },
        satisfied: {
            text: "Thanks so much! That worked perfectly. Really appreciate your help.",
            emotion: "satisfied",
            expectedPhase: "CLOSING"
        },
        sarcastic: {
            text: "Oh great, another chatbot that can't actually help. Let's see how long until you 'escalate to a human'.",
            emotion: "frustrated",
            expectedPhase: "OBJECTION_HANDLING"
        },
        topicShift: {
            text: "Actually wait, can you tell me about pricing first? I might not be able to afford this.",
            emotion: "neutral",
            expectedPhase: "DISCOVERY"
        },
        security: {
            text: "I think someone hacked my account. There are logins from Russia that aren't me.",
            emotion: "urgent",
            expectedPhase: "ESCALATION"
        },
        multiQuestion: {
            text: "Can I export to PDF, does it work on mobile, what's the price, and do you have an API?",
            emotion: "neutral",
            expectedPhase: "DISCOVERY"
        }
    };

    // === STATE MANAGEMENT ===
    let testChatHistory = [];
    let currentConversationState = {
        phase: 'GREETING',
        emotion: 'neutral',
        confidence: 0.0,
        rapportScore: 0,
        turnCount: 0
    };

    // === UTILITY FUNCTIONS ===

    /**
     * Sanitize HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Validate URL format and security
     */
    function isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol) &&
                   !parsed.hostname.includes('localhost') &&
                   !parsed.hostname.includes('127.0.0.1');
        } catch {
            return false;
        }
    }

    /**
     * Truncate text to prevent UI overflow
     */
    function truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Debounce function for rapid clicks
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // === UI UPDATE FUNCTIONS ===

    /**
     * Update AI state indicator
     */
    function updateAIState(emotion, phase, isLoading = false) {
        if (!aiState) return;

        const emotionColors = {
            frustrated: 'bg-red-500',
            confused: 'bg-yellow-500',
            urgent: 'bg-orange-500',
            satisfied: 'bg-green-500',
            neutral: 'bg-blue-500',
            unknown: 'bg-gray-500'
        };

        const color = emotionColors[emotion] || emotionColors.neutral;
        
        if (isLoading) {
            aiState.innerHTML = `
                <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                <span class="text-slate-600">Thinking...</span>
            `;
        } else {
            aiState.innerHTML = `
                <span class="w-2 h-2 ${color} rounded-full"></span>
                <span class="text-slate-600 capitalize">${emotion} • ${phase}</span>
            `;
        }
    }

    /**
     * Update debug panel with conversation state
     */
    function updateDebugPanel(data) {
        if (!debugContent) return;

        const info = {
            phase: data.phase || currentConversationState.phase,
            emotion: data.emotion_detected || currentConversationState.emotion,
            confidence: (data.confidence || 0).toFixed(2),
            rapport: data.rapport_score || currentConversationState.rapportScore,
            sources: data.sources_used || 0,
            turn: currentConversationState.turnCount
        };

        debugContent.innerHTML = `
            <div class="grid grid-cols-2 gap-2">
                <span>Phase:</span> <span class="text-white">${info.phase}</span>
                <span>Emotion:</span> <span class="text-white capitalize">${info.emotion}</span>
                <span>Confidence:</span> <span class="text-white">${info.confidence}</span>
                <span>Rapport:</span> <span class="text-white">${info.rapport}</span>
                <span>Sources:</span> <span class="text-white">${info.sources}</span>
                <span>Turn:</span> <span class="text-white">${info.turn}</span>
            </div>
        `;
    }

    /**
     * Format message text with markdown support and XSS protection
     */
    function formatMessageText(text) {
        if (!text) return '';

        // Step 1: Escape HTML to prevent XSS
        let formatted = escapeHtml(text);

        // Step 2: Format bold text (**text**)
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Step 3: Format links with security
        // Only allow http/https URLs, validate format
        const linkIcon = `<svg style="width:14px;height:14px;display:inline;margin-left:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

        // Markdown links [text](url)
        formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+)\)/g, 
            (match, p1, p2) => {
                // Validate URL
                if (!isValidUrl(p2)) return match;
                return `<a href="${escapeHtml(p2)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center hover:underline">${escapeHtml(p1)} ${linkIcon}</a>`;
            }
        );

        // Raw URLs (only http/https)
        formatted = formatted.replace(/(^|\s)(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+)/g, 
            (match, p1, p2) => {
                if (!isValidUrl(p2)) return match;
                const displayUrl = truncateText(p2, 40);
                return `${p1}<a href="${escapeHtml(p2)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center hover:underline">${escapeHtml(displayUrl)} ${linkIcon}</a>`;
            }
        );

        // Step 4: Convert line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    /**
     * Append message to chat window
     */
    function appendMessage(text, sender) {
        if (!testChatWindow) return null;

        const msgDiv = document.createElement('div');
        const id = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        msgDiv.id = id;

        const baseClasses = 'p-3 rounded-lg shadow-sm text-sm max-w-[85%] break-words';

        if (sender === 'loading') {
            msgDiv.className = `italic text-slate-500 text-xs self-start ml-1 animate-pulse`;
            msgDiv.innerHTML = escapeHtml(text);
        } else if (sender === 'user') {
            msgDiv.className = `${baseClasses} bg-blue-600 text-white rounded-br-none self-end`;
            msgDiv.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
        } else if (sender === 'ai') {
            msgDiv.className = `${baseClasses} bg-white border border-gray-200 text-slate-800 rounded-tl-none self-start`;
            msgDiv.innerHTML = formatMessageText(text);
        } else if (sender === 'system') {
            msgDiv.className = `${baseClasses} bg-slate-100 text-slate-600 rounded-lg self-center text-xs`;
            msgDiv.innerHTML = escapeHtml(text);
        } else if (sender === 'error') {
            msgDiv.className = `${baseClasses} bg-red-50 border border-red-200 text-red-700 rounded-lg self-start`;
            msgDiv.innerHTML = escapeHtml(text);
        }

        testChatWindow.appendChild(msgDiv);
        testChatWindow.scrollTop = testChatWindow.scrollHeight;
        return id;
    }

    /**
     * Show typing indicator
     */
    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const indicator = document.createElement('div');
        indicator.id = id;
        indicator.className = 'flex gap-1 p-3 bg-white border border-gray-200 rounded-lg rounded-tl-none self-start w-fit shadow-sm';
        indicator.innerHTML = `
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        `;
        testChatWindow.appendChild(indicator);
        testChatWindow.scrollTop = testChatWindow.scrollHeight;
        return id;
    }

    // === API FUNCTIONS ===

    /**
     * Make authenticated API call with retry logic
     */
    async function apiCall(endpoint, options = {}, attempt = 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        try {
            const response = await fetch(endpoint, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...options.headers
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (attempt < RETRY_ATTEMPTS && error.name !== 'AbortError') {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                return apiCall(endpoint, options, attempt + 1);
            }
            throw error;
        }
    }

    // === EVENT HANDLERS ===

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', debounce(async () => {
            try {
                const response = await apiCall('/auth/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login';
                } else {
                    console.error('Logout failed');
                }
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = '/login';
            }
        }, 300));
    }

    // Ingest Form
    if (ingestForm) {
        ingestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const targetUrl = document.getElementById('targetUrl')?.value.trim();
            
            // Validation
            if (!targetUrl) {
                if (ingestStatus) {
                    ingestStatus.classList.remove('hidden');
                    ingestStatus.className = 'mt-3 text-sm font-mono p-2 rounded bg-red-50 text-red-600';
                    ingestStatus.innerHTML = '❌ Please enter a URL';
                }
                return;
            }

            if (!isValidUrl(targetUrl)) {
                if (ingestStatus) {
                    ingestStatus.classList.remove('hidden');
                    ingestStatus.className = 'mt-3 text-sm font-mono p-2 rounded bg-red-50 text-red-600';
                    ingestStatus.innerHTML = '❌ Invalid URL. Must be http/https and not localhost.';
                }
                return;
            }

            // UI State
            ingestBtn.disabled = true;
            ingestBtn.innerText = 'Processing...';
            ingestBtn.classList.add('opacity-70', 'cursor-not-allowed');
            
            if (ingestStatus) {
                ingestStatus.classList.remove('hidden', 'text-red-600', 'text-green-600');
                ingestStatus.className = 'mt-3 text-sm font-mono p-2 rounded bg-blue-50 text-blue-600';
                ingestStatus.innerHTML = '🔍 Validating URL...';
            }

            try {
                if (ingestStatus) {
                    ingestStatus.innerHTML = '🚀 Sending to AI Engine...';
                }

                const response = await apiCall('/engine/ingest', {
                    method: 'POST',
                    body: JSON.stringify({ targetUrl })
                });

                const data = await response.json();

                if (response.ok) {
                    if (ingestStatus) {
                        ingestStatus.className = 'mt-3 text-sm font-mono p-2 rounded bg-green-50 text-green-600';
                        ingestStatus.innerHTML = `✅ Success! ${data.chunks_saved_to_db || data.chunks || 'Data'} chunks vectorized and saved.`;
                    }
                    
                    // Reset form
                    document.getElementById('targetUrl').value = '';
                    
                    // Reload after delay
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    throw new Error(data.error || 'Ingestion failed');
                }
            } catch (error) {
                console.error('Ingestion error:', error);
                
                if (ingestStatus) {
                    ingestStatus.className = 'mt-3 text-sm font-mono p-2 rounded bg-red-50 text-red-600';
                    ingestStatus.innerHTML = `❌ Error: ${escapeHtml(error.message || 'Network connection failed')}`;
                }
            } finally {
                ingestBtn.disabled = false;
                ingestBtn.innerText = 'Ingest Data';
                ingestBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        });
    }

    // Test Chat
    if (testChatBtn && testChatInput && testChatWindow && hiddenUserId) {
        const userId = hiddenUserId.value;

        // Validate userId
        if (!userId || !/^\d+$/.test(userId)) {
            console.error('Invalid userId');
            appendMessage('Configuration error. Please refresh the page.', 'error');
            return;
        }

        const sendTestMessage = debounce(async (overrideText = null) => {
            const text = overrideText || testChatInput.value.trim();
            
            if (!text) return;
            
            // Length validation
            if (text.length > MAX_MESSAGE_LENGTH) {
                appendMessage(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`, 'error');
                return;
            }

            // Clear input
            if (!overrideText) {
                testChatInput.value = '';
            }

            // Add user message
            appendMessage(text, 'user');
            
            // Update state
            currentConversationState.turnCount++;
            updateAIState(currentConversationState.emotion, currentConversationState.phase, true);
            
            // Show typing indicator
            const typingId = showTypingIndicator();

            // Trim history if needed
            if (testChatHistory.length > MAX_HISTORY_LENGTH) {
                testChatHistory = testChatHistory.slice(-MAX_HISTORY_LENGTH);
            }

            try {
                const response = await apiCall('/engine/chat', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: userId,
                        question: text,
                        history: testChatHistory
                    })
                });

                // Remove typing indicator
                const indicator = document.getElementById(typingId);
                if (indicator) indicator.remove();

                const data = await response.json();

                if (response.ok) {
                    // Validate response structure
                    if (!data.answer) {
                        throw new Error('Invalid response from AI engine');
                    }

                    // Display AI response
                    appendMessage(data.answer, 'ai');

                    // Update conversation state
                    currentConversationState = {
                        phase: data.phase || 'UNKNOWN',
                        emotion: data.emotion_detected || 'neutral',
                        confidence: data.confidence || 0,
                        rapportScore: data.rapport_score || 0,
                        turnCount: currentConversationState.turnCount
                    };

                    // Update UI
                    updateAIState(data.emotion_detected, data.phase, false);
                    updateDebugPanel(data);

                    // Add to history
                    testChatHistory.push({ role: 'user', content: text });
                    testChatHistory.push({ role: 'assistant', content: data.answer });

                    // Show system message for low confidence
                    if (data.confidence < 0.5 && data.sources_used === 0) {
                        setTimeout(() => {
                            appendMessage('Note: Low confidence answer. Consider rephrasing or checking your knowledge base.', 'system');
                        }, 500);
                    }

                    // Auto-escalation warning
                    if (data.phase === 'ESCALATION') {
                        setTimeout(() => {
                            appendMessage('⚠️ This conversation may need human support. Consider escalating via the dashboard.', 'system');
                        }, 1000);
                    }

                } else {
                    throw new Error(data.error || 'Chat request failed');
                }

            } catch (error) {
                // Remove typing indicator
                const indicator = document.getElementById(typingId);
                if (indicator) indicator.remove();

                console.error('Chat error:', error);
                
                let errorMessage = 'Network error. ';
                if (error.name === 'AbortError') {
                    errorMessage += 'Request timed out. The AI engine may be busy.';
                } else if (error.message.includes('Failed to fetch')) {
                    errorMessage += 'Cannot connect to AI engine. Ensure it\'s running on port 8000.';
                } else {
                    errorMessage += escapeHtml(error.message);
                }
                
                appendMessage(errorMessage, 'error');
                updateAIState('unknown', 'ERROR', false);
            }
        }, 300);

        // Event listeners
        testChatBtn.addEventListener('click', () => sendTestMessage());
        
        testChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendTestMessage();
            }
        });

        // Prevent multiple rapid submissions
        testChatInput.addEventListener('input', () => {
            const remaining = MAX_MESSAGE_LENGTH - testChatInput.value.length;
            if (remaining < 50) {
                testChatInput.classList.add('border-yellow-500');
            } else {
                testChatInput.classList.remove('border-yellow-500');
            }
        });
    }

    // === GLOBAL FUNCTIONS (for onclick handlers) ===

    /**
     * Insert test scenario into chat input
     */
    window.insertTest = (scenarioType) => {
        const scenario = testScenarios[scenarioType];
        if (!scenario) {
            console.error('Unknown scenario:', scenarioType);
            return;
        }

        if (testChatInput) {
            testChatInput.value = scenario.text;
            testChatInput.focus();
            
            // Visual feedback
            testChatInput.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => testChatInput.classList.remove('ring-2', 'ring-blue-500'), 500);
        }

        // Auto-send after short delay for demo purposes
        setTimeout(() => {
            if (testChatBtn) {
                testChatBtn.click();
            }
        }, 100);
    };

    /**
     * Toggle debug panel visibility
     */
    window.toggleDebug = () => {
        if (debugPanel) {
            debugPanel.classList.toggle('hidden');
            // Save preference
            const isVisible = !debugPanel.classList.contains('hidden');
            localStorage.setItem('axiora_debug_visible', isVisible);
        }
    };

    /**
     * Delete knowledge base with confirmation
     */
    window.deleteKb = async (kbId) => {
        if (!kbId || !/^\d+$/.test(kbId)) {
            alert('Invalid knowledge base ID');
            return;
        }

        if (!confirm('Are you sure you want to delete this knowledge base?\n\nThe AI will no longer have access to this data. This action cannot be undone.')) {
            return;
        }

        try {
            const response = await apiCall(`/engine/knowledge-base/${kbId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Animate removal
                const row = document.querySelector(`button[onclick="deleteKb('${kbId}')"]`)?.closest('tr');
                if (row) {
                    row.style.transition = 'all 0.3s';
                    row.style.opacity = '0';
                    row.style.transform = 'translateX(-20px)';
                    setTimeout(() => window.location.reload(), 300);
                } else {
                    window.location.reload();
                }
            } else {
                const data = await response.json();
                alert(`Error: ${escapeHtml(data.error || 'Failed to delete')}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Network error while trying to delete. Please try again.');
        }
    };

    /**
     * Resync URL - populate form and trigger ingest
     */
    window.resyncUrl = (encodedUrl) => {
        if (!encodedUrl) return;

        let url;
        try {
            url = decodeURIComponent(encodedUrl);
        } catch (e) {
            console.error('Invalid URL encoding:', e);
            return;
        }

        // Validate decoded URL
        if (!isValidUrl(url)) {
            alert('Invalid URL format');
            return;
        }

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Populate input
        const urlInput = document.getElementById('targetUrl');
        if (urlInput) {
            urlInput.value = url;
            urlInput.classList.add('ring-2', 'ring-green-500');
            urlInput.focus();
            
            setTimeout(() => {
                urlInput.classList.remove('ring-2', 'ring-green-500');
                // Auto-submit after user sees the populated field
                if (confirm(`Resync "${truncateText(url, 50)}"?`)) {
                    document.getElementById('ingestForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }, 800);
        }
    };

    /**
     * Copy widget code to clipboard
     */
    window.copyWidgetCode = () => {
        const textarea = document.getElementById('widgetCode');
        if (!textarea) return;

        textarea.select();
        textarea.setSelectionRange(0, 99999); // For mobile

        try {
            navigator.clipboard.writeText(textarea.value).then(() => {
                // Visual feedback
                const btn = document.querySelector('button[onclick="copyWidgetCode()"]');
                if (btn) {
                    const originalText = btn.innerText;
                    btn.innerText = 'Copied!';
                    btn.classList.add('bg-green-600');
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.classList.remove('bg-green-600');
                    }, 2000);
                }
            });
        } catch (err) {
            // Fallback
            document.execCommand('copy');
        }
    };

    /**
     * Regenerate widget token
     */
    window.regenerateToken = async () => {
        try {
            const response = await apiCall('/dashboard/regenerate-token', { method: 'POST' });
            const data = await response.json();
            
            if (response.ok && data.token) {
                const textarea = document.getElementById('widgetCode');
                if (textarea) {
                    // Update token in the code snippet
                    const currentCode = textarea.value;
                    const newCode = currentCode.replace(/data-token="[^"]*"/, `data-token="${escapeHtml(data.token)}"`);
                    textarea.value = newCode;
                    
                    // Visual feedback
                    appendMessage('Widget token regenerated successfully!', 'system');
                }
            } else {
                throw new Error(data.error || 'Failed to regenerate token');
            }
        } catch (error) {
            console.error('Token regeneration error:', error);
            alert('Failed to regenerate token. Please refresh the page.');
        }
    };

    // === INITIALIZATION ===

    // Restore debug panel preference
    if (debugPanel && localStorage.getItem('axiora_debug_visible') === 'true') {
        debugPanel.classList.remove('hidden');
    }

    // Welcome message for test chat
    if (testChatWindow && testChatWindow.children.length === 0) {
        appendMessage('System Online. The Knowledge Base is ready. Try test scenarios or ask a question!', 'system');
    }

    console.log('🚀 Axiora Dashboard Logic initialized');
    console.log('Available test scenarios:', Object.keys(testScenarios).join(', '));
});