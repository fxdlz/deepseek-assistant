// 存储活跃的请求
let activeRequests = new Map();

// 监听浏览器关闭事件
chrome.runtime.onStartup.addListener(() => {
  // 浏览器启动时清空历史记录
  clearChatHistory();
});

// 清空聊天历史记录
async function clearChatHistory() {
  try {
    await chrome.storage.local.remove(['chatHistory']);
    console.log('Chat history cleared');
  } catch (error) {
    console.error('Error clearing chat history:', error);
  }
}

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);

  if (request.type === 'START_CHAT') {
    // 立即发送一个初始响应
    sendResponse({ status: 'processing' });
    
    handleChatRequest(request.message, request.apiKey)
      .then(() => {
        console.log('Chat request completed');
      })
      .catch(error => {
        console.error('Chat request failed:', error);
        chrome.storage.local.set({
          chatError: error.message
        });
      });
      
    return false;
  }

  if (request.type === 'OPEN_POPUP_WITH_SELECTION') {
    console.log('Received OPEN_POPUP_WITH_SELECTION message with text:', request.text);
    
    // 存储选中的文本
    chrome.storage.local.set({ 
      'selectedText': request.text,
      'autoSend': true
    }, () => {
      console.log('Selected text saved to storage');
      
      // 获取当前窗口信息来计算弹出窗口的位置
      chrome.windows.getCurrent({}, (currentWindow) => {
        const width = 400;
        const height = 500;
        const left = Math.round(currentWindow.left + (currentWindow.width - width) / 2);
        const top = Math.round(currentWindow.top + (currentWindow.height - height) / 2);

        // 创建新窗口
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html'),
          type: 'popup',
          width: width,
          height: height,
          left: left,
          top: top,
          focused: true,
          state: 'normal'
        }, (createdWindow) => {
          if (chrome.runtime.lastError) {
            console.error('Error opening popup:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('Popup window created successfully:', createdWindow);
            
            // 设置窗口样式
            chrome.windows.update(createdWindow.id, {
              focused: true,
              drawAttention: true
            });
            
            sendResponse({ success: true });
          }
        });
      });
    });
    
    return true;
  }
  
  return false;
});

// 添加安装事件监听器
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
});

// 处理聊天请求
async function handleChatRequest(message, apiKey) {
  try {
    console.log('Starting chat request with message:', message);

    // 先保存用户消息到历史记录
    await savePartialResponse('', 'user', message);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: message
        }],
        model: 'deepseek-chat',
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') {
            // 保存完整的回答
            await saveCompletedResponse(currentMessage);
            return;
          }

          try {
            const data = JSON.parse(jsonStr);
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const content = data.choices[0].delta.content || '';
              currentMessage += content;
              // 保存部分回答
              await savePartialResponse(currentMessage);
            }
          } catch (e) {
            console.warn('JSON解析错误:', e);
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in handleChatRequest:', error);
    throw error;
  }
}

// 保存部分回答
async function savePartialResponse(content, role = 'assistant', message = null) {
  try {
    const { chatHistory = [] } = await chrome.storage.local.get(['chatHistory']);
    
    if (role === 'user') {
      // 添加用户消息
      chatHistory.push({
        role: 'user',
        content: message
      });
    } else {
      // 更新或添加助手回答
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = content;
      } else {
        chatHistory.push({
          role: 'assistant',
          content: content
        });
      }
    }
    
    await chrome.storage.local.set({ chatHistory });
  } catch (error) {
    console.error('Error saving partial response:', error);
  }
}

// 保存完整回答
async function saveCompletedResponse(content) {
  try {
    const { chatHistory = [] } = await chrome.storage.local.get(['chatHistory']);
    const lastMessage = chatHistory[chatHistory.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.content = content;
      lastMessage.completed = true;
      await chrome.storage.local.set({ chatHistory });
    }
  } catch (error) {
    console.error('Error saving completed response:', error);
  }
}

// 处理后台任务
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TEXT_SELECTED') {
    // 可以在这里处理选中的文本
    console.log('Selected text:', message.text);
  }
}); 