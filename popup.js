document.addEventListener('DOMContentLoaded', async function() {
  try {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    
    let chatHistory = [];

    // 处理选中的文本并自动发送
    async function handleSelectedText() {
      try {
        const result = await chrome.storage.local.get(['selectedText', 'autoSend']);
        console.log('Retrieved selected text:', result.selectedText);
        
        if (result.selectedText) {
          userInput.value = result.selectedText;
          await chrome.storage.local.remove(['selectedText', 'autoSend']);
          
          if (result.autoSend) {
            console.log('Auto sending message...');
            setTimeout(async () => {
              const { deepseekApiKey } = await chrome.storage.local.get(['deepseekApiKey']);
              if (!deepseekApiKey) {
                appendMessage('system', '请先设置 DeepSeek API Key');
                return;
              }
              await sendMessage();
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error handling selected text:', error);
      }
    }

    // 发送消息函数
    async function sendMessage() {
      const message = userInput.value.trim();
      if (!message) return;

      userInput.disabled = true;

      try {
        appendMessage('user', message);
        userInput.value = '';

        const { deepseekApiKey } = await chrome.storage.local.get(['deepseekApiKey']);
        if (!deepseekApiKey) {
          appendMessage('system', '请先设置 DeepSeek API Key');
          return;
        }

        // 发送消息并等待初始响应
        chrome.runtime.sendMessage({
          type: 'START_CHAT',
          message: message,
          apiKey: deepseekApiKey
        });

        // 监听响应
        const storageListener = (changes) => {
          if (changes.chatHistory) {
            const newHistory = changes.chatHistory.newValue;
            const lastMessage = newHistory[newHistory.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              updateAssistantMessage(lastMessage.content);
              
              if (lastMessage.completed) {
                chrome.storage.onChanged.removeListener(storageListener);
              }
            }
          }
          
          if (changes.chatError) {
            const errorMessage = changes.chatError.newValue;
            console.error('Chat error:', errorMessage);
            appendMessage('system', '发生错误：' + errorMessage);
            chrome.storage.onChanged.removeListener(storageListener);
          }
        };

        chrome.storage.onChanged.addListener(storageListener);

      } catch (error) {
        console.error('Error in sendMessage:', error.message || error);
        appendMessage('system', '发生错误：' + (error.message || '未知错误'));
      } finally {
        userInput.disabled = false;
      }
    }

    function appendMessage(role, content) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${role}`;
      
      const roleLabel = document.createElement('div');
      roleLabel.className = 'message-role';
      roleLabel.textContent = role === 'user' ? '你' : 'AI';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = marked.parse(content);
      
      messageDiv.appendChild(roleLabel);
      messageDiv.appendChild(contentDiv);
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function updateAssistantMessage(content) {
      let messageDiv = chatMessages.querySelector('.message.assistant:last-child');
      if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const roleLabel = document.createElement('div');
        roleLabel.className = 'message-role';
        roleLabel.textContent = 'AI';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        messageDiv.appendChild(roleLabel);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
      }
      
      const contentDiv = messageDiv.querySelector('.message-content');
      contentDiv.innerHTML = marked.parse(content);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 事件监听
    userInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage().catch(console.error);
      }
    });

    // 添加自动调整输入框高度的功能
    userInput.addEventListener('input', function() {
      // 重置高度
      this.style.height = 'auto';
      // 设置新高度
      const newHeight = Math.min(this.scrollHeight, 120); // 最大高度120px
      this.style.height = newHeight + 'px';
    });

    // 添加跳转到 DeepSeek 的功能
    document.getElementById('open-deepseek')?.addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://chat.deepseek.com/'
      });
      window.close(); // 关闭弹出窗口
    });

    // 初始化
    await handleSelectedText();

  } catch (error) {
    console.error('Initialization error:', error);
    document.getElementById('chat-messages').innerHTML = 
      '<div class="message system"><div class="message-role">系统</div>' +
      '<div class="message-content">初始化失败：' + error.message + '</div></div>';
  }
}); 