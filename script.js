const watchlistData = [];

let filteredData = [];
let currentSection = 'all';
let currentEditingItem = null;
let currentSeasonIndex = null;

// Load data from localStorage on startup
function loadFromStorage() {
    const saved = localStorage.getItem('watchlistData');
    if (saved) {
        const savedData = JSON.parse(saved);
        watchlistData.splice(0, watchlistData.length, ...savedData);
        filteredData = [...watchlistData];
    }
}

// Save data to localStorage
function saveToStorage() {
    localStorage.setItem('watchlistData', JSON.stringify(watchlistData));
    markDataChanged();
}

function markDataChanged() {
    localStorage.setItem('dataChanged', 'true');
}

function checkAutoBackup() {
    const apiKey = localStorage.getItem('jsonbinApiKey');
    const dataChanged = localStorage.getItem('dataChanged');
    const lastBackup = localStorage.getItem('lastAutoBackup');
    
    if (!apiKey || !dataChanged) return;
    
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (!lastBackup || (now - parseInt(lastBackup)) > dayInMs) {
        performAutoBackup(apiKey);
    }
}

function performAutoBackup(apiKey) {
    const exportData = {
        watchlistData: watchlistData,
        rankings: JSON.parse(localStorage.getItem('watchlistRankings') || '[]'),
        timestamp: new Date().toISOString()
    };
    
    fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey
        },
        body: JSON.stringify(exportData)
    }).then(response => {
        if (response.ok) {
            localStorage.setItem('lastAutoBackup', Date.now());
            localStorage.removeItem('dataChanged');
            console.log('Auto backup completed');
        }
    }).catch(err => console.log('Auto backup failed'));
}

function initializeApp() {
    // Only clear localStorage if no data exists (first time)
    if (!localStorage.getItem('watchlistData')) {
        localStorage.removeItem('watchlistData');
    } else {
        loadFromStorage();
    }
    filteredData = [...watchlistData];
    populateGenreFilter();
    updateStats();
    renderWatchlist();
    setupEventListeners();
    checkAutoBackup();
}

function populateGenreFilter() {
    const genreSet = new Set();
    watchlistData.forEach(item => {
        item.genres.forEach(genre => genreSet.add(genre));
    });
    
    const genreFilter = document.getElementById('genreFilter');
    genreFilter.innerHTML = '<option value="all">All Genres</option>';
    Array.from(genreSet).sort().forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
}

function updateStats() {
    const total = watchlistData.length;
    const watched = watchlistData.filter(item => item.status === 'watched').length;
    const upcoming = watchlistData.filter(item => item.status === 'upcoming').length;
    
    document.getElementById('totalCount').textContent = total;
    document.getElementById('watchedCount').textContent = watched;
    document.getElementById('upcomingCount').textContent = upcoming;
}

function renderWatchlist() {
    const container = document.getElementById('watchlist');
    container.innerHTML = '';
    
    if (filteredData.length === 0) {
        container.innerHTML = '<div class="no-results">No items found matching your criteria.</div>';
        return;
    }
    
    const groupedData = groupBySection(filteredData);
    
    Object.keys(groupedData).sort().forEach(section => {
        if (currentSection !== 'all' && section !== currentSection) return;
        
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'section';
        
        const header = document.createElement('div');
        header.className = 'section-header';
        header.textContent = section;
        sectionDiv.appendChild(header);
        
        const grid = document.createElement('div');
        grid.className = 'items-grid';
        
        sortItemsByDate(groupedData[section]).forEach(item => {
            const itemDiv = createItemElement(item);
            grid.appendChild(itemDiv);
        });
        
        sectionDiv.appendChild(grid);
        container.appendChild(sectionDiv);
    });
}

function groupBySection(data) {
    return data.reduce((groups, item) => {
        const section = item.section;
        if (!groups[section]) groups[section] = [];
        groups[section].push(item);
        return groups;
    }, {});
}

function sortItemsByDate(items) {
    return items.sort((a, b) => {
        // Status priority: watched -> pending -> upcoming
        const statusOrder = { 'watched': 0, 'pending': 1, 'upcoming': 2 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        
        // Within watched items, sort by date (earliest first)
        if (a.status === 'watched' && b.status === 'watched') {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            return dateA - dateB;
        }
        
        return 0;
    });
}

function createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'item';
    
    const statusIcon = getStatusIcon(item.status);
    const horrorTag = '';
    const index = watchlistData.indexOf(item);
    
    const seasonHtml = item.seasons && item.seasons.length > 0 
        ? `<div class="season-info"><strong>${item.isMovie ? 'Movies:' : 'Seasons:'}</strong><br>${item.seasons.map((s, i) => `<span class="season-item" onclick="editSeason(${index}, ${i})">${item.isMovie ? (s.season ? `M${s.season}` : 'Movie') : `S${s.season}`} (${s.date})</span>`).reduce((acc, curr, idx) => {
            if (idx > 0 && idx % 2 === 0) acc += '<br>';
            return acc + (idx > 0 && idx % 2 !== 0 ? ', ' : '') + curr;
        }, '')}</div>` 
        : '';
    
    const ratingHtml = item.rating ? `<div class="rating">${item.rating}</div>` : '';
    
    div.innerHTML = `
        <div class="item-title">
            <span class="item-status">${statusIcon}</span>
            ${item.title}
            ${horrorTag}
        </div>
        <div class="item-details">
            ${item.date ? `${item.date}` : ''}
            ${item.year ? ` (${item.year})` : ''}
        </div>
        ${ratingHtml}
        ${item.note ? `<div class="item-note">${item.note}</div>` : ''}
        <div class="item-genres">
            ${item.genres.sort().map(genre => `<span class="genre-tag">${genre}</span>`).join('')}
        </div>
        ${seasonHtml}
        <div class="item-actions">
            <button class="action-btn ${item.status === 'watched' ? 'watched' : ''}" onclick="toggleWatchStatus(${index})">
                ${item.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
            </button>
            <button class="action-btn" onclick="addSeason(${index})">${item.isMovie ? 'Add Movie' : 'Add Season'}</button>
            <button class="action-btn" onclick="editItem(${index})">Edit</button>
            <button class="action-btn" onclick="deleteItem(${index})">Delete</button>
        </div>
    `;
    
    return div;
}

function getStatusIcon(status) {
    switch (status) {
        case 'watched': return '✓';
        case 'upcoming': return '→';
        default: return '○';
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const genreFilter = document.getElementById('genreFilter').value;
    
    filteredData = watchlistData.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm) ||
                            item.genres.some(genre => genre.toLowerCase().includes(searchTerm));
        
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        
        const matchesGenre = genreFilter === 'all' || item.genres.includes(genreFilter);
        
        const matchesSection = true;
        
        return matchesSearch && matchesStatus && matchesGenre && matchesSection;
    });
    
    renderWatchlist();
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('genreFilter').addEventListener('change', applyFilters);
    
    // Add show modal
    document.getElementById('addShowBtn').addEventListener('click', () => {
        resetAddForm();
        document.getElementById('addModal').style.display = 'block';
    });
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
            resetAddForm();
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            resetAddForm();
        }
    });
    
    // Add form submission
    document.getElementById('addForm').addEventListener('submit', handleAddShow);
    
    // Season update confirmation
    document.getElementById('confirmSeason').addEventListener('click', handleSeasonUpdate);
    
    // Delete confirmation
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
    document.getElementById('cancelDelete').addEventListener('click', cancelDelete);
    
    // Reset functionality
    document.getElementById('resetBtn').addEventListener('click', showResetModal);
    document.getElementById('confirmReset').addEventListener('click', confirmReset);
    document.getElementById('cancelReset').addEventListener('click', cancelReset);
    
    // Watch status confirmation
    document.getElementById('confirmWatchStatus').addEventListener('click', confirmWatchStatus);
    document.getElementById('cancelWatchStatus').addEventListener('click', cancelWatchStatus);
    
    // Export functionality
    document.getElementById('exportBtn').addEventListener('click', function() {
        const exportData = {
            watchlistData: watchlistData,
            rankings: JSON.parse(localStorage.getItem('watchlistRankings') || '[]')
        };
        const data = JSON.stringify(exportData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'watchlist-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Import functionality
    document.getElementById('importBtn').addEventListener('click', function() {
        document.getElementById('importFile').click();
    });
    
    document.getElementById('importFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (confirm('This will replace your current watchlist and rankings. Continue?')) {
                        // Handle old format (just array) or new format (object with watchlistData and rankings)
                        if (Array.isArray(importedData)) {
                            watchlistData.length = 0;
                            watchlistData.push(...importedData);
                        } else {
                            watchlistData.length = 0;
                            watchlistData.push(...(importedData.watchlistData || []));
                            localStorage.setItem('watchlistRankings', JSON.stringify(importedData.rankings || []));
                        }
                        saveToStorage();
                        populateGenreFilter();
                        updateStats();
                        applyFilters();
                    }
                } catch (error) {
                    alert('Invalid file format. Please select a valid JSON file.');
                }
            };
            reader.readAsText(file);
        }
    });
}

function handleAddShow(e) {
    e.preventDefault();
    
    const form = e.target;
    const editIndex = form.dataset.editIndex;
    
    const title = document.getElementById('newTitle').value;
    const status = document.getElementById('newStatus').value;
    const genres = document.getElementById('newGenres').value.split(',').map(g => g.trim());
    const date = document.getElementById('newDate').value;
    const year = document.getElementById('newYear').value;
    const note = document.getElementById('newNote').value;
    const isMovie = document.getElementById('isMovie').checked;
    
    const section = title.charAt(0).toUpperCase();
    const sectionKey = /[0-9]/.test(section) ? '0-9' : section;
    
    const itemData = {
        title,
        status,
        genres: genres.sort(),
        section: sectionKey,
        isMovie,
        seasons: []
    };
    
    if (note) itemData.note = note;
    if (year) itemData.year = year;
    
    if (date) {
        itemData.date = new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    if (editIndex !== undefined) {
        // Edit existing item
        const existingItem = watchlistData[parseInt(editIndex)];
        itemData.seasons = existingItem.seasons || [];
        itemData.rating = existingItem.rating || undefined;
        watchlistData[parseInt(editIndex)] = itemData;
    } else {
        // Add new item
        watchlistData.push(itemData);
    }
    
    saveToStorage();
    
    // Reset form and close modal
    document.getElementById('addForm').reset();
    document.getElementById('addModal').style.display = 'none';
    resetAddForm();
    
    // Refresh display
    populateGenreFilter();
    updateStats();
    applyFilters();
}

let itemToToggle = null;

function toggleWatchStatus(index) {
    const item = watchlistData[index];
    
    if (item.status === 'watched') {
        // Show confirmation only when unmarking as watched
        itemToToggle = index;
        document.getElementById('watchStatusMessage').textContent = `Are you sure you want to mark "${item.title}" as unwatched?`;
        document.getElementById('watchStatusModal').style.display = 'block';
    } else {
        // Mark as watched immediately without confirmation
        item.status = 'watched';
        item.date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        saveToStorage();
        updateStats();
        applyFilters();
    }
}

function confirmWatchStatus() {
    if (itemToToggle !== null) {
        const item = watchlistData[itemToToggle];
        if (item.status === 'watched') {
            item.status = 'pending';
            delete item.date;
        } else {
            item.status = 'watched';
            item.date = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        saveToStorage();
        updateStats();
        applyFilters();
        itemToToggle = null;
    }
    document.getElementById('watchStatusModal').style.display = 'none';
}

function cancelWatchStatus() {
    itemToToggle = null;
    document.getElementById('watchStatusModal').style.display = 'none';
}

function showConfirmation(message) {
    const msgEl = document.getElementById('confirmationMsg');
    msgEl.textContent = message;
    msgEl.classList.add('show');
    setTimeout(() => msgEl.classList.remove('show'), 3000);
}

function addSeason(index) {
    currentEditingItem = index;
    currentSeasonIndex = null;
    const item = watchlistData[index];
    const isMovie = item.isMovie;
    document.getElementById('seasonTitle').textContent = `Add ${isMovie ? 'movie' : 'season'} for: ${item.title}`;
    document.getElementById('seasonNumber').value = '';
    document.getElementById('seasonDate').value = '';
    document.querySelector('#seasonModal h2').textContent = isMovie ? 'Add Movie Completion' : 'Add Season Completion';
    document.getElementById('confirmSeason').textContent = isMovie ? 'Add Movie' : 'Add Season';
    document.getElementById('seasonNumber').placeholder = isMovie ? 'Movie Number' : 'Season Number';
    document.getElementById('seasonNumber').required = !isMovie;
    document.getElementById('seasonModal').style.display = 'block';
}

function editSeason(itemIndex, seasonIndex) {
    currentEditingItem = itemIndex;
    currentSeasonIndex = seasonIndex;
    const item = watchlistData[itemIndex];
    const season = item.seasons[seasonIndex];
    
    const isMovie = item.isMovie;
    document.getElementById('seasonTitle').textContent = `Edit ${isMovie ? 'movie' : 'season'} for: ${item.title}`;
    document.getElementById('seasonNumber').value = season.season || '';
    document.getElementById('seasonDate').value = new Date(season.date).toISOString().split('T')[0];
    document.querySelector('#seasonModal h2').textContent = isMovie ? 'Edit Movie' : 'Edit Season';
    document.getElementById('confirmSeason').textContent = isMovie ? 'Update Movie' : 'Update Season';
    document.getElementById('seasonNumber').placeholder = isMovie ? 'Movie Number' : 'Season Number';
    document.getElementById('seasonNumber').required = !isMovie;
    document.getElementById('seasonModal').style.display = 'block';
}

function handleSeasonUpdate() {
    const seasonNumber = document.getElementById('seasonNumber').value;
    const seasonDate = document.getElementById('seasonDate').value;
    
    if (!seasonNumber || !seasonDate || currentEditingItem === null) return;
    
    const item = watchlistData[currentEditingItem];
    if (!item.seasons) item.seasons = [];
    
    const formattedDate = new Date(seasonDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    if (currentSeasonIndex !== null) {
        // Edit existing season
        const seasonData = { date: formattedDate };
        if (seasonNumber) seasonData.season = parseInt(seasonNumber);
        item.seasons[currentSeasonIndex] = seasonData;
    } else {
        // Add new season
        const seasonData = { date: formattedDate };
        if (seasonNumber) seasonData.season = parseInt(seasonNumber);
        item.seasons.push(seasonData);
    }
    
    item.seasons.sort((a, b) => a.season - b.season);
    
    saveToStorage();
    
    document.getElementById('seasonModal').style.display = 'none';
    currentEditingItem = null;
    currentSeasonIndex = null;
    
    applyFilters();
}

let itemToDelete = null;

function deleteItem(index) {
    itemToDelete = index;
    const item = watchlistData[index];
    document.getElementById('deleteMessage').textContent = `Are you sure you want to delete "${item.title}"?`;
    document.getElementById('deleteModal').style.display = 'block';
}

function confirmDelete() {
    if (itemToDelete !== null) {
        watchlistData.splice(itemToDelete, 1);
        saveToStorage();
        updateStats();
        applyFilters();
        itemToDelete = null;
    }
    document.getElementById('deleteModal').style.display = 'none';
}

function cancelDelete() {
    itemToDelete = null;
    document.getElementById('deleteModal').style.display = 'none';
}

function showResetModal() {
    document.getElementById('resetModal').style.display = 'block';
}

function confirmReset() {
    watchlistData.length = 0;
    saveToStorage();
    populateGenreFilter();
    updateStats();
    applyFilters();
    document.getElementById('resetModal').style.display = 'none';
}

function cancelReset() {
    document.getElementById('resetModal').style.display = 'none';
}

function editItem(index) {
    const item = watchlistData[index];
    
    // Pre-fill the form with current data
    document.getElementById('newTitle').value = item.title;
    document.getElementById('newStatus').value = item.status;
    document.getElementById('newGenres').value = item.genres.join(', ');
    document.getElementById('newNote').value = item.note || '';
    
    // Pre-fill date if item is watched
    if (item.date && item.status === 'watched') {
        const dateParts = item.date.split(' ');
        if (dateParts.length >= 3) {
            const month = dateParts[0];
            const day = dateParts[1].replace(',', '');
            const year = dateParts[2];
            const monthNum = new Date(Date.parse(month + ' 1, 2000')).getMonth() + 1;
            const formattedDate = `${year}-${monthNum.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
            document.getElementById('newDate').value = formattedDate;
        } else {
            document.getElementById('newDate').value = '';
        }
    } else {
        document.getElementById('newDate').value = '';
    }
    
    // Pre-fill year and movie toggle
    document.getElementById('newYear').value = item.year || '';
    document.getElementById('isMovie').checked = item.isMovie || false;
    
    // Change form behavior to edit mode
    const form = document.getElementById('addForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Item';
    
    // Store edit index
    form.dataset.editIndex = index;
    
    document.getElementById('addModal').style.display = 'block';
    document.querySelector('.modal h2').textContent = 'Edit Show/Movie';
}

function resetAddForm() {
    const form = document.getElementById('addForm');
    delete form.dataset.editIndex;
    form.querySelector('button[type="submit"]').textContent = 'Add to Watchlist';
    document.querySelector('.modal h2').textContent = 'Add New Show/Movie';
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', initializeApp);
