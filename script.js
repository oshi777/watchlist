const watchlistData = [];

let filteredData = [];
let currentSection = 'all';
let currentEditingItem = null;
let currentSeasonIndex = null;

function loadFromStorage() {
    const saved = localStorage.getItem('watchlistData');
    if (saved) {
        try {
            const savedData = JSON.parse(saved);
            savedData.forEach((item, index) => {
                if (!item.id) item.id = 'item_' + Date.now() + '_' + index;
            });
            watchlistData.splice(0, watchlistData.length, ...savedData);
            filteredData = [...watchlistData];
        } catch (e) {
            console.error('Failed to load data');
            localStorage.removeItem('watchlistData');
        }
    }
}

function saveToStorage() {
    localStorage.setItem('watchlistData', JSON.stringify(watchlistData));
    markDataChanged();
}

function markDataChanged() {
    localStorage.setItem('dataChanged', 'true');
}

function checkAutoBackup() {
    const githubToken = localStorage.getItem('githubToken');
    const dataChanged = localStorage.getItem('dataChanged');
    const lastBackup = localStorage.getItem('lastAutoBackup');
    
    if (!githubToken || dataChanged !== 'true') return;
    
    const now = Date.now();
    const oneMinute = 60 * 1000;
    const lastBackupTime = parseInt(lastBackup, 10);
    
    if (!lastBackup || isNaN(lastBackupTime) || (now - lastBackupTime) > oneMinute) {
        performAutoBackup(githubToken);
    }
}

function performAutoBackup(githubToken) {
    const rankingIds = JSON.parse(localStorage.getItem('watchlistRankings') || '[]');
    const rankingsWithNames = rankingIds.map(id => {
        const item = watchlistData.find(w => w.id === id);
        return { id: id, title: item ? item.title : 'Unknown' };
    });
    
    const exportData = {
        watchlistData: watchlistData,
        rankings: rankingsWithNames,
        timestamp: new Date().toISOString()
    };
    
    const gistId = localStorage.getItem('watchlyGistId');
    
    if (gistId) {
        const updateData = {
            files: {
                'watchly-backup.json': {
                    content: JSON.stringify(exportData, null, 2)
                }
            }
        };
        
        fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        }).then(response => {
            if (response.ok) {
                localStorage.setItem('lastAutoBackup', Date.now());
                localStorage.removeItem('dataChanged');
            } else {
                console.error('Backup failed:', response.status);
            }
        }).catch(err => console.error('Backup error:', err));
    } else {
        const gistData = {
            description: 'Watchly Backup - Access at gist.github.com',
            public: false,
            files: {
                'watchly-backup.json': {
                    content: JSON.stringify(exportData, null, 2)
                }
            }
        };
        
        fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gistData)
        }).then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to create gist');
            }
        }).then(data => {
            localStorage.setItem('watchlyGistId', data.id);
            localStorage.setItem('watchlyGistUrl', data.html_url);
            localStorage.setItem('lastAutoBackup', Date.now());
            localStorage.removeItem('dataChanged');
        }).catch(err => console.error('Backup error:', err));
    }
}

function initializeApp() {
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
    const counts = watchlistData.reduce((acc, item) => {
        acc.total++;
        if (item.status === 'watched') acc.watched++;
        if (item.status === 'upcoming') acc.upcoming++;
        return acc;
    }, {total: 0, watched: 0, upcoming: 0});
    
    document.getElementById('totalCount').textContent = counts.total;
    document.getElementById('watchedCount').textContent = counts.watched;
    document.getElementById('upcomingCount').textContent = counts.upcoming;
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
        
        sortItemsByDate(groupedData[section]).forEach((item, idx) => {
            const itemDiv = createItemElement(item, watchlistData.indexOf(item));
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
        const statusOrder = { 'watched': 0, 'pending': 1, 'upcoming': 2 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        
        if (a.status === 'watched' && b.status === 'watched') {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            return dateA - dateB;
        }
        
        return 0;
    });
}

function createItemElement(item, index) {
    const div = document.createElement('div');
    div.className = 'item';
    
    const statusIcon = getStatusIcon(item.status);
    const itemIndex = index !== undefined ? index : watchlistData.indexOf(item);
    
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    const seasonHtml = item.seasons && item.seasons.length > 0 
        ? `<div class="season-info"><strong>${item.isMovie ? 'Movies:' : 'Seasons:'}</strong><br>${item.seasons.map((s, i) => `<span class="season-item" onclick="editSeason(${itemIndex}, ${i})">${item.isMovie ? (s.season ? `M${s.season}` : 'Movie') : `S${s.season}`} (${escapeHtml(s.date)})</span>`).reduce((acc, curr, idx) => {
            if (idx > 0 && idx % 2 === 0) acc += '<br>';
            return acc + (idx > 0 && idx % 2 !== 0 ? ', ' : '') + curr;
        }, '')}</div>` 
        : '';
    
    const ratingHtml = item.rating ? `<div class="rating">${escapeHtml(item.rating)}</div>` : '';
    
    div.innerHTML = `
        <div class="item-title">
            <span class="item-status">${statusIcon}</span>
            ${escapeHtml(item.title)}
        </div>
        <div class="item-details">
            ${item.date ? `${escapeHtml(item.date)}` : ''}
            ${item.year ? ` (${escapeHtml(item.year)})` : ''}
        </div>
        ${ratingHtml}
        ${item.note ? `<div class="item-note">${escapeHtml(item.note)}</div>` : ''}
        <div class="item-genres">
            ${item.genres.sort().map(genre => `<span class="genre-tag">${escapeHtml(genre)}</span>`).join('')}
        </div>
        ${seasonHtml}
        <div class="item-actions">
            <button class="action-btn ${item.status === 'watched' ? 'watched' : ''}" onclick="toggleWatchStatus(${itemIndex})">
                ${item.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
            </button>
            <button class="action-btn" onclick="addSeason(${itemIndex})">${item.isMovie ? 'Add Movie' : 'Add Season'}</button>
            <button class="action-btn" onclick="editItem(${itemIndex})">Edit</button>
            <button class="action-btn" onclick="deleteItem(${itemIndex})">Delete</button>
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
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().replace(/\s+/g, '');
    const statusFilter = document.getElementById('statusFilter').value;
    const genreFilter = document.getElementById('genreFilter').value;
    
    filteredData = watchlistData.filter(item => {
        const titleNoSpaces = item.title.toLowerCase().replace(/\s+/g, '');
        const matchesSearch = titleNoSpaces.includes(searchTerm) ||
                            item.genres.some(genre => genre.toLowerCase().replace(/\s+/g, '').includes(searchTerm));
        
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        
        const matchesGenre = genreFilter === 'all' || item.genres.includes(genreFilter);
        
        return matchesSearch && matchesStatus && matchesGenre;
    });
    
    renderWatchlist();
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('genreFilter').addEventListener('change', applyFilters);
    
    document.getElementById('addShowBtn').addEventListener('click', () => {
        resetAddForm();
        document.getElementById('addModal').style.display = 'block';
    });
    
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
            resetAddForm();
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            resetAddForm();
        }
    });
    
    document.getElementById('addForm').addEventListener('submit', handleAddShow);
    document.getElementById('confirmSeason').addEventListener('click', handleSeasonUpdate);
    document.getElementById('deleteSeason').addEventListener('click', function() {
        if (currentEditingItem !== null && currentSeasonIndex !== null) {
            const item = watchlistData[currentEditingItem];
            if (confirm(`Delete ${item.isMovie ? 'movie' : 'season'} ${item.seasons[currentSeasonIndex].season || ''} from ${item.title}?`)) {
                item.seasons.splice(currentSeasonIndex, 1);
                saveToStorage();
                document.getElementById('seasonModal').style.display = 'none';
                currentEditingItem = null;
                currentSeasonIndex = null;
                applyFilters();
            }
        }
    });
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
    document.getElementById('cancelDelete').addEventListener('click', cancelDelete);
    document.getElementById('resetBtn').addEventListener('click', showResetModal);
    document.getElementById('confirmReset').addEventListener('click', confirmReset);
    document.getElementById('cancelReset').addEventListener('click', cancelReset);
    document.getElementById('confirmWatchStatus').addEventListener('click', confirmWatchStatus);
    document.getElementById('cancelWatchStatus').addEventListener('click', cancelWatchStatus);
    
    document.getElementById('exportBtn').addEventListener('click', function() {
        const rankingIds = JSON.parse(localStorage.getItem('watchlistRankings') || '[]');
        const rankingsWithNames = rankingIds.map(id => {
            const item = watchlistData.find(w => w.id === id);
            return { id: id, title: item ? item.title : 'Unknown' };
        });
        
        const exportData = {
            watchlistData: watchlistData,
            rankings: rankingsWithNames,
            timestamp: new Date().toISOString()
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
                        if (Array.isArray(importedData)) {
                            watchlistData.length = 0;
                            watchlistData.push(...importedData);
                            watchlistData.forEach((item, index) => {
                                if (!item.id) item.id = 'item_' + Date.now() + '_' + index;
                            });
                        } else {
                            watchlistData.length = 0;
                            const items = importedData.watchlistData || [];
                            items.forEach((item, index) => {
                                if (!item.id) item.id = 'item_' + Date.now() + '_' + index;
                            });
                            watchlistData.push(...items);
                            
                            let rankings = importedData.rankings || [];
                            let rankingIds = [];
                            
                            if (rankings.length > 0) {
                                if (typeof rankings[0] === 'string') {
                                    rankingIds = rankings;
                                } else if (rankings[0].id && rankings[0].title) {
                                    rankingIds = rankings.map(r => r.id);
                                } else if (rankings[0].title) {
                                    rankingIds = rankings.map(rankItem => {
                                        const found = watchlistData.find(w => w.title === rankItem.title);
                                        return found ? found.id : null;
                                    }).filter(id => id !== null);
                                }
                            }
                            
                            localStorage.setItem('watchlistRankings', JSON.stringify(rankingIds));
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
    const genres = document.getElementById('newGenres').value.split(',').map(g => g.trim()).filter(g => g.length > 0);
    const date = document.getElementById('newDate').value;
    const year = document.getElementById('newYear').value;
    const note = document.getElementById('newNote').value;
    const isMovie = document.getElementById('isMovie').checked;
    
    const section = title.charAt(0).toUpperCase();
    const sectionKey = /[0-9]/.test(section) ? '0-9' : section;
    
    const itemData = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
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
        const existingItem = watchlistData[parseInt(editIndex)];
        if (existingItem && Object.prototype.hasOwnProperty.call(watchlistData, editIndex)) {
            itemData.id = existingItem.id;
            itemData.seasons = existingItem.seasons || [];
            itemData.rating = existingItem.rating || undefined;
            watchlistData[parseInt(editIndex)] = itemData;
        }
    } else {
        watchlistData.push(itemData);
    }
    
    saveToStorage();
    
    document.getElementById('addForm').reset();
    document.getElementById('addModal').style.display = 'none';
    resetAddForm();
    
    populateGenreFilter();
    updateStats();
    applyFilters();
}

let itemToToggle = null;

function toggleWatchStatus(index) {
    const item = watchlistData[index];
    
    if (item.status === 'watched') {
        itemToToggle = index;
        document.getElementById('watchStatusMessage').textContent = `Are you sure you want to mark "${item.title}" as unwatched?`;
        document.getElementById('watchStatusModal').style.display = 'block';
    } else {
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
        item.status = 'pending';
        delete item.date;
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
    document.getElementById('deleteSeason').style.display = 'none';
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
    document.getElementById('deleteSeason').style.display = 'block';
    document.getElementById('seasonModal').style.display = 'block';
}

function handleSeasonUpdate() {
    const seasonNumber = document.getElementById('seasonNumber').value;
    const seasonDate = document.getElementById('seasonDate').value;
    
    if (!seasonDate || currentEditingItem === null) return;
    if (!seasonNumber && !watchlistData[currentEditingItem].isMovie) return;
    
    const item = watchlistData[currentEditingItem];
    if (!item.seasons) item.seasons = [];
    
    const formattedDate = new Date(seasonDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    if (currentSeasonIndex !== null) {
        const seasonData = { date: formattedDate };
        if (seasonNumber) seasonData.season = parseInt(seasonNumber);
        item.seasons[currentSeasonIndex] = seasonData;
    } else {
        const seasonData = { date: formattedDate };
        if (seasonNumber) seasonData.season = parseInt(seasonNumber);
        item.seasons.push(seasonData);
    }
    
    item.seasons.sort((a, b) => (a.season || 0) - (b.season || 0));
    
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
    localStorage.removeItem('watchlistRankings');
    localStorage.removeItem('watchlyGistId');
    localStorage.removeItem('watchlyGistUrl');
    localStorage.removeItem('lastAutoBackup');
    localStorage.removeItem('dataChanged');
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
    
    document.getElementById('newTitle').value = item.title;
    document.getElementById('newStatus').value = item.status;
    document.getElementById('newGenres').value = item.genres.join(', ');
    document.getElementById('newNote').value = item.note || '';
    
    if (item.date && item.status === 'watched') {
        const dateParts = item.date.split(' ');
        if (dateParts.length >= 3) {
            const monthMap = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
            const month = dateParts[0];
            const day = dateParts[1].replace(',', '');
            const year = dateParts[2];
            const monthNum = monthMap[month] || 1;
            const formattedDate = `${year}-${monthNum.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
            document.getElementById('newDate').value = formattedDate;
        } else {
            document.getElementById('newDate').value = '';
        }
    } else {
        document.getElementById('newDate').value = '';
    }
    
    document.getElementById('newYear').value = item.year || '';
    document.getElementById('isMovie').checked = item.isMovie || false;
    
    const form = document.getElementById('addForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Item';
    
    form.dataset.editIndex = index;
    
    document.getElementById('addModal').style.display = 'block';
    document.querySelector('#addModal h2').textContent = 'Edit Show/Movie';
}

function resetAddForm() {
    const form = document.getElementById('addForm');
    delete form.dataset.editIndex;
    form.querySelector('button[type="submit"]').textContent = 'Add to Watchlist';
    document.querySelector('#addModal h2').textContent = 'Add New Show/Movie';
}

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setInterval(checkAutoBackup, 10000);
});
