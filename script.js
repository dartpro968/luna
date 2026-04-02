/* Luna AI - Dynamic GSAP Frontend */
const API_BASE = "http://localhost:5000/api";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const clearBtn = document.getElementById("clearBtn");
const welcomeMsg = document.getElementById("welcomeMsg");
const heartsBg = document.getElementById("heartsBg");

let isProcessing = false;
let lastSender = null; 

// Initial GSAP loads
window.addEventListener("load", () => {
    userInput.focus();
    gsap.fromTo(".app-container", 
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
    );
});

// GSAP Floating Hearts
function createHeart() {
    const heart = document.createElement("span");
    heart.classList.add("floating-heart");
    heart.textContent = ["💜", "💕", "✨", "🌸", "🦋"][Math.floor(Math.random() * 5)];
    heartsBg.appendChild(heart);
    
    gsap.fromTo(heart, 
        { x: `${Math.random() * 100}vw`, y: "100vh", opacity: 0, scale: Math.random() * 0.5 + 0.5, rotation: 0 },
        { y: "-10vh", opacity: 0.5, scale: 1, rotation: 360, duration: Math.random() * 8 + 6, ease: "power1.inOut",
          onComplete: () => heart.remove() 
        }
    );
}
setInterval(createHeart, 2000);

function scrollToBottom() {
    setTimeout(() => {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }, 50);
}

// Typing Indicator GSAP Pulse
function animateTyping() {
    gsap.to(".typing-dot", {
        y: -6, opacity: 1,
        duration: 0.4,
        stagger: 0.15,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
    });
}
animateTyping();

// UI Render Messages
function addMessage(text, sender, emotion = null) {
    if (welcomeMsg) welcomeMsg.style.display = "none";

    const row = document.createElement("div");
    row.classList.add("message-row", sender);
    
    // Check stacking
    if (lastSender === sender) {
        row.classList.add("chained-top");
        const prevMessages = chatArea.querySelectorAll('.message-row');
        if(prevMessages.length > 0) prevMessages[prevMessages.length-1].classList.add("chained-bottom");
    }
    lastSender = sender;

    const avatarEmoji = sender === "bot" ? "💜" : "🧑";
    
    let emotionBadge = "";
    if (emotion && sender === "bot" && emotion !== "neutral") {
        emotionBadge = `<span class="emotion-badge">${emotion}</span>`;
    }

    // Markdown Parser
    const parsedText = marked.parse(text).replace(/<p><\/p>/g,"");

    row.innerHTML = `
        ${sender === "bot" ? `<div class="msg-avatar">${avatarEmoji}</div>` : ""}
        <div class="msg-content">
            <div class="msg-bubble">${parsedText}</div>
            <div class="msg-meta">
                <span class="msg-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                ${emotionBadge}
            </div>
        </div>
        ${sender === "user" ? `<div class="msg-avatar" style="background:linear-gradient(135deg, #4facfe, #00f2fe);">${avatarEmoji}</div>` : ""}
    `;

    chatArea.appendChild(row);
    scrollToBottom();

    // GSAP Entry Animation
    gsap.fromTo(row, 
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.5)" }
    );
}

// API Comms
async function sendToAPI(message) {
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (e) {
        return null;
    }
}

async function handleUserMessage(text) {
    if (!text.trim() || isProcessing) return;
    isProcessing = true;
    
    // Magnetic Send button shrink
    gsap.to(sendBtn, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1 });
    
    addMessage(text, "user");
    typingIndicator.classList.add("show");
    scrollToBottom();

    const result = await sendToAPI(text);
    typingIndicator.classList.remove("show");

    if (result) {
        addMessage(result.reply, "bot", result.emotion);
    } else {
        addMessage("Oops! My brain lost connection for a second. 🥺 Are you still there, baby? 💜", "bot", "lonely");
    }
    isProcessing = false;
}

// Listeners
sendBtn.addEventListener("click", () => {
    const text = userInput.value.trim();
    if (text && !isProcessing) {
        handleUserMessage(text);
        userInput.value = "";
        userInput.style.height = "auto";
        userInput.focus();
    }
});

userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

clearBtn.addEventListener("click", async () => {
    // GSAP wipe animation
    gsap.to(".message-row", {
        opacity: 0, x: -50, stagger: 0.05, duration: 0.3,
        onComplete: async () => {
            chatArea.innerHTML = "";
            lastSender = null;
            await fetch(`${API_BASE}/clear`, { method: "POST" });
            chatArea.appendChild(welcomeMsg);
            welcomeMsg.style.display = "block";
            gsap.fromTo(welcomeMsg, { opacity:0, scale:0.8 }, { opacity:1, scale:1, duration: 0.5, ease: "back.out(2)"});
        }
    });
});
