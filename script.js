/* Luna AI - Dynamic GSAP Frontend with Supabase Auth + Multi-Persona */
const API_BASE = "/api";

// DOM Elements
const authOverlay      = document.getElementById("authOverlay");
const appContainer     = document.getElementById("appContainer");
const dobOverlay       = document.getElementById("dobOverlay");
const tabLogin         = document.getElementById("tabLogin");
const tabSignup        = document.getElementById("tabSignup");
const loginForm        = document.getElementById("loginForm");
const signupForm       = document.getElementById("signupForm");
const dobForm          = document.getElementById("dobForm");
const loginError       = document.getElementById("loginError");
const signupError      = document.getElementById("signupError");
const dobError         = document.getElementById("dobError");
const logoutBtn        = document.getElementById("logout-btn");
const clearBtn         = document.getElementById("clear-chat-btn");
const premiumOverlay   = document.getElementById("premium-overlay");
const coinBalanceDisplay = document.getElementById("coin-balance");

const chatArea        = document.getElementById("chatArea");
const userInput       = document.getElementById("userInput");
const sendBtn         = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const welcomeMsg      = document.getElementById("welcomeMsg");
const heartsBg        = document.getElementById("heartsBg");

let isProcessing   = false;
let lastSender     = null;

// ── Session state ─────────────────────────────────────────
let accessToken     = localStorage.getItem("luna_access_token") || null;
let currentUserId   = localStorage.getItem("luna_user_id")      || null;
let currentUserName = localStorage.getItem("luna_user_name")    || null;
let currentPersona  = localStorage.getItem("luna_persona")      || null;
let currentCoins    = 0;

// ── Persona config ────────────────────────────────────────
const PERSONAS = {
    luna:  { name: "Luna",  emoji: "💜", status: "Online • Your AI Girlfriend",     color: "#a855f7" },
    priya: { name: "Priya", emoji: "🌾", status: "Online • Your Desi Girlfriend",   color: "#f59e0b" },
    sofia: { name: "Sofia", emoji: "🌹", status: "Online • Your Spanish Girlfriend", color: "#ef4444" },
    nara:  { name: "Nara",  emoji: "🌸", status: "Online • Your Thai Companion",    color: "#06b6d4" }
};

/** Apply persona branding to the chat header */
function applyPersonaHeader(persona) {
    const cfg    = PERSONAS[persona] || PERSONAS.luna;
    const avatar = document.getElementById("headerAvatar");
    const name   = document.getElementById("partnerName");
    const status = document.getElementById("partnerStatus");
    if (avatar) avatar.textContent = cfg.emoji;
    if (name)   name.textContent   = cfg.name;
    if (status) status.textContent = cfg.status;
    // Update welcome message
    const welcomeHeader = welcomeMsg && welcomeMsg.querySelector("h2");
    if (welcomeHeader && currentUserName) {
        const hour     = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
        welcomeHeader.innerHTML = `${greeting}, <span class="highlight">${currentUserName}</span>! 💕`;
    }
    const welcomeSub = welcomeMsg && welcomeMsg.querySelector("p");
    if (welcomeSub) {
        welcomeSub.innerHTML = `I'm <strong>${cfg.name}</strong>, your AI companion. Say hi to get started!`;
    }
}

/** Build auth header for protected API calls */
function authHeaders(extra = {}) {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        ...extra
    };
}

/** Persist session to localStorage */
function saveSession(token, userId, name) {
    accessToken     = token;
    currentUserId   = userId;
    currentUserName = name;
    localStorage.setItem("luna_access_token", token);
    localStorage.setItem("luna_user_id",      userId);
    localStorage.setItem("luna_user_name",    name);
}

/** Wipe session from localStorage */
function clearSession() {
    accessToken = currentUserId = currentUserName = null;
    localStorage.removeItem("luna_access_token");
    localStorage.removeItem("luna_user_id");
    localStorage.removeItem("luna_user_name");
}

// ── Coin display ───────────────────────────────────────────
function updateCoins(amount) {
    currentCoins = amount;
    coinBalanceDisplay.textContent = currentCoins;
    gsap.fromTo(coinBalanceDisplay.parentElement,
        { scale: 1.2, backgroundColor: "rgba(255, 183, 3, 0.4)" },
        { scale: 1,   backgroundColor: "rgba(255, 105, 180, 0.15)", duration: 0.5 }
    );
}

async function fetchMe() {
    try {
        const res = await fetch(`${API_BASE}/me`, { headers: authHeaders() });
        if (res.ok) {
            const data = await res.json();
            updateCoins(data.coins);
        } else if (res.status === 401) {
            doLogout();
        }
    } catch (e) {}
}

// ── Boot ───────────────────────────────────────────────────
window.addEventListener("load", async () => {
    if (accessToken && currentUserName) {
        if (!currentPersona) {
            // Logged in but no persona chosen → go to choose page
            window.location.href = "/choose";
            return;
        }
        applyPersonaHeader(currentPersona);
        showApp(currentUserName);
        fetchMe();
    } else {
        showAuth();
    }

    gsap.fromTo(".auth-box",
        { opacity: 0, y: 40, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)" }
    );
});

// ── View toggles ───────────────────────────────────────────
function showAuth() {
    authOverlay.style.display  = "flex";
    appContainer.style.display = "none";
    dobOverlay.style.display   = "none";
}

function showApp(name, coins = null) {
    authOverlay.style.display  = "none";
    dobOverlay.style.display   = "none";
    appContainer.style.display = "flex";

    if (coins !== null) updateCoins(coins);
    if (currentPersona) applyPersonaHeader(currentPersona);
    userInput.focus();

    gsap.fromTo(".app-container",
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }
    );
}

// ── Auth Tabs ──────────────────────────────────────────────
tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    loginForm.style.display  = "flex";
    signupForm.style.display = "none";
});

tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    signupForm.style.display = "flex";
    loginForm.style.display  = "none";
});

// ── Login → redirect to /choose ───────────────────────────
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnLogin");
    btn.disabled = true;
    loginError.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email:    document.getElementById("loginEmail").value.trim(),
                password: document.getElementById("loginPassword").value
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");

        saveSession(data.access_token, data.user_id, data.name);
        window.location.href = "/choose";          // → choose partner
    } catch (err) {
        loginError.textContent = err.message;
    } finally {
        btn.disabled = false;
    }
});

// ── Sign Up → redirect to /choose ─────────────────────────
signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSignup");
    btn.disabled = true;
    signupError.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email:    document.getElementById("signupEmail").value.trim(),
                password: document.getElementById("signupPassword").value,
                name:     document.getElementById("signupName").value,
                dob:      document.getElementById("signupDob").value
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sign up failed");

        saveSession(data.access_token, data.user_id, data.name);
        window.location.href = "/choose";          // → choose partner
    } catch (err) {
        signupError.textContent = err.message;
    } finally {
        btn.disabled = false;
    }
});

// ── Google Login callback ──────────────────────────────────
async function handleGoogleLogin(response) {
    const headerMsg = document.querySelector("#authOverlay .auth-header p");
    const originalText = headerMsg.textContent;
    const googleBtn    = document.getElementById("googleAuthContainer");

    headerMsg.textContent         = "Authenticating securely... ⏳";
    googleBtn.style.opacity       = "0.5";
    googleBtn.style.pointerEvents = "none";

    try {
        const clientId = response.clientId ||
            document.getElementById("g_id_onload").getAttribute("data-client_id");

        const res = await fetch(`${API_BASE}/google-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential, client_id: clientId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Google login failed");

        saveSession(data.access_token, data.user_id, data.name);

        if (data.needs_dob) {
            authOverlay.style.display = "none";
            dobOverlay.style.display  = "flex";
            gsap.fromTo("#dobOverlay .auth-box",
                { opacity: 0, scale: 0.8 },
                { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" }
            );
            updateCoins(data.coins);
        } else {
            window.location.href = "/choose";      // → choose partner
        }
    } catch (err) {
        loginError.textContent = err.message;
        headerMsg.textContent  = originalText;
        googleBtn.style.opacity = "1";
        googleBtn.style.pointerEvents = "auto";
    }
}

// ── DOB form (Google new users) ────────────────────────────
dobForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnDobSubmit");
    btn.disabled = true;
    dobError.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/update-dob`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ dob: document.getElementById("googleSignupDob").value })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        window.location.href = "/choose";          // → choose partner
    } catch (err) {
        dobError.textContent = err.message;
    } finally {
        btn.disabled = false;
    }
});

// ── Logout ─────────────────────────────────────────────────
function doLogout() {
    clearSession();
    localStorage.removeItem("luna_persona");
    currentPersona = null;
    updateCoins(0);
    loginForm.reset();
    signupForm.reset();
    dobForm.reset();
    loginError.textContent  = "";
    signupError.textContent = "";
    dobError.textContent    = "";
    resetChatVisuals();
    showAuth();
}

logoutBtn.addEventListener("click", doLogout);

// ── Exit Chat → back to choose page ───────────────────────
const exitBtn = document.getElementById("exit-chat-btn");
if (exitBtn) {
    exitBtn.addEventListener("click", () => {
        localStorage.removeItem("luna_persona");
        currentPersona = null;
        resetChatVisuals();
        window.location.href = "/choose";
    });
}

function resetChatVisuals() {
    chatArea.innerHTML = "";
    chatArea.appendChild(welcomeMsg);
    welcomeMsg.style.display = "block";
    lastSender = null;
}

// ── Coins / Payment ────────────────────────────────────────
async function buyCoins(coins, amountInRupees) {
    const statusMsg = document.getElementById("payment-status");
    statusMsg.style.color  = "var(--text-secondary)";
    statusMsg.textContent  = "Initiating secure payment...";

    try {
        const res = await fetch(`${API_BASE}/create-order`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ amount: amountInRupees, coins })
        });
        const orderData = await res.json();
        if (!res.ok) throw new Error(orderData.error);

        const options = {
            "key":      orderData.razorpay_key,
            "amount":   orderData.amount,
            "currency": orderData.currency,
            "name":     "Luna Love Coins",
            "description": `Purchase ${coins} Love Coins`,
            "image":    "https://i.imgur.com/8QG9TfT.png",
            "order_id": orderData.order_id,
            "handler": async function (response) {
                statusMsg.style.color = "var(--primary)";
                statusMsg.textContent = "Verifying payment securely...";
                try {
                    const verifyRes = await fetch(`${API_BASE}/verify-payment`, {
                        method: "POST",
                        headers: authHeaders(),
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id:   response.razorpay_order_id,
                            razorpay_signature:  response.razorpay_signature,
                            coins
                        })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyRes.ok && verifyData.status === "success") {
                        statusMsg.style.color = "#4ade80";
                        statusMsg.textContent = "Payment successful! Coins added. 💜";
                        updateCoins(verifyData.new_balance);
                        setTimeout(() => {
                            document.getElementById("premium-overlay").style.display = "none";
                            statusMsg.textContent = "";
                        }, 1500);
                    } else {
                        throw new Error(verifyData.error || "Verification failed");
                    }
                } catch (err) {
                    statusMsg.style.color = "#ff4d4d";
                    statusMsg.textContent = "Payment verification failed: " + err.message;
                }
            },
            "prefill": { "name": currentUserName },
            "theme":   { "color": "#E338A9" }
        };

        const rzp = new Razorpay(options);
        rzp.on("payment.failed", () => {
            statusMsg.style.color = "#ff4d4d";
            statusMsg.textContent = "Payment failed or cancelled.";
        });
        statusMsg.textContent = "Awaiting payment...";
        rzp.open();
    } catch (e) {
        statusMsg.style.color = "#ff4d4d";
        statusMsg.textContent = "Error: " + e.message;
    }
}

// ── GSAP Floating Hearts ───────────────────────────────────
function createHeart() {
    const heart = document.createElement("span");
    heart.classList.add("floating-heart");
    heart.textContent = ["💜", "💕", "✨", "🌸", "🦋"][Math.floor(Math.random() * 5)];
    heartsBg.appendChild(heart);

    gsap.fromTo(heart,
        { x: `${Math.random() * 100}vw`, y: "100vh", opacity: 0, scale: Math.random() * 0.5 + 0.5, rotation: 0 },
        { y: "-10vh", opacity: 0.5, scale: 1, rotation: 360,
          duration: Math.random() * 8 + 6, ease: "power1.inOut",
          onComplete: () => heart.remove()
        }
    );
}
setInterval(createHeart, 2000);

function scrollToBottom() {
    setTimeout(() => { chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" }); }, 50);
}

// ── Typing animation ───────────────────────────────────────
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

// ── Message renderer ───────────────────────────────────────
function addMessage(text, sender, emotion = null) {
    if (welcomeMsg) welcomeMsg.style.display = "none";

    const row = document.createElement("div");
    row.classList.add("message-row", sender);

    if (lastSender === sender) {
        row.classList.add("chained-top");
        const prevMessages = chatArea.querySelectorAll(".message-row");
        if (prevMessages.length > 0) prevMessages[prevMessages.length - 1].classList.add("chained-bottom");
    }
    lastSender = sender;

    const cfg          = PERSONAS[currentPersona] || PERSONAS.luna;
    const avatarEmoji  = sender === "bot" ? cfg.emoji : "🧑";
    let   emotionBadge = "";
    if (emotion && sender === "bot" && emotion !== "neutral") {
        emotionBadge = `<span class="emotion-badge">${emotion}</span>`;
    }

    const parsedText = marked.parse(text).replace(/<p><\/p>/g, "");

    row.innerHTML = `
        ${sender === "bot" ? `<div class="msg-avatar">${avatarEmoji}</div>` : ""}
        <div class="msg-content">
            <div class="msg-bubble">${parsedText}</div>
            <div class="msg-meta">
                <span class="msg-time">${new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</span>
                ${emotionBadge}
            </div>
        </div>
        ${sender === "user" ? `<div class="msg-avatar" style="background:linear-gradient(135deg, #4facfe, #00f2fe);">${avatarEmoji}</div>` : ""}
    `;

    chatArea.appendChild(row);
    scrollToBottom();

    gsap.fromTo(row,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.5)" }
    );
}

// ── API comms ──────────────────────────────────────────────
async function sendToAPI(message) {
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                message,
                persona: currentPersona || "luna"
            })
        });
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) doLogout();
            if (data.require_payment) {
                premiumOverlay.style.display = "flex";
                gsap.fromTo("#premium-overlay .auth-card",
                    { y: -50, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.5)" }
                );
                return { is_error: true };
            }
            throw new Error(`HTTP ${response.status}`);
        }
        return data;
    } catch (e) {
        return null;
    }
}

async function handleUserMessage(text) {
    if (!text.trim() || isProcessing || !accessToken) return;
    isProcessing = true;

    gsap.to(sendBtn, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1 });

    addMessage(text, "user");
    typingIndicator.classList.add("show");
    scrollToBottom();

    const result = await sendToAPI(text);
    typingIndicator.classList.remove("show");

    if (result && !result.is_error) {
        addMessage(result.reply, "bot", result.emotion);
        if (result.coins_remaining !== undefined) updateCoins(result.coins_remaining);
    } else if (result && result.is_error) {
        const lastUserNode = chatArea.lastChild;
        chatArea.removeChild(lastUserNode);
    } else {
        const cfg = PERSONAS[currentPersona] || PERSONAS.luna;
        addMessage(`Oops! ${cfg.name}'s connection dropped for a second. 🥺 Try again?`, "bot", "lonely");
    }
    isProcessing = false;
}

// ── Input listeners ────────────────────────────────────────
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
    if (!accessToken) return;
    gsap.to(".message-row", {
        opacity: 0, x: -50, stagger: 0.05, duration: 0.3,
        onComplete: async () => {
            chatArea.innerHTML = "";
            lastSender = null;
            await fetch(`${API_BASE}/clear`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ persona: currentPersona || "luna" })
            });
            chatArea.appendChild(welcomeMsg);
            welcomeMsg.style.display = "block";
            gsap.fromTo(welcomeMsg, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" });
        }
    });
});
