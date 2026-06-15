// AuraWeather Frontend Controller

// Global State
let currentWeatherData = null;
let currentUnit = 'C'; // 'C' or 'F'
let activeAnimation = null;
let trendChart = null;

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const geoBtn = document.getElementById('geo-btn');
const unitToggle = document.getElementById('unit-toggle');
const loader = document.getElementById('loader');
const errorCard = document.getElementById('error-card');
const errorMessage = document.getElementById('error-message');
const dashboard = document.getElementById('weather-dashboard');
const recentDropdown = document.getElementById('recent-cities-dropdown');
const recentList = document.getElementById('recent-cities-list');
const favoriteBtn = document.getElementById('favorite-toggle-btn');
const favoriteIcon = document.getElementById('favorite-icon');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeToggleIcon = document.getElementById('theme-toggle-icon');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    initTheme();
    setupEventListeners();
    loadSearchHistory();
    checkFavoriteStatus();
    
    // Default search on load: London
    fetchWeather('London');
});

// Setup Event Listeners
function setupEventListeners() {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            fetchWeather(query);
            recentDropdown.classList.add('hidden');
        }
    });

    searchInput.addEventListener('focus', () => {
        showRecentCities();
    });

    document.addEventListener('click', (e) => {
        if (!searchForm.contains(e.target) && !recentDropdown.contains(e.target)) {
            recentDropdown.classList.add('hidden');
        }
    });

    geoBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            showLoader();
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeatherByCoords(lat, lon);
                },
                (error) => {
                    hideLoader();
                    showError("Location access denied or unavailable.");
                }
            );
        } else {
            showError("Geolocation is not supported by your browser.");
        }
    });

    unitToggle.addEventListener('change', (e) => {
        currentUnit = e.target.checked ? 'F' : 'C';
        if (currentWeatherData) {
            updateUI(currentWeatherData);
        }
    });

    favoriteBtn.addEventListener('click', () => {
        toggleFavoriteCity();
    });

    themeToggleBtn.addEventListener('click', () => {
        toggleTheme();
    });
}

// --- Theme Switcher (Dark/Light) ---
function initTheme() {
    const savedTheme = localStorage.getItem('aura_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('theme-light');
        themeToggleIcon.setAttribute('data-lucide', 'sun');
    } else {
        document.body.classList.remove('theme-light');
        themeToggleIcon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem('aura_theme', isLight ? 'light' : 'dark');
    
    if (isLight) {
        themeToggleIcon.setAttribute('data-lucide', 'moon');
    } else {
        themeToggleIcon.setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
    
    // Redraw chart to reflect theme changes
    if (currentWeatherData) {
        renderTrendChart(currentWeatherData.forecast.slice(0, 8));
    }
    // Restart particles animation to get light/dark adjusted colors
    if (currentWeatherData) {
        startWeatherAnimation(currentWeatherData.current.condition);
    }
}

// Fetch Weather API
async function fetchWeather(city) {
    showLoader();
    try {
        const response = await fetch(`/api/weather?q=${encodeURIComponent(city)}`);
        const data = await response.json();
        
        if (data.success) {
            currentWeatherData = data;
            saveToHistory(data.current.city);
            updateUI(data);
            hideLoader();
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError("Failed to communicate with weather service.");
    }
}

async function fetchWeatherByCoords(lat, lon) {
    showLoader();
    try {
        const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        
        if (data.success) {
            currentWeatherData = data;
            saveToHistory(data.current.city);
            updateUI(data);
            hideLoader();
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError("Failed to communicate with weather service.");
    }
}

// Loader & Error Handling
function showLoader() {
    loader.classList.remove('hidden');
    errorCard.classList.add('hidden');
    dashboard.classList.add('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function showError(msg) {
    loader.classList.add('hidden');
    dashboard.classList.add('hidden');
    errorMessage.textContent = msg;
    errorCard.classList.remove('hidden');
}

// Temperature Unit Converter
function formatTemp(celsiusVal) {
    if (celsiusVal === null || celsiusVal === undefined) return '--';
    if (currentUnit === 'F') {
        return Math.round((celsiusVal * 9) / 5 + 32);
    }
    return Math.round(celsiusVal);
}

// Convert wind direction degrees to Compass Card Direction
function degToCompass(num) {
    const val = Math.floor((num / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
}

// Update DOM UI elements
function updateUI(data) {
    const curr = data.current;
    
    // Set theme class on body
    document.body.className = '';
    document.body.classList.add(`theme-${curr.condition}`);
    
    // Setup background particles
    startWeatherAnimation(curr.condition);

    // Main weather card
    document.getElementById('city-name').textContent = curr.city;
    document.getElementById('country-code').textContent = curr.country;
    document.getElementById('local-time').textContent = formatLocalTime(curr.dt, curr.timezone);
    document.getElementById('current-temp').textContent = formatTemp(curr.temp);
    document.getElementById('current-temp-unit').textContent = `°${currentUnit}`;
    document.getElementById('weather-description').textContent = curr.description;
    
    document.getElementById('temp-min').textContent = formatTemp(curr.temp_min);
    document.getElementById('temp-max').textContent = formatTemp(curr.temp_max);

    // Weather icon setup
    const iconContainer = document.getElementById('condition-icon-container');
    iconContainer.innerHTML = '';
    const iconEl = document.createElement('i');
    iconEl.setAttribute('id', 'main-weather-icon');
    iconEl.setAttribute('class', 'main-weather-icon');
    
    const iconMap = {
        'sunny': 'sun',
        'night': 'moon',
        'rainy': 'cloud-rain',
        'snowy': 'snowflake',
        'stormy': 'cloud-lightning',
        'cloudy': 'cloud'
    };
    iconEl.setAttribute('data-lucide', iconMap[curr.condition] || 'cloud-sun');
    iconContainer.appendChild(iconEl);

    // Metrics grid
    document.getElementById('feels-like-val').textContent = formatTemp(curr.feels_like);
    const feelsDiff = Math.abs(curr.temp - curr.feels_like);
    document.getElementById('feels-like-desc').textContent = 
        feelsDiff < 1.5 ? "Similar to actual temp" : 
        (curr.feels_like > curr.temp ? "Feels warmer than actual temp" : "Feels cooler than actual temp");

    document.getElementById('humidity-val').textContent = curr.humidity;
    document.getElementById('humidity-progress').style.width = `${curr.humidity}%`;
    document.getElementById('humidity-desc').textContent = 
        curr.humidity < 40 ? "Dry air condition" : 
        (curr.humidity < 70 ? "Comfortable range" : "High humidity, damp air");

    document.getElementById('wind-speed-val').textContent = curr.wind_speed.toFixed(1);
    document.getElementById('wind-unit-label').textContent = 'm/s';
    
    const compassArrow = document.getElementById('compass-arrow');
    compassArrow.style.transform = `rotate(${curr.wind_deg}deg)`;
    document.getElementById('wind-desc').textContent = `Wind from ${degToCompass(curr.wind_deg)}`;

    document.getElementById('pressure-val').textContent = curr.pressure;
    document.getElementById('pressure-desc').textContent = 
        curr.pressure < 1010 ? "Low pressure system" : 
        (curr.pressure > 1020 ? "High pressure system" : "Normal barometric state");

    document.getElementById('sunrise-val').textContent = formatTimeUnix(curr.sunrise, curr.timezone);
    document.getElementById('sunset-val').textContent = formatTimeUnix(curr.sunset, curr.timezone);

    // Check favorite star icon state
    checkFavoriteStatus();

    // Render 5 Day Forecast List
    renderFiveDayForecast(data.forecast, curr.timezone);

    // Render Trend Chart
    renderTrendChart(data.forecast.slice(0, 8)); // Next 24 hours (8 periods of 3 hours)

    // Render lucide icons
    lucide.createIcons();

    // Show dashboard
    dashboard.classList.remove('hidden');
}

// Render the 5-day rows
function renderFiveDayForecast(forecast, timezone) {
    const container = document.getElementById('five-day-list');
    container.innerHTML = '';

    // Group items by day of the week
    const dailyData = {};
    forecast.forEach(item => {
        // Formulate day name relative to local timezone
        const date = new Date((item.dt) * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        
        if (!dailyData[dayName]) {
            dailyData[dayName] = [];
        }
        dailyData[dayName].push(item);
    });

    const dayKeys = Object.keys(dailyData).slice(0, 5);
    
    dayKeys.forEach(day => {
        const temps = dailyData[day].map(i => i.temp);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        
        // Find most frequent condition of the day
        const conditions = dailyData[day].map(i => i.condition);
        const modeCondition = conditions.sort((a,b) =>
            conditions.filter(v => v===a).length - conditions.filter(v => v===b).length
        ).pop();

        const desc = dailyData[day][0].description;
        const iconCode = dailyData[day][0].icon;

        const row = document.createElement('div');
        row.className = 'forecast-day-row';

        const iconMap = {
            'sunny': 'sun',
            'night': 'moon',
            'rainy': 'cloud-rain',
            'snowy': 'snowflake',
            'stormy': 'cloud-lightning',
            'cloudy': 'cloud'
        };
        const iconName = iconMap[modeCondition] || 'cloud-sun';

        row.innerHTML = `
            <span class="day-name">${day}</span>
            <div class="day-condition">
                <i data-lucide="${iconName}"></i>
                <span>${desc}</span>
            </div>
            <div class="day-temp-range">
                <span class="min-t">${formatTemp(minTemp)}°</span>
                <div class="temp-slider-bar">
                    <div class="temp-slider-fill" style="left: 20%; width: 60%;"></div>
                </div>
                <span class="max-t">${formatTemp(maxTemp)}°</span>
            </div>
        `;
        container.appendChild(row);
    });
}

// Trend Chart Render (Chart.js)
function renderTrendChart(forecastSegment) {
    const ctx = document.getElementById('tempTrendChart').getContext('2d');
    
    const labels = forecastSegment.map(item => {
        const date = new Date(item.dt * 1000);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    });
    
    const temps = forecastSegment.map(item => formatTemp(item.temp));

    if (trendChart) {
        trendChart.destroy();
    }

    const isLight = document.body.classList.contains('theme-light');
    const textColor = isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)';
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    const tooltipBg = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)';
    const tooltipBorder = isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    // Gradient fill setup
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#ff9800';
    
    gradient.addColorStop(0, accentHex + '33'); // Accent with opacity
    gradient.addColorStop(1, accentHex + '00'); // Transparent

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature',
                data: temps,
                borderColor: accentHex,
                borderWidth: 3,
                pointBackgroundColor: accentHex,
                pointBorderColor: isLight ? '#ffffff' : '#1e293b',
                pointHoverRadius: 6,
                pointRadius: 4,
                fill: true,
                backgroundColor: gradient,
                tension: 0.4 // Curve smoothing
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: isLight ? '#0f172a' : '#ffffff',
                    bodyColor: isLight ? '#0f172a' : '#ffffff',
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    titleFont: { family: 'Inter', size: 12 },
                    bodyFont: { family: 'Inter', size: 14, weight: 'bold' },
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.parsed.y}°${currentUnit}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor,
                        font: { family: 'Inter', size: 11 }
                    }
                },
                y: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: { family: 'Inter', size: 11 },
                        callback: function(value) {
                            return value + '°';
                        }
                    }
                }
            }
        }
    });
}

// Helpers for Datetimes
function formatLocalTime(dt, offsetSeconds) {
    const localTimeMs = (dt + offsetSeconds) * 1000;
    const date = new Date(localTimeMs);
    // Print day of week and time
    const day = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${day}, ${hours}:${minutes}`;
}

function formatTimeUnix(unix, offsetSeconds) {
    const localTimeMs = (unix + offsetSeconds) * 1000;
    const date = new Date(localTimeMs);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// --- Recent Search History and Favorites ---

function loadSearchHistory() {
    const history = JSON.parse(localStorage.getItem('aura_history') || '[]');
    recentList.innerHTML = '';
    
    if (history.length === 0) {
        recentList.innerHTML = '<div class="recent-city-item"><span class="metric-sub">No recent searches</span></div>';
        return;
    }

    history.forEach(city => {
        const item = document.createElement('div');
        item.className = 'recent-city-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'recent-city-item-name';
        nameSpan.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> ${city}`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'recent-city-item-delete';
        deleteBtn.innerHTML = '<i data-lucide="x"></i>';
        
        nameSpan.addEventListener('click', () => {
            fetchWeather(city);
            searchInput.value = city;
            recentDropdown.classList.add('hidden');
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeHistoryItem(city);
        });

        item.appendChild(nameSpan);
        item.appendChild(deleteBtn);
        recentList.appendChild(item);
    });
    lucide.createIcons();
}

function saveToHistory(city) {
    let history = JSON.parse(localStorage.getItem('aura_history') || '[]');
    history = history.filter(item => item.toLowerCase() !== city.toLowerCase());
    history.unshift(city);
    history = history.slice(0, 5); // Keep last 5 searches
    localStorage.setItem('aura_history', JSON.stringify(history));
    loadSearchHistory();
}

function removeHistoryItem(city) {
    let history = JSON.parse(localStorage.getItem('aura_history') || '[]');
    history = history.filter(item => item.toLowerCase() !== city.toLowerCase());
    localStorage.setItem('aura_history', JSON.stringify(history));
    loadSearchHistory();
}

function showRecentCities() {
    loadSearchHistory();
    recentDropdown.classList.remove('hidden');
}

// Favorite City Logic
function checkFavoriteStatus() {
    if (!currentWeatherData) return;
    const favorites = JSON.parse(localStorage.getItem('aura_favorites') || '[]');
    const isFav = favorites.includes(currentWeatherData.current.city.toLowerCase());
    
    if (isFav) {
        favoriteBtn.classList.add('active');
        favoriteIcon.setAttribute('fill', '#eab308');
    } else {
        favoriteBtn.classList.remove('active');
        favoriteIcon.removeAttribute('fill');
    }
}

function toggleFavoriteCity() {
    if (!currentWeatherData) return;
    const city = currentWeatherData.current.city.toLowerCase();
    let favorites = JSON.parse(localStorage.getItem('aura_favorites') || '[]');
    
    if (favorites.includes(city)) {
        favorites = favorites.filter(item => item !== city);
    } else {
        favorites.push(city);
    }
    
    localStorage.setItem('aura_favorites', JSON.stringify(favorites));
    checkFavoriteStatus();
}

// --- Dynamic Weather Canvas Background Animations ---

let canvas, ctx;
let particles = [];
let animFrameId = null;

function initCanvas() {
    canvas = document.getElementById('weather-bg');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}

function startWeatherAnimation(condition) {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
    }
    particles = [];
    
    if (condition === 'sunny') {
        setupSunnyAnimation();
    } else if (condition === 'rainy' || condition === 'stormy') {
        setupRainyAnimation(condition === 'stormy');
    } else if (condition === 'snowy') {
        setupSnowyAnimation();
    } else if (condition === 'cloudy') {
        setupCloudyAnimation();
    } else if (condition === 'night') {
        setupNightAnimation();
    }
}

// Sunny / Solar Flare particles
function setupSunnyAnimation() {
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 80 + 40,
            opacity: Math.random() * 0.1 + 0.05,
            speedX: (Math.random() - 0.5) * 0.2,
            speedY: (Math.random() - 0.5) * 0.2
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Solar rays emanating from top right
        const gradient = ctx.createRadialGradient(
            canvas.width * 0.9, 0, 50,
            canvas.width * 0.9, 0, 500
        );
        gradient.addColorStop(0, 'rgba(255, 152, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 152, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;

            if (p.x < -p.radius) p.x = canvas.width + p.radius;
            if (p.x > canvas.width + p.radius) p.x = -p.radius;
            if (p.y < -p.radius) p.y = canvas.height + p.radius;
            if (p.y > canvas.height + p.radius) p.y = -p.radius;

            ctx.beginPath();
            const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            radGrad.addColorStop(0, `rgba(255, 193, 7, ${p.opacity})`);
            radGrad.addColorStop(1, 'rgba(255, 193, 7, 0)');
            ctx.fillStyle = radGrad;
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        animFrameId = requestAnimationFrame(animate);
    }
    animate();
}

// Rainy and Stormy Animation
function setupRainyAnimation(isStorm) {
    const dropCount = isStorm ? 120 : 70;
    for (let i = 0; i < dropCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            length: Math.random() * 20 + 10,
            speed: Math.random() * 10 + 12,
            opacity: Math.random() * 0.3 + 0.1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isLight = document.body.classList.contains('theme-light');
        ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(174, 217, 224, 0.4)';
        ctx.lineWidth = 1;

        particles.forEach(p => {
            p.y += p.speed;
            p.x += 1; // subtle wind drift

            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
                p.speed = Math.random() * 10 + 12;
            }

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 1, p.y + p.length);
            ctx.stroke();
        });

        animFrameId = requestAnimationFrame(animate);
    }
    animate();
}

// Snowy Animation
function setupSnowyAnimation() {
    const flakeCount = 60;
    for (let i = 0; i < flakeCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 3 + 1,
            density: Math.random() * 1,
            opacity: Math.random() * 0.6 + 0.2
        });
    }

    let angle = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isLight = document.body.classList.contains('theme-light');
        angle += 0.01;

        particles.forEach(p => {
            // Drift logic
            p.y += Math.cos(angle + p.density) + 1 + p.radius / 2;
            p.x += Math.sin(angle) * 0.8;

            if (p.y > canvas.height) {
                p.y = -10;
                p.x = Math.random() * canvas.width;
            }
            if (p.x > canvas.width) {
                p.x = 0;
            } else if (p.x < 0) {
                p.x = canvas.width;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = isLight ? `rgba(8, 145, 178, ${p.opacity})` : `rgba(255, 255, 255, ${p.opacity})`;
            ctx.fill();
        });

        animFrameId = requestAnimationFrame(animate);
    }
    animate();
}

// Cloudy / Foggy drifting cloud sheets
function setupCloudyAnimation() {
    const cloudCount = 6;
    for (let i = 0; i < cloudCount; i++) {
        particles.push({
            x: Math.random() * canvas.width - 200,
            y: Math.random() * canvas.height * 0.6,
            radius: Math.random() * 120 + 80,
            speed: Math.random() * 0.2 + 0.05,
            opacity: Math.random() * 0.08 + 0.03
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isLight = document.body.classList.contains('theme-light');

        particles.forEach(p => {
            p.x += p.speed;

            if (p.x > canvas.width + p.radius) {
                p.x = -p.radius * 2;
                p.y = Math.random() * canvas.height * 0.6;
            }

            ctx.beginPath();
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            const cloudColor = isLight ? '203, 213, 225' : '148, 163, 184';
            grad.addColorStop(0, `rgba(${cloudColor}, ${p.opacity})`);
            grad.addColorStop(1, `rgba(${cloudColor}, 0)`);
            ctx.fillStyle = grad;
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        animFrameId = requestAnimationFrame(animate);
    }
    animate();
}

// Night Starry sky animation
function setupNightAnimation() {
    const starCount = 100;
    for (let i = 0; i < starCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.2 + 0.4,
            opacity: Math.random(),
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            growing: Math.random() > 0.5
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isLight = document.body.classList.contains('theme-light');

        particles.forEach(p => {
            // Twinkle brightness
            if (p.growing) {
                p.opacity += p.twinkleSpeed;
                if (p.opacity >= 0.95) p.growing = false;
            } else {
                p.opacity -= p.twinkleSpeed;
                if (p.opacity <= 0.1) p.growing = true;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = isLight ? `rgba(79, 70, 229, ${p.opacity})` : `rgba(255, 255, 255, ${p.opacity})`;
            ctx.fill();
        });

        animFrameId = requestAnimationFrame(animate);
    }
    animate();
}
