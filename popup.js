let recognition;
let isListening = false;

const video = document.getElementById("video");
const actionButton = document.getElementById("actionButton");
const featureSelect = document.getElementById("featureSelect");
const conditionDropdown = document.getElementById("conditionDropdown");
const statusMessage = document.getElementById("status");
const chatbox = document.getElementById("chatbox");

let detectionInterval;
let currentCondition = null;

async function startVideo() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        video.onloadeddata = function () {
            console.log("Video stream ready, starting face detection...");
            scanFace();
            startFaceDetectionLoop();
        };
    } catch (error) {
        console.error("Camera access denied:", error);
    }
}

async function registerFace() {
    statusMessage.textContent = "Registering face...";

    const name = prompt("Enter your name:");
    const condition = document.getElementById("conditionSelect").value;

    if (!condition) {
        alert("Please select a vision condition.");
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("condition", condition);
        formData.append("image", blob);

        fetch("http://127.0.0.1:5000/register", {
            method: "POST",
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                alert(data.message || data.error);
                statusMessage.textContent = data.message || data.error;
            })
            .catch(error => {
                console.error("Error during registration:", error);
                alert("Error during registration!");
                statusMessage.textContent = "Error during registration.";
            });
    }, "image/jpeg");
}

function scanFace(isManual = false) {
    statusMessage.textContent = "Scanning face...";

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append("image", blob);

        fetch("http://127.0.0.1:5000/detect", {
            method: "POST",
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.message && data.message.trim() !== "") {
                    clearInterval(detectionInterval);
                    statusMessage.textContent = "User detected: " + data.message;

                    const conditionMatch = data.message.match(/\(([^)]+)\)/);
                    currentCondition = conditionMatch ? conditionMatch[1] : null;

                    // Immediately apply accessibility features
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        const tabId = tabs[0]?.id;
                        if (tabId && currentCondition) {
                            // Update background state
                            chrome.runtime.sendMessage({
                                action: 'setCondition',
                                condition: currentCondition,
                                tabId: tabId
                              });
                              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                const tabId = tabs[0]?.id;
                                if (tabId && currentCondition) {
                                  chrome.runtime.sendMessage({
                                    action: 'setCondition',
                                    condition: currentCondition,
                                    tabId: tabId
                                  });
                                }
                              });
                              if (currentCondition.includes('Color Blindness')) {
                                chrome.tabs.reload(tabId); // Ensure styles apply
                              }                        
                            // Force immediate injection
                            chrome.scripting.executeScript({
                                target: { tabId },
                                func: (condition) => {
                                    sessionStorage.setItem('accessibilityCondition', condition);
                                },
                                args: [currentCondition]
                            });

                            // Reinject early styles
                            chrome.scripting.executeScript({
                                target: { tabId },
                                files: ['early-injection.js']
                            })
                        }
                    });

                    if (data.message.includes("Complete Blindness") || 
                        data.message.includes("Partial Blindness")) {
                        showChatbox();
                    }else {
                        // alert("Users detected: " + data.message);
                    }
                } else {
                    statusMessage.textContent = "No face detected. Please ensure your face is visible.";
                    console.log("No recognizable face in the frame.");
                    if (isManual) alert("No face detected.");
                }
            })
            .catch(error => {
                console.error("Error during face detection:", error);
                alert("Error during face detection!");
                statusMessage.textContent = "Face detection error.";
            });
    }, "image/jpeg");
}

function startFaceDetectionLoop() {
    detectionInterval = setInterval(() => {
        scanFace();
    }, 2000);
}

function handleFeatureSelection() {
    const selectedFeature = featureSelect.value;
    if (selectedFeature === "register") {
        actionButton.textContent = "Register Your Face";
        actionButton.onclick = registerFace;
        conditionDropdown.style.display = "block";
    } else if (selectedFeature === "scan") {
        actionButton.textContent = "Scan & Identify";
        actionButton.onclick = () => scanFace(true);
        conditionDropdown.style.display = "none";
    } else {
        actionButton.textContent = "Start";
        conditionDropdown.style.display = "none";
    }
}

featureSelect.addEventListener("change", handleFeatureSelection);

function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}

function showChatbox() {
    document.querySelector('.video-container').style.display = 'none';
    featureSelect.style.display = 'none';
    actionButton.style.display = 'none';
    conditionDropdown.style.display = 'none';

    chatbox.style.display = "flex";
    chatbox.focus();
    addMessage("Voice navigation ready. Press Space to start listening.", "system");

    const link = document.querySelector("link[rel='stylesheet']");
    if (link) link.disabled = true;

    if (currentCondition === "Complete Blindness" || 
        currentCondition === "Partial Blindness") {
        chatbox.style.width = "100%";
        chatbox.style.height = "100%";
        chatbox.style.fontFamily = "sans-serif";
    }
}

function hideChatbox() {
    document.querySelector('.video-container').style.display = 'block';
    featureSelect.style.display = 'block';
    actionButton.style.display = 'block';
    conditionDropdown.style.display = 'block';
    chatbox.style.display = "none";

    const link = document.querySelector("link[rel='stylesheet']");
    if (link) link.disabled = false;
}

function addMessage(text, type = "system") {
    const msg = document.createElement("div");
    msg.className = `message ${type}`;
    msg.textContent = text;
    chatbox.appendChild(msg);
    chatbox.scrollTop = chatbox.scrollHeight;

    if (type === "system") {
        speak(text);
    }
}

function startRecognition() {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        addMessage("You said: " + text, "user");

        const formData = new FormData();
        formData.append("text", text);

        fetch("http://localhost:5001/recognize", {
            method: "POST",
            body: formData,
        })
            .then((res) => res.json())
            .then((data) => {
                addMessage("Response: " + data.text, "system");
                chrome.runtime.sendMessage({ text: data.text });
            })
            .catch((err) => {
                addMessage("Error: " + err.message);
                console.error(err);
            });
    };

    recognition.onerror = (event) => {
        addMessage("Recognition error: " + event.error);
    };

    recognition.onend = () => {
        if (isListening) recognition.start();
    };

    recognition.start();
    isListening = true;
    addMessage("Listening for commands...");
}

document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        e.preventDefault();
        if (!isListening) {
            startRecognition();
        } else {
            isListening = false;
            recognition.stop();
            addMessage("Stopped listening.", "system");
        }
    }
});

document.addEventListener("DOMContentLoaded", function () {
    startVideo();
});