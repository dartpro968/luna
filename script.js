/* ============================================
   Luna AI Girlfriend - Chatbot Brain
   Powered by Dual-LLM Pipeline (Groq API)
   LLM 1: Llama 3.1 8B (Emotion Analyzer)
   LLM 2: Llama 3.3 70B (Girlfriend Persona)
   ============================================ */

// ==========================================
// Configuration
// ==========================================
const API_BASE = "http://localhost:5000/api";

// Emotion colors for the mood badge
const EMOTION_COLORS = {
    happy: { bg: "rgba(52, 211, 153, 0.2)", color: "#34d399", emoji: "😊" },
    sad: { bg: "rgba(96, 165, 250, 0.2)", color: "#60a5fa", emoji: "😢" },
    lonely: { bg: "rgba(148, 163, 184, 0.2)", color: "#94a3b8", emoji: "🥺" },
    romantic: { bg: "rgba(244, 114, 182, 0.2)", color: "#f472b6", emoji: "💕" },
    flirty: { bg: "rgba(251, 146, 60, 0.2)", color: "#fb923c", emoji: "😏" },
    excited: { bg: "rgba(250, 204, 21, 0.2)", color: "#facc15", emoji: "🤩" },
    stressed: { bg: "rgba(248, 113, 113, 0.2)", color: "#f87171", emoji: "😰" },
    angry: { bg: "rgba(239, 68, 68, 0.2)", color: "#ef4444", emoji: "😤" },
    anxious: { bg: "rgba(192, 132, 252, 0.2)", color: "#c084fc", emoji: "😟" },
    bored: { bg: "rgba(163, 163, 163, 0.2)", color: "#a3a3a3", emoji: "😴" },
    grateful: { bg: "rgba(74, 222, 128, 0.2)", color: "#4ade80", emoji: "🙏" },
    confused: { bg: "rgba(251, 191, 36, 0.2)", color: "#fbbf24", emoji: "🤔" },
    playful: { bg: "rgba(168, 85, 247, 0.2)", color: "#a855f7", emoji: "😜" },
    nostalgic: { bg: "rgba(147, 130, 220, 0.2)", color: "#9382dc", emoji: "🥲" },
    affectionate: { bg: "rgba(232, 121, 168, 0.2)", color: "#e879a8", emoji: "🥰" },
    neutral: { bg: "rgba(168, 85, 247, 0.15)", color: "#a78bfa", emoji: "💜" },
};

// Fallback responses when API is unavailable
const FALLBACK_RESPONSES = [
    "Hmm, my brain's being a little slow right now 😅 Can you try again in a sec, baby? 💜",
    "Oops! I got a little disconnected 🥺 Let me try again... send that again? 💕",
    "My thoughts got tangled up for a moment! 😂 One more time, love? 💜",
];

// ==========================================
// DOM Elements
// ==========================================
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const clearBtn = document.getElementById("clearBtn");
const welcomeMsg = document.getElementById("welcomeMsg");
const heartsBg = document.getElementById("heartsBg");

// ==========================================
// State
// ==========================================
let messageCount = 0;
let isProcessing = false;

// ==========================================
// Utility Functions
// ==========================================

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getTimeString() {
    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function scrollToBottom() {
    setTimeout(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    }, 100);
}

// ==========================================
// Floating Hearts Background
// ==========================================
function createHeart() {
    const heart = document.createElement("span");
    heart.classList.add("floating-heart");
    heart.textContent = getRandomItem([
        "💜", "💕", "💗", "🩷", "🤍", "✨", "🌸", "🦋",
    ]);
    heart.style.left = Math.random() * 100 + "vw";
    heart.style.animationDuration = 8 + Math.random() * 12 + "s";
    heart.style.fontSize = 0.8 + Math.random() * 1.2 + "rem";
    heartsBg.appendChild(heart);
    setTimeout(() => heart.remove(), 20000);
}

setInterval(createHeart, 2500);
for (let i = 0; i < 5; i++) {
    setTimeout(createHeart, i * 500);
}

// ==========================================
// Emoji Burst Effect
// ==========================================
function emojiBurst(emoji) {
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const el = document.createElement("span");
            el.classList.add("emoji-burst");
            el.textContent = emoji;
            el.style.left = 25 + Math.random() * 50 + "%";
            el.style.top = 30 + Math.random() * 30 + "%";
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }, i * 150);
    }
}

// ==========================================
// Message Rendering
// ==========================================
function addMessage(text, sender, emotion = null) {
    if (welcomeMsg) {
        welcomeMsg.style.display = "none";
    }

    const row = document.createElement("div");
    row.classList.add("message-row", sender);

    const avatarEmoji = sender === "bot" ? "💜" : "🧑";

    // Build emotion badge HTML
    let emotionBadge = "";
    if (emotion && sender === "bot") {
        const emotionStyle = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
        emotionBadge = `<span class="emotion-badge" style="background:${emotionStyle.bg}; color:${emotionStyle.color};">
            ${emotionStyle.emoji} ${emotion}
        </span>`;
    }

    row.innerHTML = `
        ${sender === "bot" ? `<div class="msg-avatar">${avatarEmoji}</div>` : ""}
        <div class="msg-content">
            <div class="msg-bubble">${text}</div>
            <div class="msg-meta">
                <span class="msg-time">${getTimeString()}</span>
                ${emotionBadge}
            </div>
        </div>
        ${sender === "user" ? `<div class="msg-avatar" style="background:linear-gradient(135deg, #3b82f6, #60a5fa);">${avatarEmoji}</div>` : ""}
    `;

    chatArea.appendChild(row);
    messageCount++;
    scrollToBottom();

    // Emoji burst on romantic/love responses
    if (sender === "bot" && (emotion === "romantic" || emotion === "affectionate")) {
        setTimeout(() => emojiBurst("💕"), 300);
    }
}

function addQuickReplies(replies) {
    const qr = document.createElement("div");
    qr.classList.add("quick-replies");
    replies.forEach((text) => {
        const btn = document.createElement("button");
        btn.classList.add("quick-reply-btn");
        btn.textContent = text;
        btn.addEventListener("click", () => {
            qr.remove();
            handleUserMessage(text);
        });
        qr.appendChild(btn);
    });
    chatArea.appendChild(qr);
    scrollToBottom();
}

// ==========================================
// API Communication
// ==========================================
async function sendToAPI(message) {
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
            reply: data.reply,
            emotion: data.emotion || "neutral",
            intensity: data.intensity || "medium",
        };
    } catch (error) {
        console.error("API Error:", error);
        return null;
    }
}

async function clearAPIHistory() {
    try {
        await fetch(`${API_BASE}/clear`, { method: "POST" });
    } catch (error) {
        console.error("Clear API Error:", error);
    }
}

// ==========================================
// Handle User Message
// ==========================================
async function handleUserMessage(text) {
    if (!text.trim() || isProcessing) return;

    isProcessing = true;
    sendBtn.style.opacity = "0.5";

    // Add user message
    addMessage(text, "user");

    // Show typing indicator
    typingIndicator.classList.add("show");
    scrollToBottom();

    // Send to API
    const result = await sendToAPI(text);

    // Hide typing indicator
    typingIndicator.classList.remove("show");

    if (result) {
        // Successful API response
        addMessage(result.reply, "bot", result.emotion);
    } else {
        // API unavailable - use fallback
        addMessage(getRandomItem(FALLBACK_RESPONSES), "bot", "neutral");
    }

    isProcessing = false;
    sendBtn.style.opacity = "1";
}

// ==========================================
// Event Listeners
// ==========================================

// Send button
sendBtn.addEventListener("click", () => {
    const text = userInput.value.trim();
    if (text && !isProcessing) {
        handleUserMessage(text);
        userInput.value = "";
        userInput.style.height = "auto";
        userInput.focus();
    }
});

// Enter key
userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// Auto-resize textarea
userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 100) + "px";
});

// Clear chat
clearBtn.addEventListener("click", async () => {
    if (confirm("Clear all messages? 🥺")) {
        chatArea.innerHTML = "";
        messageCount = 0;

        // Clear backend history too
        await clearAPIHistory();

        // Re-add welcome message
        const welcomeDiv = document.createElement("div");
        welcomeDiv.classList.add("welcome-msg");
        welcomeDiv.id = "welcomeMsg";
        welcomeDiv.innerHTML = `
            <div class="welcome-avatar">💜</div>
            <h2>Hey there, cutie! 💕</h2>
            <p>I'm <strong>Luna</strong>, your AI girlfriend. I'm here to chat, laugh, and keep you company. Powered by real AI — I understand your emotions! 🧠💜</p>
        `;
        chatArea.appendChild(welcomeDiv);
    }
});

// Mood popup buttons
document.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const mood = btn.dataset.mood;
        document.getElementById("moodPopup").classList.remove("show");
        handleUserMessage(`I'm feeling ${mood}`);
    });
});

// ==========================================
// Initialization
// ==========================================
window.addEventListener("load", async () => {
    userInput.focus();

    // Check if backend is running
    try {
        const healthCheck = await fetch(`${API_BASE}/health`);
        const health = await healthCheck.json();
        console.log("🟢 Backend connected:", health);

        // Send initial greeting through the API
        setTimeout(async () => {
            typingIndicator.classList.add("show");
            scrollToBottom();

            const greeting = await sendToAPI("hey there! i just arrived");

            typingIndicator.classList.remove("show");

            if (greeting) {
                addMessage(greeting.reply, "bot", greeting.emotion);
            } else {
                addMessage(
                    "Hey there, love! 💜 I'm so happy you're here! How's your day going? 🥰",
                    "bot",
                    "affectionate"
                );
            }
            addQuickReplies(["I'm great! 😊", "I miss you! 🥺", "Tell me a joke 😂"]);
        }, 800);
    } catch (e) {
        console.warn("⚠️ Backend not running. Starting with fallback mode.");

        // Show warning banner
        const banner = document.createElement("div");
        banner.className = "api-warning";
        banner.innerHTML = `
            <span>⚠️ Backend not running!</span>
            <span>Run <code>python app.py</code> to enable AI responses</span>
        `;
        chatArea.prepend(banner);

        setTimeout(() => {
            addMessage(
                "Hey there, love! 💜 I'm so happy you're here! My AI brain isn't connected yet — ask your developer to start the backend! 🧠✨",
                "bot",
                "neutral"
            );
            addQuickReplies(["I'm great! 😊", "I miss you! 🥺", "Tell me a joke 😂"]);
        }, 800);
    }
});
