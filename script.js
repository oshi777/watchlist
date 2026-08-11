const watchlistData = [];

let filteredData = [];
let currentSection = 'all';
let currentEditingItem = null;
let currentSeasonIndex = null;

const escapeHtml = (text) => {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
};

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

// ─── TMDB Integration ────────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2M2IxMTllZTk3M2U3MjkwYzM0MDYxNmI5Y2QxNzg5NSIsIm5iZiI6MTc0OTk1NDQ3Ni44MTcsInN1YiI6IjY4NGUyZmFjNGEzZTQ0Y2Y2ODI5NGM2OSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.J0w9eSTX8VZLmPrmwlWFJxl7HE9FntXVu8VDaCdcV4w';

function getTmdbToken() {
    return TMDB_TOKEN;
}

let tmdbSearchTimer = null;

function setupTmdbSearch() {
    const titleInput = document.getElementById('newTitle');
    const dropdown = document.getElementById('tmdbDropdown');

    titleInput.addEventListener('input', function () {
        clearTimeout(tmdbSearchTimer);
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';

        const query = this.value.trim();
        if (!getTmdbToken() || query.length < 2) return;

        // Read value fresh inside the timeout — avoids stale closure when typing fast
        tmdbSearchTimer = setTimeout(() => {
            const currentQuery = titleInput.value.trim();
            if (currentQuery.length >= 2) {
                searchTmdb(currentQuery);
            }
        }, 400);
    });

    // Also trigger on keyup to catch cases input event misses (e.g. browser autofill, IME)
    titleInput.addEventListener('keyup', function (e) {
        // Skip modifier-only keys
        const skip = ['Shift','Control','Alt','Meta','CapsLock','Tab','Escape',
                      'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
        if (skip.includes(e.key)) return;

        const query = this.value.trim();
        if (!getTmdbToken() || query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        // Only re-trigger if the dropdown is currently empty but there's a valid query
        if (dropdown.style.display === 'none' || dropdown.innerHTML === '') {
            clearTimeout(tmdbSearchTimer);
            tmdbSearchTimer = setTimeout(() => {
                const currentQuery = titleInput.value.trim();
                if (currentQuery.length >= 2) {
                    searchTmdb(currentQuery);
                }
            }, 400);
        }
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.tmdb-search-wrapper')) {
            dropdown.style.display = 'none';
        }
    });
}

function searchTmdb(query) {
    const token = getTmdbToken();
    // Always use multi search to show both movies and TV shows in dropdown
    const endpoint = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&page=1`;

    fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
        const results = (data.results || [])
            .filter(r => r.media_type !== 'person')
            .slice(0, 6);
        showTmdbDropdown(results);
    })
    .catch(() => {}); // silently fail — user can still type manually
}

function showTmdbDropdown(results) {
    const dropdown = document.getElementById('tmdbDropdown');
    dropdown.innerHTML = '';

    if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'tmdb-no-results';
        noResults.textContent = 'No results found';
        dropdown.appendChild(noResults);
        dropdown.style.display = 'block';
        return;
    }

    results.forEach(result => {
        const title = result.title || result.name || '';
        const year = (result.release_date || result.first_air_date || '').slice(0, 4);
        const poster = result.poster_path ? TMDB_IMAGE_BASE + result.poster_path : null;
        const type = result.media_type === 'movie' || result.title ? 'movie' : 'tv';

        const item = document.createElement('div');
        item.className = 'tmdb-result-item';
        item.innerHTML = `
            ${poster ? `<img src="${poster}" alt="" class="tmdb-thumb">` : '<div class="tmdb-thumb tmdb-no-poster">?</div>'}
            <div class="tmdb-result-info">
                <span class="tmdb-result-title">${escapeHtml(title)}</span>
                <span class="tmdb-result-year">${year} · ${type === 'movie' ? 'Movie' : 'TV'}</span>
            </div>`;
        item.addEventListener('click', () => applyTmdbResult(result, type));
        dropdown.appendChild(item);
    });

    // Browse all link at the bottom
    const browseAll = document.createElement('a');
    browseAll.className = 'tmdb-browse-all';
    const query = document.getElementById('newTitle').value.trim();
    browseAll.href = `search.html${query ? '?q=' + encodeURIComponent(query) : ''}`;
    browseAll.innerHTML = `<span>Browse all results on TMDB &rarr;</span>`;
    dropdown.appendChild(browseAll);

    // Add TMDB attribution at bottom of dropdown
    const attribution = document.createElement('div');
    attribution.className = 'tmdb-attribution-dropdown';
    attribution.innerHTML = 'Movie & TV data provided by <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">TMDB</a>';
    dropdown.appendChild(attribution);

    dropdown.style.display = 'block';
}

function applyTmdbResult(result, type) {
    const token = getTmdbToken();
    const id = result.id;
    const endpoint = type === 'movie'
        ? `https://api.themoviedb.org/3/movie/${id}`
        : `https://api.themoviedb.org/3/tv/${id}`;

    fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(details => {
        const title = details.title || details.name || '';
        const year = (details.release_date || details.first_air_date || '').slice(0, 4);
        const overview = details.overview || '';
        const genres = (details.genres || []).map(g => g.name);
        const poster = details.poster_path ? TMDB_IMAGE_BASE + details.poster_path : null;
        const isMovie = type === 'movie';

        document.getElementById('newTitle').value = title;
        document.getElementById('newGenres').value = genres.join(', ');
        if (year) document.getElementById('newYear').value = year;
        // Do NOT fill note — store overview separately
        document.getElementById('isMovie').checked = isMovie;

        // Store poster and overview for saving (not in note field)
        document.getElementById('newTitle').dataset.tmdbPoster = poster || '';
        document.getElementById('newTitle').dataset.tmdbOverview = overview;

        document.getElementById('tmdbDropdown').style.display = 'none';
    })
    .catch(() => {});
}

function markDataChanged() {
    localStorage.setItem('dataChanged', 'true');
    scheduleBackup();
}

// Debounced backup — fires 3s after the last change
let backupTimer = null;
function scheduleBackup() {
    const githubToken = localStorage.getItem('githubToken');
    if (!githubToken) return;
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => {
        performAutoBackup(githubToken);
    }, 3000);
}

function checkAutoBackup() {
    const githubToken = localStorage.getItem('githubToken');
    const dataChanged = localStorage.getItem('dataChanged');
    
    // Fallback: if data is still marked changed and no backup is pending, trigger one
    if (!githubToken || dataChanged !== 'true') return;
    if (!backupTimer) {
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
    renderCurrentlyWatching();
    setupEventListeners();
    setupTmdbSearch();
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
    
    const groupingMode = localStorage.getItem('listGroupingMode') || 'with-separators';
    
    if (groupingMode === 'continuous') {
        // Continuous list without section headers
        const grid = document.createElement('div');
        grid.className = 'items-grid';
        
        // Sort all items alphabetically but without grouping
        const sortedData = filteredData.sort((a, b) => {
            // Sort by section first (0-9, then A-Z), then by title
            if (a.section !== b.section) {
                if (a.section === '0-9') return -1;
                if (b.section === '0-9') return 1;
                return a.section.localeCompare(b.section);
            }
            return a.title.localeCompare(b.title);
        });
        
        sortedData.forEach((item, idx) => {
            if (currentSection !== 'all' && item.section !== currentSection) return;
            const itemDiv = createItemElement(item, watchlistData.indexOf(item));
            grid.appendChild(itemDiv);
        });
        
        container.appendChild(grid);
    } else {
        // Original grouped display with section headers
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
    const itemIndex = index !== undefined ? index : watchlistData.indexOf(item);
    const statusClass = item.status === 'watched' ? 'watched' : 
                       item.status === 'upcoming' ? 'upcoming' : 
                       item.status === 'currently-watching' ? 'currently-watching' : 'pending';
    const statusLabel = item.status === 'watched' ? 'Watched' : 
                       item.status === 'upcoming' ? 'Upcoming' : 
                       item.status === 'currently-watching' ? 'Currently Watching' : 'To Watch';

    const footerHtml = `
        <div class="item-poster-footer">
            <div class="item-poster-title">${escapeHtml(item.title)}</div>
            <div class="item-poster-meta">
                <span class="item-poster-status ${statusClass}">${statusLabel}</span>
                ${item.year ? `<span>${escapeHtml(item.year)}</span>` : ''}
            </div>
        </div>`;

    if (item.poster) {
        div.className = 'item has-poster';
        div.innerHTML = `
            <img src="${item.poster}" alt="${escapeHtml(item.title)}" class="item-poster-bg" loading="lazy">
            ${footerHtml}`;
    } else {
        div.className = 'item no-poster';
        const letter = item.title.charAt(0).toUpperCase();
        div.innerHTML = `
            <div class="item-poster-placeholder">
                <div class="item-poster-placeholder-letter">${escapeHtml(letter)}</div>
            </div>
            ${footerHtml}`;
    }

    div.addEventListener('click', () => openDetailModal(itemIndex));
    return div;
}

function openDetailModal(index) {
    const item = watchlistData[index];
    if (!item) return;

    const statusClass = item.status === 'watched' ? 'watched' : 
                       item.status === 'upcoming' ? 'upcoming' : 
                       item.status === 'currently-watching' ? 'currently-watching' : 'pending';
    const statusLabel = item.status === 'watched' ? 'Watched' : 
                       item.status === 'upcoming' ? 'Upcoming' : 
                       item.status === 'currently-watching' ? 'Currently Watching' : 'To Watch';

    // poster / placeholder
    const img = document.getElementById('detailPosterImg');
    const placeholder = document.getElementById('detailPosterPlaceholder');
    if (item.poster) {
        img.src = item.poster;
        img.alt = item.title;
        img.style.display = 'block';
        placeholder.style.display = 'none';
        // Apply poster display mode from settings
        const mode = localStorage.getItem('posterDisplayMode') || 'cover';
        img.style.objectFit = mode;
        img.style.objectPosition = mode === 'cover' ? 'center top' : 'center';
    } else {
        img.style.display = 'none';
        placeholder.style.display = 'flex';
        document.getElementById('detailPosterLetter').textContent = item.title.charAt(0).toUpperCase();
    }

    // status & type
    const badge = document.getElementById('detailStatusBadge');
    badge.textContent = statusLabel;
    badge.className = `item-poster-status ${statusClass}`;
    document.getElementById('detailTypeBadge').textContent = item.isMovie ? 'Movie' : 'TV Show';

    // title & meta
    document.getElementById('detailTitle').textContent = item.title;
    const metaParts = [];
    if (item.date) metaParts.push(item.date);
    if (item.year) metaParts.push(`Release: ${item.year}`);
    document.getElementById('detailMeta').textContent = metaParts.join(' · ');

    // overview
    const overviewEl = document.getElementById('detailOverview');
    overviewEl.textContent = item.overview || '';
    overviewEl.style.display = item.overview ? 'block' : 'none';

    // note
    const noteEl = document.getElementById('detailNote');
    noteEl.textContent = item.note || '';
    noteEl.style.display = item.note ? 'block' : 'none';

    // genres
    const genresEl = document.getElementById('detailGenres');
    genresEl.innerHTML = item.genres.sort().map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('');

    // seasons
    const seasonsEl = document.getElementById('detailSeasons');
    if (item.seasons && item.seasons.length > 0) {
        seasonsEl.innerHTML = `<strong>${item.isMovie ? 'Movies:' : 'Seasons:'}</strong> ` +
            item.seasons.map((s, i) =>
                `<span class="season-item" onclick="editSeason(${index}, ${i}); document.getElementById('detailModal').style.display='none';">${item.isMovie ? (s.season ? `M${s.season}` : 'Movie') : `S${s.season}`} (${escapeHtml(s.date)})</span>`
            ).join(', ');
        seasonsEl.style.display = 'block';
    } else {
        seasonsEl.style.display = 'none';
    }

    // actions
    document.getElementById('detailActions').innerHTML = `
        <button class="action-btn ${item.status === 'watched' ? 'watched' : ''}" id="toggleWatchBtn">
            ${item.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
        </button>
        <button class="action-btn" id="addSeasonBtn">
            ${item.isMovie ? 'Add Movie' : 'Add Season'}
        </button>
        <button class="action-btn" id="editItemBtn">
            Edit
        </button>
        <button class="action-btn" id="deleteItemBtn">
            Delete
        </button>`;

    // Add direct event listeners to avoid conflicts
    document.getElementById('toggleWatchBtn').onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleWatchStatus(index);
    };
    
    document.getElementById('addSeasonBtn').onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        addSeason(index);
        document.getElementById('detailModal').style.display = 'none';
    };
    
    document.getElementById('editItemBtn').onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        editItem(index);
        document.getElementById('detailModal').style.display = 'none';
    };
    
    document.getElementById('deleteItemBtn').onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        deleteItem(index);
        document.getElementById('detailModal').style.display = 'none';
    };

    document.getElementById('detailModal').style.display = 'block';
}

function refreshDetailModal(index) {
    // Re-open with updated data after a status toggle
    setTimeout(() => {
        if (document.getElementById('detailModal').style.display === 'block') {
            openDetailModal(index);
        }
    }, 100); // Increased timeout to ensure data is properly updated
}

function getStatusIcon(status) {
    switch (status) {
        case 'watched': return '✓';
        case 'upcoming': return '·';
        default: return '·';
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

    // Date type toggles
    document.querySelectorAll('input[name="newDateType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const isYear = this.value === 'year';
            document.getElementById('newDate').style.display = isYear ? 'none' : '';
            document.getElementById('newDateYear').style.display = isYear ? '' : 'none';
        });
    });
    document.querySelectorAll('input[name="seasonDateType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const isYear = this.value === 'year';
            document.getElementById('seasonDate').style.display = isYear ? 'none' : '';
            document.getElementById('seasonDateYear').style.display = isYear ? '' : 'none';
        });
    });
    
    document.getElementById('addShowBtn').addEventListener('click', () => {
        resetAddForm();
        document.getElementById('addModal').style.display = 'block';
    });
    
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.style.display = 'none';
            
            // Only reset add form for the add modal
            if (modal.id === 'addModal') {
                resetAddForm();
            }
            
            // Clear watch status modal state
            if (modal.id === 'watchStatusModal') {
                itemToToggle = null;
            }
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            
            // Only reset add form for the add modal
            if (e.target.id === 'addModal') {
                resetAddForm();
            }
            
            // Clear watch status modal state
            if (e.target.id === 'watchStatusModal') {
                itemToToggle = null;
            }
        }
        if (e.target.id === 'detailModal') {
            e.target.style.display = 'none';
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

    document.getElementById('detailClose').addEventListener('click', () => {
        document.getElementById('detailModal').style.display = 'none';
    });
    
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
    const dateType = document.querySelector('input[name="newDateType"]:checked').value;
    const date = dateType === 'year'
        ? document.getElementById('newDateYear').value
        : document.getElementById('newDate').value;
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
    
    // Handle currently watching status
    if (status === 'currently-watching') {
        itemData.currentlyWatching = true;
        if (!isMovie) {
            itemData.currentEpisode = 1;
            itemData.currentSeason = 1;
        }
    }
    
    if (note) itemData.note = note;
    if (year) itemData.year = year;

    // Save TMDB poster if fetched
    const posterUrl = document.getElementById('newTitle').dataset.tmdbPoster || '';
    if (posterUrl) itemData.poster = posterUrl;
    const tmdbOverview = document.getElementById('newTitle').dataset.tmdbOverview || '';
    if (tmdbOverview) itemData.overview = tmdbOverview;
    
    if (date) {
        if (dateType === 'year') {
            itemData.date = date; // just the year string e.g. "2023"
        } else {
            itemData.date = new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
    
    if (editIndex !== undefined) {
        const existingItem = watchlistData[parseInt(editIndex)];
        if (existingItem && Object.prototype.hasOwnProperty.call(watchlistData, editIndex)) {
            itemData.id = existingItem.id;
            itemData.seasons = existingItem.seasons || [];
            itemData.rating = existingItem.rating || undefined;
            // Keep existing poster if no new one was selected from TMDB
            if (!itemData.poster && existingItem.poster) itemData.poster = existingItem.poster;
            // Keep existing overview if no new one was fetched
            if (!itemData.overview && existingItem.overview) itemData.overview = existingItem.overview;
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
        // Store the index for the confirmation workflow
        itemToToggle = index;
        document.getElementById('watchStatusMessage').textContent = `Are you sure you want to mark "${item.title}" as unwatched?`;
        document.getElementById('watchStatusModal').style.display = 'block';
    } else {
        // Mark as watched immediately
        item.status = 'watched';
        item.date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        // Auto-remove from currently watching if it was there
        if (item.currentlyWatching) {
            item.currentlyWatching = false;
        }
        saveToStorage();
        renderCurrentlyWatching();
        renderWatchlist();
        updateStats();
        applyFilters();
        
        // Refresh the detail modal to show updated status
        refreshDetailModal(index);
    }
}

function confirmWatchStatus() {
    if (itemToToggle !== null) {
        const item = watchlistData[itemToToggle];
        const idx = itemToToggle;
        
        // When unmarking as watched, set to pending and clear currentlyWatching
        item.status = 'pending';
        delete item.date;
        
        // Clear the currently watching flag when marking as unwatched
        if (item.currentlyWatching) {
            item.currentlyWatching = false;
        }
        
        saveToStorage();
        renderCurrentlyWatching();
        renderWatchlist();
        updateStats();
        applyFilters();
        
        // Close modal first, then refresh detail modal
        document.getElementById('watchStatusModal').style.display = 'none';
        itemToToggle = null;
        
        // Refresh the detail modal with updated data
        refreshDetailModal(idx);
    } else {
        document.getElementById('watchStatusModal').style.display = 'none';
    }
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
    document.getElementById('seasonDateYear').value = '';
    document.querySelector('input[name="seasonDateType"][value="full"]').checked = true;
    document.getElementById('seasonDate').style.display = '';
    document.getElementById('seasonDateYear').style.display = 'none';
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
    // Detect year-only vs full date
    if (/^\d{4}$/.test(season.date)) {
        document.querySelector('input[name="seasonDateType"][value="year"]').checked = true;
        document.getElementById('seasonDate').style.display = 'none';
        document.getElementById('seasonDateYear').style.display = '';
        document.getElementById('seasonDateYear').value = season.date;
        document.getElementById('seasonDate').value = '';
    } else {
        document.querySelector('input[name="seasonDateType"][value="full"]').checked = true;
        document.getElementById('seasonDate').style.display = '';
        document.getElementById('seasonDateYear').style.display = 'none';
        document.getElementById('seasonDateYear').value = '';
        document.getElementById('seasonDate').value = new Date(season.date).toISOString().split('T')[0];
    }
    document.querySelector('#seasonModal h2').textContent = isMovie ? 'Edit Movie' : 'Edit Season';
    document.getElementById('confirmSeason').textContent = isMovie ? 'Update Movie' : 'Update Season';
    document.getElementById('seasonNumber').placeholder = isMovie ? 'Movie Number' : 'Season Number';
    document.getElementById('seasonNumber').required = !isMovie;
    document.getElementById('deleteSeason').style.display = 'block';
    document.getElementById('seasonModal').style.display = 'block';
}

function handleSeasonUpdate() {
    const seasonNumber = document.getElementById('seasonNumber').value;
    const seasonDateType = document.querySelector('input[name="seasonDateType"]:checked').value;
    const seasonDate = seasonDateType === 'year'
        ? document.getElementById('seasonDateYear').value
        : document.getElementById('seasonDate').value;
    
    if (!seasonDate || currentEditingItem === null) return;
    if (!seasonNumber && !watchlistData[currentEditingItem].isMovie) return;
    
    const item = watchlistData[currentEditingItem];
    if (!item.seasons) item.seasons = [];
    
    const formattedDate = seasonDateType === 'year'
        ? seasonDate  // just the year string
        : new Date(seasonDate).toLocaleDateString('en-US', {
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
        // Check if it's a year-only value (4 digits)
        if (/^\d{4}$/.test(item.date)) {
            document.querySelector('input[name="newDateType"][value="year"]').checked = true;
            document.getElementById('newDate').style.display = 'none';
            document.getElementById('newDateYear').style.display = '';
            document.getElementById('newDateYear').value = item.date;
            document.getElementById('newDate').value = '';
        } else {
            document.querySelector('input[name="newDateType"][value="full"]').checked = true;
            document.getElementById('newDate').style.display = '';
            document.getElementById('newDateYear').style.display = 'none';
            document.getElementById('newDateYear').value = '';
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
        }
    } else {
        document.querySelector('input[name="newDateType"][value="full"]').checked = true;
        document.getElementById('newDate').style.display = '';
        document.getElementById('newDateYear').style.display = 'none';
        document.getElementById('newDate').value = '';
        document.getElementById('newDateYear').value = '';
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
    // Reset date toggle to full date
    document.querySelector('input[name="newDateType"][value="full"]').checked = true;
    document.getElementById('newDate').style.display = '';
    document.getElementById('newDateYear').style.display = 'none';
    document.getElementById('newDateYear').value = '';
    // Clear TMDB data
    const titleInput = document.getElementById('newTitle');
    titleInput.dataset.tmdbPoster = '';
    titleInput.dataset.tmdbOverview = '';
    document.getElementById('tmdbDropdown').innerHTML = '';
    document.getElementById('tmdbDropdown').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();

    // Re-render instantly when another tab saves changes
    window.addEventListener('storage', function(e) {
        if (e.key === 'watchlistData') {
            loadFromStorage();
            populateGenreFilter();
            updateStats();
            applyFilters();
        }
    });
});
// ─── Currently Watching Functionality ────────────────────────────────────────

function renderCurrentlyWatching() {
    const isEnabled = localStorage.getItem('currentlyWatchingEnabled') !== 'false';
    const section = document.getElementById('currentlyWatchingSection');
    
    if (!section) return;
    
    if (!isEnabled) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    const grid = document.getElementById('currentlyWatchingGrid');
    const emptyState = document.getElementById('currentlyWatchingEmpty');
    
    // Get items with "currently watching" status
    const currentlyWatchingItems = watchlistData.filter(item => 
        item.currentlyWatching === true || item.status === 'currently-watching'
    );
    
    if (currentlyWatchingItems.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    grid.innerHTML = currentlyWatchingItems.map(item => {
        const itemIndex = watchlistData.indexOf(item);
        
        // Create thumbnail card similar to main watchlist but without status badge
        const footerHtml = `
            <div class="item-poster-footer">
                <div class="item-poster-title">${escapeHtml(item.title)}</div>
                <div class="item-poster-meta">
                    ${item.currentEpisode ? `<span>S${item.currentSeason || 1}E${item.currentEpisode}</span>` : ''}
                    ${item.year ? `<span>${escapeHtml(item.year)}</span>` : ''}
                </div>
            </div>`;

        if (item.poster) {
            return `
                <div class="item has-poster currently-watching-card" data-id="${item.id}" onclick="openDetailModal(${itemIndex})">
                    <img src="${item.poster}" alt="${escapeHtml(item.title)}" class="item-poster-bg" loading="lazy">
                    ${footerHtml}
                </div>`;
        } else {
            const letter = item.title.charAt(0).toUpperCase();
            return `
                <div class="item no-poster currently-watching-card" data-id="${item.id}" onclick="openDetailModal(${itemIndex})">
                    <div class="item-poster-placeholder">
                        <div class="item-poster-placeholder-letter">${escapeHtml(letter)}</div>
                    </div>
                    ${footerHtml}
                </div>`;
        }
    }).join('');
}

function addToCurrentlyWatching(itemId) {
    const item = watchlistData.find(i => i.id === itemId);
    if (item) {
        item.currentlyWatching = true;
        item.status = 'currently-watching';
        if (!item.currentEpisode && !item.isMovie) item.currentEpisode = 1;
        if (!item.currentSeason && !item.isMovie) item.currentSeason = 1;
        saveToStorage();
        renderCurrentlyWatching();
        renderWatchlist();
        updateStats();
        applyFilters();
    }
}

function removeFromCurrentlyWatching(itemId) {
    const item = watchlistData.find(i => i.id === itemId);
    if (item) {
        item.currentlyWatching = false;
        item.status = 'watched';
        item.date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        saveToStorage();
        renderCurrentlyWatching();
        renderWatchlist();
        updateStats();
        applyFilters();
    }
}

// Auto-remove from Currently Watching when marked as watched
function markAsWatched(itemId) {
    const item = watchlistData.find(i => i.id === itemId);
    if (item) {
        item.status = 'watched';
        // Auto-remove from currently watching if it was there
        if (item.currentlyWatching) {
            item.currentlyWatching = false;
        }
        saveToStorage();
        renderCurrentlyWatching();
        renderWatchlist();
        updateStats();
    }
}

function openAddFromListModal() {
    const modal = document.getElementById('addFromListModal');
    const availableShows = document.getElementById('availableShows');
    const noShowsMessage = document.getElementById('noShowsMessage');
    const searchInput = document.getElementById('listSearchInput');
    
    // Get shows that are not currently watching and not watched
    const eligibleShows = watchlistData.filter(item => 
        !item.currentlyWatching && 
        item.status !== 'watched'
    );
    
    if (eligibleShows.length === 0) {
        availableShows.style.display = 'none';
        noShowsMessage.style.display = 'block';
    } else {
        availableShows.style.display = 'block';
        noShowsMessage.style.display = 'none';
        renderAvailableShows(eligibleShows);
    }
    
    // Clear search
    searchInput.value = '';
    
    modal.style.display = 'block';
}

function renderAvailableShows(shows) {
    const availableShows = document.getElementById('availableShows');
    
    availableShows.innerHTML = shows.map(item => `
        <div class="available-show-item">
            <div class="show-info">
                <div class="show-title">${escapeHtml(item.title)}</div>
                <div class="show-details">
                    ${item.status === 'pending' ? 'To Watch' : 
                      item.status === 'upcoming' ? 'Upcoming' : 
                      item.status === 'currently-watching' ? 'Currently Watching' : 'Unknown'}
                    ${item.genres ? ` • ${item.genres.slice(0, 2).join(', ')}` : ''}
                    ${item.year ? ` • ${item.year}` : ''}
                </div>
            </div>
            <button class="add-to-currently-btn" onclick="addToCurrentlyWatchingFromList('${item.id}')">
                Add
            </button>
        </div>
    `).join('');
}

function addToCurrentlyWatchingFromList(itemId) {
    addToCurrentlyWatching(itemId);
    document.getElementById('addFromListModal').style.display = 'none';
    
    // Show success message
    showConfirmation('Added to Currently Watching!');
}

function filterAvailableShows() {
    const searchTerm = document.getElementById('listSearchInput').value.toLowerCase();
    const eligibleShows = watchlistData.filter(item => 
        !item.currentlyWatching && 
        item.status !== 'watched' &&
        item.title.toLowerCase().includes(searchTerm)
    );
    
    renderAvailableShows(eligibleShows);
}

function markEpisodeWatched(itemId) {
    const item = watchlistData.find(i => i.id === itemId);
    if (item) {
        if (item.isMovie) {
            removeFromCurrentlyWatching(itemId);
        } else {
            item.currentEpisode = (item.currentEpisode || 1) + 1;
        }
        saveToStorage();
        renderCurrentlyWatching();
    }
}

function showDetail(itemId) {
    const itemIndex = watchlistData.findIndex(i => i.id === itemId);
    if (itemIndex !== -1) {
        openDetailModal(itemIndex);
    }
}
// Add event listeners for Currently Watching functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add from List button event listener
    const addFromListBtn = document.getElementById('addFromListBtn');
    if (addFromListBtn) {
        addFromListBtn.addEventListener('click', function() {
            openAddFromListModal();
        });
    }
    
    // Search functionality for Add from List modal
    const listSearchInput = document.getElementById('listSearchInput');
    if (listSearchInput) {
        listSearchInput.addEventListener('input', function() {
            filterAvailableShows();
        });
    }
});