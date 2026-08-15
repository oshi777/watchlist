// Trakt.tv Integration for Watchly
// API Documentation: https://trakt.docs.apiary.io/

const TRAKT_CONFIG = {
    // Users need to create their own Trakt API app at https://trakt.tv/oauth/applications
    // These are placeholder values - user must set their own in settings
    clientId: localStorage.getItem('traktClientId') || '',
    clientSecret: localStorage.getItem('traktClientSecret') || '',
    redirectUri: window.location.origin + '/settings.html'
};

const TRAKT_API_BASE = 'https://api.trakt.tv';

// ─── Storage Keys ────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
    accessToken: 'traktAccessToken',
    refreshToken: 'traktRefreshToken',
    expiresAt: 'traktExpiresAt',
    username: 'traktUsername',
    lastSync: 'traktLastSync',
    clientId: 'traktClientId',
    clientSecret: 'traktClientSecret'
};

// ─── Initialize Trakt ────────────────────────────────────────────────────────
function initTrakt() {
    // Check if user is already connected
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    if (accessToken) {
        // Check if token is expired
        const expiresAt = parseInt(localStorage.getItem(STORAGE_KEYS.expiresAt) || '0');
        if (Date.now() > expiresAt) {
            // Token expired, try to refresh
            refreshTraktToken();
        } else {
            showTraktConnected();
        }
    } else {
        // Check if we're returning from OAuth redirect
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            // Exchange code for access token
            exchangeCodeForToken(code);
        } else {
            showTraktNotConnected();
        }
    }
}

// ─── Show Connected State ────────────────────────────────────────────────────
function showTraktConnected() {
    document.getElementById('traktNotConnected').style.display = 'none';
    document.getElementById('traktConnected').style.display = 'block';
    
    const username = localStorage.getItem(STORAGE_KEYS.username) || 'Unknown';
    document.getElementById('traktUsername').textContent = username;
    
    const lastSync = localStorage.getItem(STORAGE_KEYS.lastSync);
    const lastSyncEl = document.getElementById('lastTraktSync');
    if (lastSync) {
        const syncDate = new Date(parseInt(lastSync));
        lastSyncEl.textContent = formatRelativeTime(syncDate);
    } else {
        lastSyncEl.textContent = 'Never';
    }
}

// ─── Show Not Connected State ────────────────────────────────────────────────
function showTraktNotConnected() {
    document.getElementById('traktNotConnected').style.display = 'block';
    document.getElementById('traktConnected').style.display = 'none';
}

// ─── Format Relative Time ────────────────────────────────────────────────────
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// ─── Connect Button Handler ──────────────────────────────────────────────────
async function connectTrakt() {
    // Check if user has set up API credentials
    const clientId = localStorage.getItem(STORAGE_KEYS.clientId);
    const clientSecret = localStorage.getItem(STORAGE_KEYS.clientSecret);
    
    if (!clientId || !clientSecret) {
        // Show instructions modal for setting up API app
        showTraktSetupModal();
        return;
    }
    
    // Generate random state for security
    const state = generateRandomString(32);
    localStorage.setItem('traktOAuthState', state);
    
    // Redirect to Trakt OAuth page
    const authUrl = `https://trakt.tv/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(TRAKT_CONFIG.redirectUri)}&` +
        `state=${encodeURIComponent(state)}`;
    
    window.location.href = authUrl;
}

// ─── Show Trakt Setup Modal ──────────────────────────────────────────────────
function showTraktSetupModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Set Up Trakt API</h2>
            <p style="color: var(--silver); margin-bottom: 20px;">
                To connect Trakt.tv, you need to create a free API application. Follow these steps:
            </p>
            
            <ol style="color: var(--silver); line-height: 1.8; margin-bottom: 25px;">
                <li>Go to <a href="https://trakt.tv/oauth/applications/new" target="_blank" style="color: var(--light);">Trakt API Applications</a></li>
                <li>Sign in or create a Trakt account</li>
                <li>Fill in the application form:
                    <ul style="margin: 8px 0;">
                        <li><strong>Name:</strong> Watchly</li>
                        <li><strong>Redirect URI:</strong> <code style="background: var(--muted); padding: 2px 6px; border-radius: 4px;">${TRAKT_CONFIG.redirectUri}</code></li>
                    </ul>
                </li>
                <li>After creating the app, copy the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                <li>Paste them below</li>
            </ol>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <input type="text" id="traktClientIdInput" placeholder="Client ID" 
                       style="width: 100%; padding: 12px; background: var(--surface); border: 1px solid var(--muted); border-radius: 8px; color: var(--light);">
                <input type="text" id="traktClientSecretInput" placeholder="Client Secret" 
                       style="width: 100%; padding: 12px; background: var(--surface); border: 1px solid var(--muted); border-radius: 8px; color: var(--light);">
                <button onclick="saveTraktCredentials()" class="add-btn" style="width: 100%; margin-top: 8px;">
                    Save & Connect
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ─── Save Trakt Credentials ──────────────────────────────────────────────────
window.saveTraktCredentials = function() {
    const clientId = document.getElementById('traktClientIdInput').value.trim();
    const clientSecret = document.getElementById('traktClientSecretInput').value.trim();
    
    if (!clientId || !clientSecret) {
        alert('Please enter both Client ID and Client Secret');
        return;
    }
    
    localStorage.setItem(STORAGE_KEYS.clientId, clientId);
    localStorage.setItem(STORAGE_KEYS.clientSecret, clientSecret);
    TRAKT_CONFIG.clientId = clientId;
    TRAKT_CONFIG.clientSecret = clientSecret;
    
    // Close modal
    document.querySelector('.modal').remove();
    
    // Now proceed with OAuth
    connectTrakt();
};

// ─── Exchange Authorization Code for Token ───────────────────────────────────
async function exchangeCodeForToken(code) {
    const clientId = localStorage.getItem(STORAGE_KEYS.clientId);
    const clientSecret = localStorage.getItem(STORAGE_KEYS.clientSecret);
    
    try {
        const response = await fetch('https://api.trakt.tv/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: TRAKT_CONFIG.redirectUri,
                grant_type: 'authorization_code'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to exchange code for token');
        }
        
        const data = await response.json();
        
        // Store tokens
        localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
        localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
        const expiresAt = Date.now() + (data.expires_in * 1000);
        localStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt.toString());
        
        // Get user info
        await getUserInfo();
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show connected state
        showTraktConnected();
        
        // Auto-sync
        syncTraktHistory();
        
    } catch (error) {
        console.error('Trakt OAuth error:', error);
        alert('Failed to connect to Trakt. Please try again.');
        showTraktNotConnected();
    }
}

// ─── Refresh Access Token ────────────────────────────────────────────────────
async function refreshTraktToken() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    const clientId = localStorage.getItem(STORAGE_KEYS.clientId);
    const clientSecret = localStorage.getItem(STORAGE_KEYS.clientSecret);
    
    if (!refreshToken) {
        showTraktNotConnected();
        return;
    }
    
    try {
        const response = await fetch('https://api.trakt.tv/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: TRAKT_CONFIG.redirectUri,
                grant_type: 'refresh_token'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        
        const data = await response.json();
        
        // Update stored tokens
        localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
        localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
        const expiresAt = Date.now() + (data.expires_in * 1000);
        localStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt.toString());
        
        showTraktConnected();
        
    } catch (error) {
        console.error('Failed to refresh Trakt token:', error);
        // Token refresh failed, user needs to reconnect
        disconnectTrakt();
    }
}

// ─── Get User Info ───────────────────────────────────────────────────────────
async function getUserInfo() {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const clientId = localStorage.getItem(STORAGE_KEYS.clientId);
    
    try {
        const response = await fetch(`${TRAKT_API_BASE}/users/settings`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'trakt-api-version': '2',
                'trakt-api-key': clientId
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get user info');
        }
        
        const data = await response.json();
        localStorage.setItem(STORAGE_KEYS.username, data.user.username);
        
    } catch (error) {
        console.error('Failed to get Trakt user info:', error);
    }
}

// ─── Sync Watch History ──────────────────────────────────────────────────────
async function syncTraktHistory() {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const clientId = localStorage.getItem(STORAGE_KEYS.clientId);
    
    if (!accessToken || !clientId) {
        alert('Please connect your Trakt account first');
        return;
    }
    
    try {
        // Show loading state
        const syncBtn = document.getElementById('syncTraktBtn');
        const originalText = syncBtn.textContent;
        syncBtn.textContent = 'Syncing...';
        syncBtn.disabled = true;
        
        // Fetch watched movies
        const moviesResponse = await fetch(`${TRAKT_API_BASE}/sync/watched/movies`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'trakt-api-version': '2',
                'trakt-api-key': clientId
            }
        });
        
        // Fetch watched shows
        const showsResponse = await fetch(`${TRAKT_API_BASE}/sync/watched/shows`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'trakt-api-version': '2',
                'trakt-api-key': clientId
            }
        });
        
        if (!moviesResponse.ok || !showsResponse.ok) {
            throw new Error('Failed to fetch watch history');
        }
        
        const movies = await moviesResponse.json();
        const shows = await showsResponse.json();
        
        // Import into Watchly
        let importedCount = 0;
        
        // Process movies
        for (const movie of movies) {
            const imported = await importTraktMovie(movie);
            if (imported) importedCount++;
        }
        
        // Process shows
        for (const show of shows) {
            const imported = await importTraktShow(show);
            if (imported) importedCount++;
        }
        
        // Update last sync time
        localStorage.setItem(STORAGE_KEYS.lastSync, Date.now().toString());
        
        // Restore button state
        syncBtn.textContent = originalText;
        syncBtn.disabled = false;
        
        // Refresh UI
        showTraktConnected();
        
        // Show success message
        alert(`Successfully synced ${importedCount} items from Trakt!`);
        
        // Reload watchlist if on home page
        if (typeof renderWatchlist === 'function') {
            if (typeof loadFromStorage === 'function') loadFromStorage();
            if (typeof updateStats === 'function') updateStats();
            renderWatchlist();
        }
        
    } catch (error) {
        console.error('Failed to sync Trakt history:', error);
        alert('Failed to sync with Trakt. Please try again.');
        
        // Restore button state
        const syncBtn = document.getElementById('syncTraktBtn');
        if (syncBtn) {
            syncBtn.textContent = 'Sync Now';
            syncBtn.disabled = false;
        }
    }
}

// ─── Import Trakt Movie ──────────────────────────────────────────────────────
async function importTraktMovie(traktMovie) {
    const movie = traktMovie.movie;
    
    // Check if already exists in watchlist
    if (typeof watchlistData !== 'undefined') {
        const exists = watchlistData.some(item => 
            item.title.toLowerCase() === movie.title.toLowerCase() && 
            item.year === movie.year.toString()
        );
        if (exists) return false;
    }
    
    // Get TMDB details for poster
    const tmdbData = await getTmdbDetailsFromTrakt(movie.ids.tmdb, 'movie');
    
    const newItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: movie.title,
        status: 'watched',
        genres: tmdbData?.genres || [],
        year: movie.year ? movie.year.toString() : '',
        date: traktMovie.last_watched_at ? new Date(traktMovie.last_watched_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        note: '',
        overview: tmdbData?.overview || '',
        poster: tmdbData?.poster || null,
        section: getSection(movie.title),
        isMovie: true,
        seasons: []
    };
    
    // Add to watchlist if available
    if (typeof watchlistData !== 'undefined') {
        watchlistData.push(newItem);
        if (typeof saveToStorage === 'function') saveToStorage();
    }
    
    return true;
}

// ─── Import Trakt Show ───────────────────────────────────────────────────────
async function importTraktShow(traktShow) {
    const show = traktShow.show;
    
    // Check if already exists in watchlist
    if (typeof watchlistData !== 'undefined') {
        const exists = watchlistData.some(item => 
            item.title.toLowerCase() === show.title.toLowerCase() && 
            item.year === show.year?.toString()
        );
        if (exists) return false;
    }
    
    // Get TMDB details for poster
    const tmdbData = await getTmdbDetailsFromTrakt(show.ids.tmdb, 'tv');
    
    const newItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: show.title,
        status: 'watched',
        genres: tmdbData?.genres || [],
        year: show.year ? show.year.toString() : '',
        date: traktShow.last_watched_at ? new Date(traktShow.last_watched_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        note: '',
        overview: tmdbData?.overview || '',
        poster: tmdbData?.poster || null,
        section: getSection(show.title),
        isMovie: false,
        seasons: traktShow.seasons.map(s => ({
            season: s.number,
            date: s.last_watched_at ? new Date(s.last_watched_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }))
    };
    
    // Add to watchlist if available
    if (typeof watchlistData !== 'undefined') {
        watchlistData.push(newItem);
        if (typeof saveToStorage === 'function') saveToStorage();
    }
    
    return true;
}

// ─── Get TMDB Details from Trakt ID ──────────────────────────────────────────
async function getTmdbDetailsFromTrakt(tmdbId, type) {
    if (!tmdbId) return null;
    
    const token = typeof getTmdbToken === 'function' ? getTmdbToken() : null;
    if (!token) return null;
    
    try {
        const endpoint = `https://api.themoviedb.org/3/${type}/${tmdbId}`;
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
        
        return {
            poster: data.poster_path ? TMDB_IMAGE_BASE + data.poster_path : null,
            overview: data.overview || '',
            genres: (data.genres || []).map(g => g.name)
        };
    } catch (error) {
        console.error('Failed to get TMDB details:', error);
        return null;
    }
}

// ─── Get Section Helper ──────────────────────────────────────────────────────
function getSection(title) {
    const firstChar = title.charAt(0).toUpperCase();
    if (firstChar >= 'A' && firstChar <= 'Z') {
        return firstChar;
    }
    return '0-9';
}

// ─── Disconnect Trakt ────────────────────────────────────────────────────────
function disconnectTrakt() {
    if (!confirm('Are you sure you want to disconnect your Trakt account?')) {
        return;
    }
    
    // Clear stored tokens and data
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.expiresAt);
    localStorage.removeItem(STORAGE_KEYS.username);
    localStorage.removeItem(STORAGE_KEYS.lastSync);
    localStorage.removeItem('traktOAuthState');
    
    // Show not connected state
    showTraktNotConnected();
}

// ─── Generate Random String ──────────────────────────────────────────────────
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ─── Setup Event Listeners ───────────────────────────────────────────────────
function setupTraktEventListeners() {
    const connectBtn = document.getElementById('connectTraktBtn');
    const syncBtn = document.getElementById('syncTraktBtn');
    const disconnectBtn = document.getElementById('disconnectTraktBtn');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', connectTrakt);
    }
    
    if (syncBtn) {
        syncBtn.addEventListener('click', syncTraktHistory);
    }
    
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectTrakt);
    }
}

// ─── Initialize on Page Load ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupTraktEventListeners();
        initTrakt();
    });
} else {
    setupTraktEventListeners();
    initTrakt();
}
