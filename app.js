// ======================================================
// 🔥 FACULTECH PWA - FINAL APP.JS WITH SENSOR GRAPH + GLOW
// ======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } 
from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";

// ---------------- FIREBASE CONFIG ----------------
const firebaseConfig = {
  apiKey: "AIzaSyABC_3jc_TYgCKIq0RtK6YjDdGaRx4LeNY",
  authDomain: "facultech2.firebaseapp.com",
  databaseURL: "https://facultech2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "facultech2",
  storageBucket: "facultech2.firebasestorage.app",
  messagingSenderId: "614350399768",
  appId: "1:614350399768:web:9bb18fde62621c18c7566d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Register service worker for Firebase Messaging
let messaging;
async function initializeMessaging() {
  // Register the service worker
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('service-worker.js');
      console.log('Service Worker registered:', registration);
      
      // Initialize messaging with service worker registration
      messaging = getMessaging(app, {
        serviceWorkerRegistration: registration
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      // Fallback to default messaging without service worker
      messaging = getMessaging(app);
    }
  } else {
    console.warn('Service Worker not supported');
    messaging = getMessaging(app);
  }
  
  // Set up foreground message handler after messaging is initialized
  if (messaging) {
    onMessage(messaging, payload => {
      console.log("Message received in foreground:", payload);
      const title = payload?.notification?.title || "Alert";
      const body = payload?.notification?.body || "New notification received.";
      alert(`${title}\n${body}`);
    });
  }
}

// Initialize messaging on load
initializeMessaging();

const BACKEND_URL = "https://facultech-backend-2.onrender.com"; // ✅ FIXED: Removed trailing slash

// ================= AUTH FUNCTIONS =================
window.handleSignUp = async function() {
  // Check header inputs first, then fall back to auth-section inputs
  const headerEmail = document.getElementById("header-email")?.value;
  const headerPassword = document.getElementById("header-password")?.value;
  const authEmail = document.getElementById("email")?.value;
  const authPassword = document.getElementById("password")?.value;
  
  const email = headerEmail || authEmail;
  const password = headerPassword || authPassword;
  
  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }
  
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created successfully!");
  } catch (err) {
    alert(err.message);
  }
};

window.handleLogin = async function() {
  // Check header inputs first, then fall back to auth-section inputs
  const headerEmail = document.getElementById("header-email")?.value;
  const headerPassword = document.getElementById("header-password")?.value;
  const authEmail = document.getElementById("email")?.value;
  const authPassword = document.getElementById("password")?.value;
  
  const email = headerEmail || authEmail;
  const password = headerPassword || authPassword;
  
  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert(err.message);
  }
};

window.logout = async function() {
  await signOut(auth);
  document.getElementById('logout-btn-top').style.display = 'none';
};

// ================= AUTH STATE CHANGE =================
onAuthStateChanged(auth, user => {
  const authContainer = document.getElementById("auth-container");
  const authSection = document.getElementById("auth-section");
  const dashSection = document.getElementById("dashboard-section");
  const cctvSection = document.getElementById("cctv-section");
  const logoutTopBtn = document.getElementById("logout-btn-top");
  const authControls = document.querySelector(".auth-controls");

  if (user) {
    // Hide auth section and controls, show dashboard
    authContainer.style.display = "none";
    if (authControls) authControls.style.display = "none";
    dashSection.style.display = "block";
    cctvSection.style.display = "block";
    logoutTopBtn.style.display = "block";

    enableNotifications();
    startCCTVRefresh();
    startSensorGraph(); // initialize graph
    fetchSensorData(); // initial fetch
    startSensorPolling();
  } else {
    // Show auth controls in top-right, hide dashboard
    authContainer.style.display = "none";
    if (authControls) authControls.style.display = "flex";
    dashSection.style.display = "none";
    cctvSection.style.display = "none";
    logoutTopBtn.style.display = "none";
    stopSensorPolling();
    stopCCTVAnimation();
  }
});

// ================= NOTIFICATIONS =================
async function enableNotifications() {
  try {
    if (!messaging) {
      await initializeMessaging();
    }
    if (!messaging) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const token = await getToken(messaging, {
      vapidKey: "BAQ_WLlQod_O-Ffdv7ISmcgJz9kuQohO47Ylf8fX4AKYYZUJzJjKUu8krX8p94rliwRlG6Yeb8nVzsYxANf2Mps"
    });

    if (!token) return;

    await fetch(`${BACKEND_URL}/save-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });

  } catch (err) {
    console.error(err);
  }
}

// ================= SENSOR ANIMATION + GLOW =================
function updateSensorValues(coValue, pm25Value) {
  const coElem = document.getElementById("co");
  const pmElem = document.getElementById("pm25");
  const sensorCard = document.querySelector(".sensor-card");

  if (!coElem || !pmElem) return;

  let valueChanged = false;

  if (coElem.textContent !== coValue.toString()) {
    coElem.textContent = coValue;
    valueChanged = true;
  }

  if (pmElem.textContent !== pm25Value.toString()) {
    pmElem.textContent = pm25Value;
    valueChanged = true;
  }

  // Add glow effect to the entire card when any value changes
  if (valueChanged && sensorCard) {
    sensorCard.classList.add("sensor-card-glow");
    setTimeout(() => sensorCard.classList.remove("sensor-card-glow"), 800);
  }
}

// ================= STATUS LOGIC =================
function updateStatus(co, pm25, thresholds) {
  const statusElem = document.getElementById("status");
  const coThreshold = Number(thresholds?.co_ppm);
  const pm25Threshold = Number(thresholds?.pm25);

  if (!Number.isFinite(coThreshold) || !Number.isFinite(pm25Threshold)) {
    statusElem.textContent = "Thresholds unavailable";
    statusElem.className = "status-text status-warning";
    return;
  }

  if (co > coThreshold || pm25 > pm25Threshold) {
    statusElem.textContent = "ALERT: Smoke/Vape Detected!";
    statusElem.className = "status-text status-danger";
  } else {
    statusElem.textContent = "Air Quality Normal";
    statusElem.className = "status-text status-good";
  }
}

// ================= FETCH REAL SENSOR DATA =================
async function fetchSensorData() {
  try {
    const response = await fetch(`${BACKEND_URL}/latest-data`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
    const data = await response.json();

    if (data && data.co_ppm !== undefined && data.pm25 !== undefined) {
      updateSensorValues(data.co_ppm, data.pm25);
      updateStatus(data.co_ppm, data.pm25, data.thresholds);
      appendSensorGraphData(data.co_ppm, data.pm25);
    }

  } catch (error) {
    console.error("Error fetching sensor data:", error);
    document.getElementById("status").textContent = "⚠️ Backend connection error";
    document.getElementById("status").className = "status-text status-warning";
  }
}

// Auto-refresh every 1 second for faster updates
let sensorPollInterval = null;
function startSensorPolling() {
  if (sensorPollInterval) return;
  sensorPollInterval = setInterval(fetchSensorData, 1000);
}

function stopSensorPolling() {
  if (!sensorPollInterval) return;
  clearInterval(sensorPollInterval);
  sensorPollInterval = null;
}

// ================= CCTV VIDEO OR CANVAS ANIMATION =================
let cctvCanvas;
let cctvCtx;
let cctvAnimationFrame;
let cctvInterval = null;

function startCCTVRefresh() {
  // Check if video element exists (user wants to use a real video)
  const video = document.getElementById("cctv-video");
  const canvas = document.getElementById("cctv-canvas");
  const loader = document.getElementById("cctv-loader");
  const timestamp = document.getElementById("cctv-timestamp");
  
  // If video element exists and has a source, use video instead of canvas
  if (video && video.querySelector('source')?.src && video.querySelector('source').src !== "" && video.querySelector('source').src !== "YOUR_VIDEO_URL_HERE.mp4") {
    // Hide canvas and timestamp, show video
    if (canvas) canvas.style.display = "none";
    if (timestamp) timestamp.style.display = "none";
    if (loader) loader.style.display = "none";
    if (video) {
      video.style.display = "block";
      video.play().catch(e => console.log("Video autoplay failed:", e));
    }
    return;
  }
  
  // Otherwise, use canvas animation (default)
  if (!canvas) return;
  
  // Hide the loader and video, show canvas
  if (loader) loader.style.display = "none";
  if (video) video.style.display = "none";
  if (canvas) canvas.style.display = "block";
  if (timestamp) timestamp.style.display = "block";
  
  // Stop any existing animation
  if (cctvAnimationFrame) cancelAnimationFrame(cctvAnimationFrame);
  if (cctvInterval) clearInterval(cctvInterval);
  
  // Start the CCTV canvas animation
  startCCTVCanvasAnimation();
}

// CCTV Canvas Animation - Creates a realistic placeholder with moving noise, scanlines, and timestamp
function startCCTVCanvasAnimation() {
  cctvCanvas = document.getElementById("cctv-canvas");
  if (!cctvCanvas) return;
  
  cctvCtx = cctvCanvas.getContext("2d");
  
  const width = cctvCanvas.width;
  const height = cctvCanvas.height;
  
  // Create static noise pattern
  let noiseData = [];
  for (let i = 0; i < width * height * 4; i += 4) {
    noiseData.push(Math.random() * 255); // R
    noiseData.push(Math.random() * 255); // G
    noiseData.push(Math.random() * 255); // B
    noiseData.push(255); // A
  }
  
  let scanlineOffset = 0;
  let frameCount = 0;
  
  function drawCCTVFrame() {
    if (!cctvCtx) return;
    
    frameCount++;
    
    // Draw dark background
    cctvCtx.fillStyle = "#0a0a0a";
    cctvCtx.fillRect(0, 0, width, height);
    
    // Draw static noise (reduced opacity for more realistic look)
    const imageData = cctvCtx.createImageData(width, height);
    for (let i = 0; i < noiseData.length; i += 4) {
      // Vary the noise slightly each frame
      const variation = (Math.random() - 0.5) * 30;
      const baseVal = noiseData[i] + variation;
      imageData.data[i] = Math.min(255, Math.max(0, baseVal));     // R
      imageData.data[i + 1] = Math.min(255, Math.max(0, baseVal * 0.95)); // G (slightly green tint for night vision)
      imageData.data[i + 2] = Math.min(255, Math.max(0, baseVal * 0.8)); // B
      imageData.data[i + 3] = 255; // A
    }
    cctvCtx.putImageData(imageData, 0, 0);
    
    // Draw scanlines (horizontal lines)
    cctvCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let y = 0; y < height; y += 4) {
      cctvCtx.fillRect(0, y, width, 2);
    }
    
    // Draw moving scanline (bright line that moves down)
    scanlineOffset = (scanlineOffset + 2) % height;
    const gradient = cctvCtx.createLinearGradient(0, scanlineOffset - 30, 0, scanlineOffset + 30);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    cctvCtx.fillStyle = gradient;
    cctvCtx.fillRect(0, scanlineOffset - 30, width, 60);
    
    // Draw "NO SIGNAL" or "LIVE" text with effects
    cctvCtx.font = "bold 24px monospace";
    cctvCtx.textAlign = "center";
    
    // Text shadow/glow effect
    cctvCtx.shadowColor = "#00ff00";
    cctvCtx.shadowBlur = 10;
    cctvCtx.fillStyle = "#00ff00";
    cctvCtx.fillText("LIVE", width / 2, height / 2 - 20);
    
    // Camera label
    cctvCtx.font = "16px monospace";
    cctvCtx.fillText("CAMERA 1 - MONITORING", width / 2, height / 2 + 20);
    
    // Reset shadow
    cctvCtx.shadowBlur = 0;
    
    // Draw timestamp in corner
    const now = new Date();
    const timestamp = now.toLocaleString();
    cctvCtx.font = "14px monospace";
    cctvCtx.textAlign = "left";
    cctvCtx.fillStyle = "#00ff00";
    cctvCtx.fillText(timestamp, 10, height - 15);
    
    // DrawREC indicator (blinking)
    if (Math.floor(frameCount / 30) % 2 === 0) {
      cctvCtx.textAlign = "right";
      cctvCtx.fillStyle = "#ff0000";
      cctvCtx.fillText("● REC", width - 10, 25);
    }
    
    // Draw frame border (CCTV monitor frame)
    cctvCtx.strokeStyle = "#333";
    cctvCtx.lineWidth = 8;
    cctvCtx.strokeRect(0, 0, width, height);
    
    // Inner border
    cctvCtx.strokeStyle = "#1a1a1a";
    cctvCtx.lineWidth = 2;
    cctvCtx.strokeRect(4, 4, width - 8, height - 8);
    
    // Continue animation
    cctvAnimationFrame = requestAnimationFrame(drawCCTVFrame);
  }
  
  // Start the animation
  drawCCTVFrame();
  
  // Update timestamp display in HTML every second
  const timestampElem = document.getElementById("cctv-timestamp");
  if (timestampElem) {
    cctvInterval = setInterval(() => {
      const now = new Date();
      timestampElem.textContent = `LIVE - Camera 1 | ${now.toLocaleTimeString()}`;
    }, 1000);
  }
}

// Stop CCTV animation when logging out
function stopCCTVAnimation() {
  if (cctvAnimationFrame) {
    cancelAnimationFrame(cctvAnimationFrame);
    cctvAnimationFrame = null;
  }
  if (cctvInterval) {
    clearInterval(cctvInterval);
    cctvInterval = null;
  }
}

// ================= SENSOR GRAPH SETUP =================
let sensorChart;
let timestamps = [];
let coValues = [];
let pmValues = [];
let graphInitialized = false;
let initTimer = null;

async function startSensorGraph() {
  // If already initialized, don't reinitialize
  if (graphInitialized && sensorChart) {
    return;
  }
  
  console.log("Initializing sensor graph...");
  
  // Wait for Chart.js to be fully loaded before initializing
  if (window.chartJsReady) {
    await window.chartJsReady;
  }
  
  // Use requestAnimationFrame to ensure the canvas is properly rendered
  // This fixes the issue where Chart.js initializes before the canvas is visible
  requestAnimationFrame(() => {
    // Use setTimeout as a fallback to ensure DOM is ready
    setTimeout(initializeChart, 50);
  });
}

function initializeChart() {
  // Clear any existing initialization timer
  if (initTimer) {
    clearTimeout(initTimer);
    initTimer = null;
  }
  
  console.log("initializeChart called");
  
  try {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js not ready yet, retrying...");
      initTimer = setTimeout(initializeChart, 200);
      return;
    }

    const chartCanvas = document.getElementById("sensorChart");
    if (!chartCanvas) {
      console.error("Sensor chart canvas not found!");
      // Retry after a short delay if canvas not found
      initTimer = setTimeout(initializeChart, 200);
      return;
    }
    
    const ctx = chartCanvas.getContext("2d");
    if (!ctx) {
      console.error("Could not get 2d context for sensor chart");
      return;
    }
    
    // Check if canvas has proper dimensions
    // If canvas is hidden (display:none), it might have 0 width/height
    const rect = chartCanvas.getBoundingClientRect();
    console.log("Canvas bounding rect:", rect.width, "x", rect.height);
    
    if (rect.width === 0 || rect.height === 0) {
      console.warn("Canvas has no dimensions, retrying...");
      // Retry after a short delay
      initTimer = setTimeout(initializeChart, 200);
      return;
    }
    
    // Set explicit canvas dimensions to ensure proper rendering
    // This is crucial when canvas was initially hidden
    chartCanvas.width = rect.width;
    chartCanvas.height = rect.height;
    
    console.log("Chart data before init - timestamps:", timestamps.length, "coValues:", coValues.length, "pmValues:", pmValues.length);
    
    // Destroy existing chart if it exists
    if (sensorChart) {
      console.log("Destroying existing chart");
      sensorChart.destroy();
    }
    
    sensorChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: timestamps,
        datasets: [
          {
            label: "CO PPM",
            data: coValues,
            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            fill: true,
            tension: 0.3
          },
          {
            label: "PM2.5",
            data: pmValues,
            borderColor: "rgba(54, 162, 235, 1)",
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0 // Disable animation for real-time updates
        },
        scales: { 
          y: { 
            beginAtZero: true,
            title: {
              display: true,
              text: 'Value'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Time'
            }
          }
        }
      }
    });
    
    graphInitialized = true;
    console.log("Sensor graph initialized successfully!");
    console.log("Chart instance:", sensorChart);
  } catch (error) {
    console.error("Error initializing sensor graph:", error);
    // Retry on error with a delay
    initTimer = setTimeout(initializeChart, 500);
  }
}

function appendSensorGraphData(co, pm25) {
  try {
    // Convert to numbers in case they come as strings
    const coNum = parseFloat(co);
    const pm25Num = parseFloat(pm25);
    
    if (isNaN(coNum) || isNaN(pm25Num)) {
      console.warn("Invalid sensor data:", co, pm25);
      return;
    }
    
    const time = new Date().toLocaleTimeString();
    timestamps.push(time);
    coValues.push(coNum);
    pmValues.push(pm25Num);

    if (timestamps.length > 50) {
      timestamps.shift();
      coValues.shift();
      pmValues.shift();
    }

    if (sensorChart) {
      sensorChart.data.labels = timestamps;
      sensorChart.data.datasets[0].data = coValues;
      sensorChart.data.datasets[1].data = pmValues;
      sensorChart.update('none'); // 'none' mode for better performance
    } else {
      console.log("Sensor chart not initialized, creating it now...");
      startSensorGraph();
    }
  } catch (error) {
    console.error("Error updating sensor graph:", error);
  }
}
