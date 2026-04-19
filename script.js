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
    luna:  { name: "Luna",  image: "images/luna_dp.png", status: "Online • Your AI Girlfriend",     color: "#a855f7" },
    priya: { name: "Priya", image: "images/priya_dp.png", status: "Online • Your Desi Girlfriend",   color: "#f59e0b" },
    sofia: { name: "Sofia", image: "images/sofia_dp.png", status: "Online • Your Spanish Girlfriend", color: "#ef4444" },
    nara:  { name: "Nara",  image: "images/nara_dp.png", status: "Online • Your Thai Companion",    color: "#06b6d4" }
};

/** Apply persona branding to the chat header */
function applyPersonaHeader(persona) {
    const cfg    = PERSONAS[persona] || PERSONAS.luna;
    const avatar = document.getElementById("headerAvatar");
    const name   = document.getElementById("partnerName");
    const status = document.getElementById("partnerStatus");
    if (avatar) avatar.innerHTML = `<img src="${cfg.image}" alt="${cfg.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    if (name)   name.textContent   = cfg.name;
    if (status) status.textContent = cfg.status;
    
    const typingAvatar = document.querySelector(".typing-avatar");
    if (typingAvatar) typingAvatar.innerHTML = `<img src="${cfg.image}" alt="${cfg.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;

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
            window.location.href = "choose.html";
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
        
        Swal.fire({
            icon: 'success',
            title: 'Welcome back!',
            text: 'Preparing your chat...',
            background: '#120A27',
            color: '#fff',
            showConfirmButton: false,
            timer: 1500
        }).then(() => {
            window.location.href = "/choose";
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Login Failed',
            text: err.message,
            background: '#120A27',
            color: '#fff',
            confirmButtonColor: '#E338A9'
        });
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
        
        Swal.fire({
            icon: 'success',
            title: 'Account Created',
            text: 'Welcome to Luna AI!',
            background: '#120A27',
            color: '#fff',
            showConfirmButton: false,
            timer: 1500
        }).then(() => {
            window.location.href = "/choose";
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Sign Up Failed',
            text: err.message,
            background: '#120A27',
            color: '#fff',
            confirmButtonColor: '#E338A9'
        });
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
            Swal.fire({
                icon: 'success',
                title: 'Google Login Successful',
                text: 'Welcome back!',
                background: '#120A27',
                color: '#fff',
                showConfirmButton: false,
                timer: 1500
            }).then(() => {
                window.location.href = "/choose";
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Google Auth Failed',
            text: err.message,
            background: '#120A27',
            color: '#fff',
            confirmButtonColor: '#E338A9'
        });
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

        Swal.fire({
            icon: 'success',
            title: 'All Set!',
            text: 'Thanks for updating your profile.',
            background: '#120A27',
            color: '#fff',
            showConfirmButton: false,
            timer: 1500
        }).then(() => {
            window.location.href = "/choose";
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Update Failed',
            text: err.message,
            background: '#120A27',
            color: '#fff',
            confirmButtonColor: '#E338A9'
        });
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
    
    Swal.fire({
        icon: 'info',
        title: 'Logged Out',
        text: 'You have been successfully logged out.',
        background: '#120A27',
        color: '#fff',
        timer: 1500,
        showConfirmButton: false
    });
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
async function buyPackage(package_type) {
    const statusMsg = document.getElementById("payment-status");
    statusMsg.style.color  = "var(--text-secondary)";
    statusMsg.textContent  = "Initiating secure payment...";

    try {
        const res = await fetch(`${API_BASE}/create-order`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ package_type })
        });
        const orderData = await res.json();
        if (!res.ok) throw new Error(orderData.error);

        const options = {
            "key":      orderData.razorpay_key,
            "amount":   orderData.amount,
            "currency": orderData.currency,
            "name":     "Luna AI",
            "description": package_type === "subscription" ? "The Luna Pass (Monthly)" : "Premium Coins Bundle",
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
                            package_type
                        })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyRes.ok && verifyData.status === "success") {
                        statusMsg.style.color = "#4ade80";
                        statusMsg.textContent = verifyData.message || "Payment successful! 💜";
                        if (verifyData.new_balance) updateCoins(verifyData.new_balance);
                        if (verifyData.tier === "premium") updateCoins("Unlimited");
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
    const avatarHtml   = sender === "bot" 
        ? `<img src="${cfg.image}" alt="${cfg.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` 
        : "🧑";
    let   emotionBadge = "";
    if (emotion && sender === "bot" && emotion !== "neutral") {
        emotionBadge = `<span class="emotion-badge">${emotion}</span>`;
    }

    const parsedText = marked.parse(text).replace(/<p><\/p>/g, "");

    row.innerHTML = `
        ${sender === "bot" ? `<div class="msg-avatar" style="padding: 0; overflow: hidden; background: none;">${avatarHtml}</div>` : ""}
        <div class="msg-content">
            <div class="msg-bubble">${parsedText}</div>
            <div class="msg-meta">
                <span class="msg-time">${new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</span>
                ${emotionBadge}
            </div>
        </div>
        ${sender === "user" ? `<div class="msg-avatar" style="background:linear-gradient(135deg, #4facfe, #00f2fe);">${avatarHtml}</div>` : ""}
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
            // 402 = out of coins (free tier), 429 = daily soft cap (premium)
            if (response.status === 402 || response.status === 429 || data.auth_action) {
                premiumOverlay.style.display = "flex";
                gsap.fromTo("#premium-overlay .premium-card",
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

    if (result && !result.is_error && result.replies) {
        // Handle multiple replies (rapid fire mode)
        for (let i = 0; i < result.replies.length; i++) {
            // Keep typing indicator on if there are more messages coming
            typingIndicator.classList.add("show");
            scrollToBottom();

            // Artificial delay based on message length
            const delay = Math.min(2000, 500 + result.replies[i].length * 20);
            await new Promise(r => setTimeout(r, delay));

            typingIndicator.classList.remove("show");
            addMessage(result.replies[i], "bot", result.emotion);
            if (result.coins_remaining !== undefined && i === 0) updateCoins(result.coins_remaining);
            
            // Short gap between messages if it's not the last one
            if (i < result.replies.length - 1) {
                await new Promise(r => setTimeout(r, 600));
            }
        }
    } else if (result && result.is_error) {
        typingIndicator.classList.remove("show");
        const lastUserNode = chatArea.lastChild;
        if (lastUserNode) chatArea.removeChild(lastUserNode);
    } else {
        typingIndicator.classList.remove("show");
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

// ── Password Visibility Toggle ─────────────────────────────────
window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === "password") {
        input.type = "text";
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        `;
        btn.style.color = "var(--accent)";
    } else {
        input.type = "password";
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
        btn.style.color = "var(--text-muted)";
    }
};
