/* Luna AI - Dynamic GSAP Frontend with Auth */
const API_BASE = "/api";

// DOM Elements
const authOverlay = document.getElementById("authOverlay");
const appContainer = document.getElementById("appContainer");
const dobOverlay = document.getElementById("dobOverlay");
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const dobForm = document.getElementById("dobForm");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const dobError = document.getElementById("dobError");
const userNameDisplay = document.getElementById("userNameDisplay");
const logoutBtn = document.getElementById("logout-btn");
const clearBtn = document.getElementById("clear-chat-btn");
const premiumOverlay = document.getElementById("premium-overlay");
const coinBalanceDisplay = document.getElementById("coin-balance");

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const welcomeMsg = document.getElementById("welcomeMsg");
const heartsBg = document.getElementById("heartsBg");

let isProcessing = false;
let lastSender = null; 
let currentUserId = localStorage.getItem("luna_user_id") || null;
let currentUserName = localStorage.getItem("luna_user_name") || null;
let currentCoins = 0;

function updateCoins(amount) {
    currentCoins = amount;
    coinBalanceDisplay.textContent = currentCoins;
    gsap.fromTo(coinBalanceDisplay.parentElement, 
        { scale: 1.2, backgroundColor: "rgba(255, 183, 3, 0.4)" },
        { scale: 1, backgroundColor: "rgba(255, 105, 180, 0.15)", duration: 0.5 }
    );
}

async function fetchMe() {
    try {
        const res = await fetch(`${API_BASE}/me`, { headers: {"X-User-ID": currentUserId} });
        if(res.ok) {
            const data = await res.json();
            updateCoins(data.coins);
        }
    } catch(e) {}
}

// Initial Checks
window.addEventListener("load", async () => {
    if (currentUserId && currentUserName) {
        showApp(currentUserName);
        fetchMe(); // fetch fresh coin balance on load
    } else {
        showAuth();
    }
    
    gsap.fromTo(".auth-box", 
        { opacity: 0, y: 40, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)" }
    );
});

// UI View Toggles
function showAuth() {
    authOverlay.style.display = "flex";
    appContainer.style.display = "none";
    dobOverlay.style.display = "none";
}

function showApp(name, coins = null) {
    authOverlay.style.display = "none";
    dobOverlay.style.display = "none";
    appContainer.style.display = "flex";
    
    // Personalization: Time of day greeting
    const hour = new Date().getHours();
    let greeting = "Hey";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";
    
    const welcomeHeader = welcomeMsg.querySelector("h2");
    if(welcomeHeader) {
        welcomeHeader.innerHTML = `${greeting}, <span id="userNameDisplay" class="highlight">${name}</span>! 💕`;
    }

    if (coins !== null) updateCoins(coins);
    userInput.focus();
    
    gsap.fromTo(".app-container", 
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }
    );
}

// Google Login Callback
async function handleGoogleLogin(response) {
    const headerMsg = document.querySelector("#authOverlay .auth-header p");
    const originalText = headerMsg.textContent;
    const googleBtn = document.getElementById("googleAuthContainer");
    
    // Show Busy State
    headerMsg.textContent = "Authenticating securely... ⏳";
    googleBtn.style.opacity = "0.5";
    googleBtn.style.pointerEvents = "none";

    try {
        const clientId = response.clientId || document.getElementById("g_id_onload").getAttribute("data-client_id");
        const res = await fetch(`${API_BASE}/google-login`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                credential: response.credential,
                client_id: clientId
            })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || "Google login failed");

        currentUserId = data.user_id;
        currentUserName = data.name;
        localStorage.setItem("luna_user_id", currentUserId);
        localStorage.setItem("luna_user_name", currentUserName);

        if (data.needs_dob) {
            // New Google user, needs DOB
            authOverlay.style.display = "none";
            dobOverlay.style.display = "flex";
            gsap.fromTo("#dobOverlay .auth-box", 
                { opacity: 0, scale: 0.8 },
                { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" }
            );
            updateCoins(data.coins);
        } else {
            // Existing Google user
            showApp(currentUserName, data.coins);
            resetChatVisuals();
        }
    } catch (err) {
        loginError.textContent = err.message;
        // Revert Busy State on Error
        headerMsg.textContent = originalText;
        googleBtn.style.opacity = "1";
        googleBtn.style.pointerEvents = "auto";
    }
}

// DOB Form Submit
dobForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnDobSubmit");
    btn.disabled = true;
    dobError.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/update-dob`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": currentUserId
            },
            body: JSON.stringify({
                dob: document.getElementById("googleSignupDob").value
            })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);

        showApp(currentUserName);
        resetChatVisuals();
    } catch (err) {
        dobError.textContent = err.message;
    } finally {
        btn.disabled = false;
    }
});

function resetChatVisuals() {
    chatArea.innerHTML = "";
    chatArea.appendChild(welcomeMsg);
    welcomeMsg.style.display = "block";
}

// Auth Tabs
tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    loginForm.style.display = "flex";
    signupForm.style.display = "none";
});

tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    signupForm.style.display = "flex";
    loginForm.style.display = "none";
});

// Auth Handlers (Username/Password)
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnLogin");
    btn.disabled = true;
    loginError.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username: document.getElementById("loginUsername").value,
                password: document.getElementById("loginPassword").value
            })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);

        currentUserId = data.user_id;
        currentUserName = data.name;
        localStorage.setItem("luna_user_id", currentUserId);
        localStorage.setItem("luna_user_name", currentUserName);
        showApp(currentUserName, data.coins);
        resetChatVisuals();
    } catch (err) {
        loginError.textContent = err.message;
    } finally {
        btn.disabled = false;
    }
});

signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSignup");
    btn.disabled = true;
    signupError.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/signup`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username: document.getElementById("signupUsername").value,
                password: document.getElementById("signupPassword").value,
                name: document.getElementById("signupName").value,
                dob: document.getElementById("signupDob").value
            })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);

        currentUserId = data.user_id;
        currentUserName = data.name;
        localStorage.setItem("luna_user_id", currentUserId);
        localStorage.setItem("luna_user_name", currentUserName);
        // On strict signup, db defaults to 5 coins (app.py) but endpoint needs fixing if returned. 
        // We will just fetchMe()
        showApp(currentUserName);
        fetchMe();
        resetChatVisuals();
    } catch (err) {
        signupError.textContent = err.message;
    } finally {
        btn.disabled = false;
    }
});

logoutBtn.addEventListener("click", () => {
    currentUserId = null;
    currentUserName = null;
    localStorage.removeItem("luna_user_id");
    localStorage.removeItem("luna_user_name");
    updateCoins(0);
    
    // reset form visuals
    loginForm.reset();
    signupForm.reset();
    dobForm.reset();
    loginError.textContent = "";
    signupError.textContent = "";
    dobError.textContent = "";
    
    resetChatVisuals();
    showAuth();
});

// Premium Payment System with Razorpay
async function buyCoins(coins, amountInRupees) {
    const statusMsg = document.getElementById("payment-status");
    statusMsg.style.color = "var(--text-secondary)";
    statusMsg.textContent = "Initiating secure payment...";

    try {
        // Step 1: Create Order on Backend
        const res = await fetch(`${API_BASE}/create-order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-ID": currentUserId
            },
            body: JSON.stringify({ amount: amountInRupees, coins: coins })
        });
        const orderData = await res.json();
        
        if(!res.ok) throw new Error(orderData.error);

        // Step 2: Open Razorpay Checkout Modal
        const options = {
            "key": orderData.razorpay_key, // Passed from backend
            "amount": orderData.amount, // in paise
            "currency": orderData.currency,
            "name": "Luna Love Coins",
            "description": `Purchase ${coins} Love Coins`,
            "image": "https://i.imgur.com/8QG9TfT.png", // cute luna temporary icon
            "order_id": orderData.order_id,
            "handler": async function (response) {
                statusMsg.style.color = "var(--primary)";
                statusMsg.textContent = "Verifying payment securely...";

                // Step 3: Verify Payment on Backend
                try {
                    const verifyRes = await fetch(`${API_BASE}/verify-payment`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-User-ID": currentUserId
                        },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            coins: coins
                        })
                    });
                    
                    const verifyData = await verifyRes.json();
                    
                    if(verifyRes.ok && verifyData.status === "success") {
                        statusMsg.style.color = "#4ade80";
                        statusMsg.textContent = "Payment successful! Coins added. 💜";
                        updateCoins(verifyData.new_balance);
                        
                        setTimeout(() => {
                            document.getElementById('premium-overlay').style.display = "none";
                            statusMsg.textContent = "";
                        }, 1500);
                    } else {
                        throw new Error(verifyData.error || "Verification failed");
                    }
                } catch(err) {
                    statusMsg.style.color = "#ff4d4d";
                    statusMsg.textContent = "Payment verification failed: " + err.message;
                }
            },
            "prefill": {
                "name": currentUserName,
            },
            "theme": {
                "color": "#E338A9" // Luna's accent color
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response){
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
            method: "POST", 
            headers: { 
                "Content-Type": "application/json",
                "X-User-ID": currentUserId 
            },
            body: JSON.stringify({ message }),
        });
        const data = await response.json();
        if (!response.ok) {
            if(response.status === 401) logoutBtn.click();
            if(data.require_payment) {
                // Show out of coins overlay!
                premiumOverlay.style.display = "flex";
                gsap.fromTo("#premium-overlay .auth-card", 
                    { y: -50, opacity: 0 }, 
                    { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.5)" }
                );
                return { is_error: true, fallback: "I'm sorry baby, my network is locked... 🥺" };
            }
            throw new Error(`HTTP ${response.status}`);
        }
        return data;
    } catch (e) {
        return null;
    }
}

async function handleUserMessage(text) {
    if (!text.trim() || isProcessing || !currentUserId) return;
    isProcessing = true;
    
    // Magnetic Send button shrink
    gsap.to(sendBtn, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1 });
    
    addMessage(text, "user");
    typingIndicator.classList.add("show");
    scrollToBottom();

    const result = await sendToAPI(text);
    typingIndicator.classList.remove("show");

    if (result && !result.is_error) {
        addMessage(result.reply, "bot", result.emotion);
        if(result.coins_remaining !== undefined) updateCoins(result.coins_remaining);
    } else if (result && result.is_error) {
        // Chat rejected locally via DB constraints
        const lastUserNode = chatArea.lastChild;
        chatArea.removeChild(lastUserNode); // Pull back their unsent message
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
    if(!currentUserId) return;
    // GSAP wipe animation
    gsap.to(".message-row", {
        opacity: 0, x: -50, stagger: 0.05, duration: 0.3,
        onComplete: async () => {
            chatArea.innerHTML = "";
            lastSender = null;
            await fetch(`${API_BASE}/clear`, { 
                method: "POST", 
                headers: {"X-User-ID": currentUserId}
            });
            chatArea.appendChild(welcomeMsg);
            welcomeMsg.style.display = "block";
            gsap.fromTo(welcomeMsg, { opacity:0, scale:0.8 }, { opacity:1, scale:1, duration: 0.5, ease: "back.out(2)"});
        }
    });
});
