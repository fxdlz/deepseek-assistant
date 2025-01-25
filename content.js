// 配置 marked
function configureMarked() {
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: true,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: true,
      langPrefix: 'language-'
    });
    return true;
  }
  return false;
}

// 渲染 markdown
async function renderMarkdown(content) {
  try {
    if (!configureMarked()) {
      console.error('Marked is not available');
      return content;
    }

    // 确保内容是字符串
    const markdownContent = String(content);
    console.log('Rendering markdown:', markdownContent);

    // 渲染 markdown
    const rendered = marked.parse(markdownContent);
    console.log('Rendered HTML:', rendered);

    return rendered;
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return content;
  }
}

// 修改 appendMessage 函数
async function appendMessage(chatMessages, role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const roleLabel = document.createElement('div');
  roleLabel.className = 'message-role';
  roleLabel.textContent = role === 'user' ? '你' : 'AI';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content markdown-body';
  
  try {
    if (role === 'assistant') {
      const renderedContent = await renderMarkdown(content);
      contentDiv.innerHTML = renderedContent;
      
      // 应用样式
      contentDiv.querySelectorAll('pre code').forEach(block => {
        block.style.display = 'block';
        block.style.padding = '16px';
        block.style.overflow = 'auto';
        block.style.backgroundColor = '#f6f8fa';
        block.style.borderRadius = '6px';
        block.style.fontFamily = 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace';
        block.style.fontSize = '85%';
        block.style.lineHeight = '1.45';
        block.style.margin = '0';
      });
    } else {
      contentDiv.textContent = content;
    }
  } catch (error) {
    console.error('Error rendering message:', error);
    contentDiv.textContent = content;
  }
  
  messageDiv.appendChild(roleLabel);
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 修改 updateAssistantMessage 函数
async function updateAssistantMessage(chatMessages, content) {
  let messageDiv = chatMessages.querySelector('.message.assistant:last-child');
  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    const roleLabel = document.createElement('div');
    roleLabel.className = 'message-role';
    roleLabel.textContent = 'AI';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content markdown-body';
    
    messageDiv.appendChild(roleLabel);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
  }
  
  const contentDiv = messageDiv.querySelector('.message-content');
  try {
    contentDiv.innerHTML = await renderMarkdown(content);
  } catch (error) {
    console.error('Error updating message:', error);
    contentDiv.textContent = content;
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 用于在页面中注入功能的内容脚本
console.log('DeepSeek Assistant content script loaded');

let questionButton = null; // 保存按钮引用
let selectedTextContent = ''; // 保存选中的文本
let isExtensionReady = true; // 扩展状态标志

// 修改检查扩展连接状态函数
function checkExtensionConnection() {
  try {
    if (!chrome?.runtime?.id) {
      console.log('Extension context invalid');
      isExtensionReady = false;
      return false;
    }
    isExtensionReady = true;
    return true;
  } catch (e) {
    console.error('Extension connection check failed:', e);
    isExtensionReady = false;
    return false;
  }
}

// 重新初始化扩展
async function reinitializeExtension() {
  try {
    // 移除旧的按钮
    if (questionButton) {
      questionButton.remove();
      questionButton = null;
    }
    
    // 清除选中的文本
    selectedTextContent = '';
    
    // 等待一段时间后重新检查
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 重新检查连接
    if (checkExtensionConnection()) {
      console.log('Extension reconnected');
      return true;
    }
    
    // 如果重新连接失败，重新加载页面
    window.location.reload();
    return false;
  } catch (error) {
    console.error('Error in reinitializeExtension:', error);
    window.location.reload();
    return false;
  }
}

// 修改创建问题按钮函数
function createQuestionButton() {
  try {
    if (questionButton) {
      return questionButton;
    }

    const button = document.createElement('div');
    button.id = 'deepseek-question-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
        <path d="M12 17V11M12 7H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    
    button.style.cssText = `
      position: fixed;
      display: none;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #1a73e8;
      color: white;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      z-index: 2147483647;
      transition: all 0.2s ease;
      pointer-events: auto;
      opacity: 1;
    `;
    
    button.onclick = handleButtonClick;
    
    button.onmouseover = () => {
      button.style.transform = 'scale(1.1)';
    };
    
    button.onmouseout = () => {
      button.style.transform = 'scale(1)';
    };
    
    document.body.appendChild(button);
    questionButton = button;
    return button;
  } catch (error) {
    console.error('Error creating question button:', error);
    return null;
  }
}

// 创建设置面板
function createSettingsPanel() {
  const settingsDiv = document.createElement('div');
  settingsDiv.className = 'settings-panel';
  settingsDiv.innerHTML = `
    <div class="settings-content">
      <input type="text" id="api-key-input" placeholder="请输入 DeepSeek API Key" />
      <button id="save-api-key">保存</button>
    </div>
  `;
  return settingsDiv;
}

// 创建并显示对话框
async function showChatDialog(selectedText) {
  // 移除已存在的对话框
  const existingDialog = document.getElementById('deepseek-chat-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  // 创建对话框容器
  const dialog = document.createElement('div');
  dialog.id = 'deepseek-chat-dialog';
  dialog.className = 'deepseek-popup';
  dialog.innerHTML = `
    <div class="chat-container">
      <div id="chat-messages" class="chat-messages"></div>
      <div class="chat-input-container">
        <textarea id="user-input" placeholder="有什么问题尽管问我" rows="1"></textarea>
      </div>
    </div>
  `;

  // 添加到页面
  document.body.appendChild(dialog);

  // 获取消息容器和输入框
  const chatMessages = dialog.querySelector('#chat-messages');
  const userInput = dialog.querySelector('#user-input');

  // 监听消息响应
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.chatHistory) {
      const newHistory = changes.chatHistory.newValue;
      const lastMessage = newHistory[newHistory.length - 1];
      
      if (lastMessage && lastMessage.role === 'assistant') {
        updateAssistantMessage(chatMessages, lastMessage.content);
      }
    }
  });

  // 添加用户消息到对话框
  async function sendMessage(message) {
    try {
      // 先获取 API Key
      const { deepseekApiKey } = await chrome.storage.local.get(['deepseekApiKey']);
      if (!deepseekApiKey) {
        await appendMessage(chatMessages, 'system', '请先设置 DeepSeek API Key');
        return;
      }

      chrome.runtime.sendMessage({
        type: 'START_CHAT',
        message: message,
        apiKey: deepseekApiKey
      });
    } catch (error) {
      console.error('Error sending message:', error);
      await appendMessage(chatMessages, 'system', '发送消息失败：' + error.message);
    }
  }

  if (selectedText) {
    await appendMessage(chatMessages, 'user', selectedText);
    await sendMessage(selectedText);
  }

  // 添加拖动功能
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  dialog.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    if (e.target.tagName === 'TEXTAREA') return;
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === dialog) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, dialog);
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }

  // 添加关闭功能
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dialog.remove();
    }
  });

  // 点击外部关闭
  document.addEventListener('mousedown', (e) => {
    if (!dialog.contains(e.target) && e.target !== questionButton) {
      dialog.remove();
    }
  });

  // 修改输入框发送部分
  userInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = userInput.value.trim();
      if (message) {
        await appendMessage(chatMessages, 'user', message);
        await sendMessage(message);
        userInput.value = '';
      }
    }
  });

  // 添加设置按钮
  const settingsButton = document.createElement('button');
  settingsButton.className = 'settings-button';
  settingsButton.innerHTML = '⚙️';
  settingsButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 5px;
    font-size: 16px;
    z-index: 2147483648;
  `;

  dialog.appendChild(settingsButton);

  // 处理设置按钮点击
  let settingsPanel = null;
  settingsButton.onclick = async () => {
    if (settingsPanel) {
      settingsPanel.remove();
      settingsPanel = null;
      return;
    }

    settingsPanel = createSettingsPanel();
    dialog.appendChild(settingsPanel);

    // 获取并显示当前的 API Key
    const { deepseekApiKey } = await chrome.storage.local.get(['deepseekApiKey']);
    const apiKeyInput = settingsPanel.querySelector('#api-key-input');
    apiKeyInput.value = deepseekApiKey || '';

    // 保存 API Key
    settingsPanel.querySelector('#save-api-key').onclick = async () => {
      const newApiKey = apiKeyInput.value.trim();
      if (newApiKey) {
        await chrome.storage.local.set({ deepseekApiKey: newApiKey });
        await appendMessage(chatMessages, 'system', 'API Key 已保存');
        settingsPanel.remove();
        settingsPanel = null;
      }
    };
  };
}

// 修改 handleButtonClick 函数
async function handleButtonClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!selectedTextContent) {
    console.log('No text selected');
    return;
  }

  try {
    // 显示对话框而不是打开新窗口
    await showChatDialog(selectedTextContent);
    hideQuestionButton();
  } catch (error) {
    console.error('Error in handleButtonClick:', error);
  }
}

// 修改显示问题按钮函数
function showQuestionButton(x, y, text) {
  try {
    if (!checkExtensionConnection()) {
      console.log('Extension not ready, attempting to reconnect...');
      reinitializeExtension();
      return;
    }

    selectedTextContent = text;
    let button = questionButton || createQuestionButton();
    
    if (!button) {
      console.log('Failed to create or get question button');
      return;
    }
    
    const buttonWidth = 32;
    const buttonHeight = 32;
    const spacing = 10;
    
    let posX = x;
    let posY = Math.max(y - buttonHeight - spacing, 0);
    
    button.style.left = `${posX}px`;
    button.style.top = `${posY}px`;
    button.style.display = 'flex';
  } catch (error) {
    console.error('Error showing question button:', error);
  }
}

// 隐藏问题按钮
function hideQuestionButton() {
  if (questionButton) {
    questionButton.style.display = 'none';
    selectedTextContent = '';
  }
}

// 修改文本选择监听器
document.addEventListener('mouseup', function(e) {
  setTimeout(async () => {
    try {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        if (!isExtensionReady) {
          await reinitializeExtension();
        }
        if (isExtensionReady) {
          showQuestionButton(e.clientX, e.clientY, selectedText);
        }
      } else {
        hideQuestionButton();
      }
    } catch (error) {
      console.error('Error handling text selection:', error);
    }
  }, 10);
}, true);

// 点击页面其他地方时隐藏按钮
document.addEventListener('mousedown', function(e) {
  try {
    if (questionButton && e.target !== questionButton && !questionButton.contains(e.target)) {
      hideQuestionButton();
    }
  } catch (error) {
    console.error('Error handling mousedown:', error);
  }
}, true);

// 初始化扩展
async function initializeExtension() {
  try {
    console.log('Initializing extension...');
    isExtensionReady = await checkExtensionConnection();
    if (!isExtensionReady) {
      console.log('Extension not ready, will retry...');
    } else {
      console.log('Extension initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing extension:', error);
    isExtensionReady = false;
  }
}

// 立即初始化扩展
initializeExtension();

// 定期检查扩展状态
setInterval(async () => {
  if (!isExtensionReady) {
    await initializeExtension();
  }
}, 1000);

// 添加错误处理的监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (chrome.runtime.lastError) {
    console.error('Runtime error:', chrome.runtime.lastError);
    if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
      isExtensionReady = false;
      reinitializeExtension();
    }
  }
}); 