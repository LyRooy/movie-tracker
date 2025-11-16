// MovieTracker App
class MovieTracker {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
        this.watchedMovies = [];
        this.currentRating = 0;
        this.currentSection = 'dashboard';
        this.adminVerified = false;
        
        this.init();
    }

    async init() {
        // Check if user is logged in
        await this.checkAuth();
        
        if (!this.currentUser) {
            this.showAuthScreen();
            return;
        }
        
        this.bindEvents();
        this.loadUserData();
        this.generateCalendar();
        await this.loadMoviesData();
        this.setupTheme();

        // Show admin section if user is admin
        if (this.currentUser && this.currentUser.role === 'admin') {
            const adminSection = document.getElementById('admin');
            if (adminSection) adminSection.style.display = '';
        }
        
        // Enable transitions after page load to prevent theme transition on load
        setTimeout(() => {
            document.body.classList.add('transitions-enabled');
        }, 100);
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);

                // Zamknij menu mobilne po kliknięciu w link
                const navMenu = document.querySelector('.nav-menu');
                const hamburger = document.querySelector('.hamburger');
                if (navMenu && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    if (hamburger) {
                        hamburger.classList.remove('active');
                    }
                }
            });
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Theme select in profile
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }

        // Search functionality
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }

        // Filters
        const typeFilter = document.getElementById('type-filter');
        const genreFilter = document.getElementById('genre-filter');
        const yearFilter = document.getElementById('year-filter');
        
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.performSearch();
            });
        }
        if (genreFilter) {
            genreFilter.addEventListener('change', () => {
                this.performSearch();
            });
        }
        if (yearFilter) {
            yearFilter.addEventListener('change', () => {
                this.performSearch();
            });
        }

        // Modal events
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('movie-modal');
            if (modal && e.target === modal) {
                this.closeModal();
            }
        });

        // Rating stars
        const starsContainer = document.querySelector('.stars');
        if (starsContainer) {
            starsContainer.querySelectorAll('i').forEach((star, index) => {
                star.addEventListener('click', () => {
                    this.setRating(index + 1);
                });
                star.addEventListener('mouseenter', () => {
                    this.highlightStars(index + 1);
                });
            });

            starsContainer.addEventListener('mouseleave', () => {
                this.highlightStars(this.currentRating);
            });
        }

        // Add to list button (zmienione z add-to-watched na add-to-list)
        const addToListBtn = document.getElementById('add-to-list');
        if (addToListBtn) {
            addToListBtn.addEventListener('click', () => {
                this.addToWatched();
            });
        }

        // Tab buttons for My List section
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all tab buttons
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Filter list based on selected tab
                const status = e.target.dataset.status;
                this.filterMyList(status);
            });
        });

        // View control buttons (grid/list view)
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all view buttons
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Change view mode
                const viewMode = e.target.dataset.view;
                this.changeViewMode(viewMode);
            });
        });

        // Mobile menu
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });

            // Zamknij menu po kliknięciu poza nim
            document.addEventListener('click', (e) => {
                if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                }
            });
        }

        // Generate year options for filter
        this.generateYearOptions();
        
        // Admin panel bindings (if admin)
        if (this.currentUser && this.currentUser.role === 'admin') {
            this.bindAdminEvents();
        }
    }

    showSection(sectionName) {
        // Admin panel requires password verification
        if (sectionName === 'admin' && !this.adminVerified) {
            this.showAdminPasswordPrompt();
            return;
        }

        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        document.getElementById(sectionName).classList.add('active');
        this.currentSection = sectionName;

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[href="#${sectionName}"]`).classList.add('active');

        // Load section-specific data
        if (sectionName === 'statistics') {
            this.loadCharts();
        } else if (sectionName === 'my-list') {
            this.displayMyList();
        } else if (sectionName === 'admin') {
            this.loadAdminData();
        }
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        let actualTheme = savedTheme;
        if (savedTheme === 'auto') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        // Theme should already be set by inline script, just update the icon and select
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = actualTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
        
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = savedTheme; // Set the saved option, not actual theme
        }
        
        // Listen for system theme changes when auto is selected
        if (savedTheme === 'auto') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === 'auto') {
                    this.changeTheme('auto');
                }
            });
        }
    }

    toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.changeTheme(newTheme);
    }

    changeTheme(theme) {
        let actualTheme = theme;
        
        // Handle auto theme based on system preference
        if (theme === 'auto') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        // Update both body and html class for consistency
        document.body.className = `${actualTheme}-theme transitions-enabled`;
        document.documentElement.className = `${actualTheme}-theme`;
        
        // Save to localStorage (save the selected option, not the actual theme)
        localStorage.setItem('theme', theme);
        
        // Update theme toggle button icon
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = actualTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
        
        // Update theme select in profile
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }
        
        console.log('Theme changed to:', theme, '(actual:', actualTheme + ')');
    }

    loadUserData() {
        // Update UI with current user data (loaded from auth)
        if (this.currentUser) {
            document.getElementById('username').textContent = this.currentUser.nickname;
            const profileUsername = document.getElementById('profile-username');
            const profileEmail = document.getElementById('profile-email');
            
            if (profileUsername) profileUsername.textContent = this.currentUser.nickname;
            if (profileEmail) profileEmail.textContent = this.currentUser.email;

            // Show admin navigation if user is admin
            if (this.currentUser.role === 'admin') {
                const adminNavItem = document.getElementById('admin-nav-item');
                if (adminNavItem) adminNavItem.style.display = 'block';
            }
        }
    }

    async loadMoviesData() {
        try {
            const response = await fetch('/api/movies?status=watched', {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                this.watchedMovies = await response.json();
            } else {
                console.warn('Failed to load movies from API, using empty array');
                this.watchedMovies = [];
            }
        } catch (error) {
            console.error('Error loading movies:', error);
            this.watchedMovies = [];
        }
        
        this.updateStats();
        this.displayRecentActivity();
        this.displayMyList();
    }

    displayMyList(filterStatus = 'all') {
        const listContainer = document.getElementById('my-list-content');
        if (!listContainer) {
            console.error('Lista container not found');
            return;
        }

        let filteredItems = this.watchedMovies;
        if (filterStatus !== 'all') {
            filteredItems = this.watchedMovies.filter(item => item.status === filterStatus);
        }

        listContainer.innerHTML = '';

        if (filteredItems.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-film"></i>
                    <h3>Brak elementów</h3>
                    <p>Nie masz jeszcze żadnych filmów lub seriali w tej kategorii.</p>
                </div>
            `;
            return;
        }

        filteredItems.forEach(item => {
            const statusBadge = this.getStatusBadge(item.status || 'watched');
            const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
            
            const listItemHtml = `
                <div class="list-item list-item-grid" data-status="${item.status || 'watched'}">
                    ${statusBadge}
                    <img src="${item.poster}" alt="${item.title}">
                    <div class="list-item-content">
                        <h3>${item.title}</h3>
                        <p>${item.year} • ${item.genre} • ${item.type === 'movie' ? 'Film' : 'Serial'}</p>
                        <p>Obejrzano: ${new Date(item.watchedDate).toLocaleDateString('pl-PL')}</p>
                        <div class="list-item-meta">
                            <div class="list-item-rating">
                                <span class="stars">${stars}</span>
                                <span>${item.rating}/5</span>
                            </div>
                        </div>
                        <div class="list-item-actions">
                            <button class="action-btn edit-btn" onclick="app.editItem(${item.id})">Edytuj</button>
                            <button class="action-btn delete-btn" onclick="app.deleteItem(${item.id})">Usuń</button>
                        </div>
                    </div>
                </div>
            `;
            listContainer.innerHTML += listItemHtml;
        });

        // Update stats
        this.updateListStats(filteredItems.length);
    }

    getStatusBadge(status) {
        const badges = {
            'watched': '<div class="status-badge status-watched">Obejrzane</div>',
            'watching': '<div class="status-badge status-watching">Oglądane</div>',
            'planning': '<div class="status-badge status-planning">Planowane</div>',
            'dropped': '<div class="status-badge status-dropped">Porzucone</div>'
        };
        return badges[status] || badges['watched'];
    }

    updateListStats(count) {
        const statsContainer = document.querySelector('.list-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `<span>Łącznie: ${count} pozycji</span>`;
        }
    }

    displayRecentActivity() {
        const recentList = document.getElementById('recent-list');
        recentList.innerHTML = '';

        const recentItems = this.watchedMovies
            .sort((a, b) => new Date(b.watchedDate) - new Date(a.watchedDate))
            .slice(0, 5);

        recentItems.forEach(item => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <img src="${item.poster}" alt="${item.title}">
                <div class="activity-info">
                    <h4>${item.title}</h4>
                    <p>Obejrzano: ${this.formatDate(item.watchedDate)}</p>
                    <p>Ocena: ${'★'.repeat(item.rating)}${'☆'.repeat(5-item.rating)}</p>
                </div>
            `;
            recentList.appendChild(activityItem);
        });
    }

    updateStats() {
        const movies = this.watchedMovies.filter(item => item.type === 'movie');
        const series = this.watchedMovies.filter(item => item.type === 'series');
        const totalHours = Math.round(this.watchedMovies.reduce((total, item) => total + item.duration, 0) / 60);
        const avgRating = this.watchedMovies.length > 0 
            ? (this.watchedMovies.reduce((total, item) => total + item.rating, 0) / this.watchedMovies.length).toFixed(1)
            : 0;

        document.getElementById('movies-count').textContent = movies.length;
        document.getElementById('series-count').textContent = series.length;
        document.getElementById('hours-count').textContent = totalHours;
        document.getElementById('avg-rating').textContent = avgRating;
    }

    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        const typeFilter = document.getElementById('type-filter').value;
        const genreFilter = document.getElementById('genre-filter').value;
        const yearFilter = document.getElementById('year-filter').value;

        if (!query) {
            this.displaySearchResults([]);
            return;
        }

        try {
            // Use search API
            const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`, {
                headers: this.getAuthHeaders()
            });
            let results = [];
            
            if (response.ok) {
                results = await response.json();
            } else {
                console.warn('Search API failed, showing empty results');
            }

            // Apply local filters
            let filteredResults = results;

            if (typeFilter) {
                filteredResults = filteredResults.filter(item => item.type === typeFilter);
            }

            if (genreFilter) {
                filteredResults = filteredResults.filter(item => 
                    item.genre.toLowerCase() === genreFilter.toLowerCase()
                );
            }

            if (yearFilter) {
                filteredResults = filteredResults.filter(item => 
                    item.year.toString() === yearFilter
                );
            }

            this.displaySearchResults(filteredResults);
        } catch (error) {
            console.error('Search error:', error);
            this.displaySearchResults([]);
        }
    }

    displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p>Nie znaleziono wyników.</p>';
            return;
        }

        results.forEach(item => {
            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';
            movieCard.innerHTML = `
                <img src="${item.poster}" alt="${item.title}">
                <div class="movie-card-content">
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    <div class="movie-rating">
                        <span class="stars">${'★'.repeat(Math.floor(item.rating))}${'☆'.repeat(5-Math.floor(item.rating))}</span>
                        <span>${item.rating}</span>
                    </div>
                </div>
            `;

            movieCard.addEventListener('click', () => {
                this.openMovieModal(item);
            });

            resultsContainer.appendChild(movieCard);
        });
    }

    openMovieModal(movie) {
        const modal = document.getElementById('movie-modal');
        
        document.getElementById('modal-poster').src = movie.poster;
        document.getElementById('modal-title').textContent = movie.title;
        document.getElementById('modal-description').textContent = movie.description;
        document.getElementById('modal-year').textContent = movie.year;
        document.getElementById('modal-genre').textContent = movie.genre;
        document.getElementById('modal-duration').textContent = movie.duration ? `${movie.duration} min` : '';

        // Reset rating
        this.currentRating = 0;
        this.highlightStars(0);
        document.getElementById('review-text').value = '';

        modal.style.display = 'block';
        modal.currentMovie = movie;
    }

    closeModal() {
        document.getElementById('movie-modal').style.display = 'none';
    }

    setRating(rating) {
        this.currentRating = rating;
        this.highlightStars(rating);
    }

    highlightStars(rating) {
        document.querySelectorAll('.stars i').forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    async addToWatched() {
        const modal = document.getElementById('movie-modal');
        const movie = modal.currentMovie;
        const reviewText = document.getElementById('review-text').value;

        const movieData = {
            ...movie,
            rating: this.currentRating,
            review: reviewText,
            status: 'watched',
            watchedDate: new Date().toISOString().split('T')[0]
        };

        try {
            const response = await fetch('/api/movies', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(movieData)
            });

            if (response.ok) {
                // Reload movies data to refresh the list
                await this.loadMoviesData();
                this.closeModal();
                this.showNotification('Film został dodany do listy obejrzanych!');
            } else {
                throw new Error('Failed to add movie');
            }
        } catch (error) {
            console.error('Error adding movie:', error);
            this.showNotification('Błąd podczas dodawania filmu. Spróbuj ponownie.');
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            background-color: var(--secondary-color);
            color: white;
            padding: 1rem 2rem;
            border-radius: 5px;
            box-shadow: var(--shadow);
            z-index: 3000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    generateCalendar() {
        const calendar = document.getElementById('calendar-container');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Mock upcoming premieres
        const premieres = [
            { date: '2024-02-15', title: 'Nowy film Marvel' },
            { date: '2024-02-20', title: 'Sezon 2 popularnego serialu' },
            { date: '2024-02-28', title: 'Długo oczekiwany sequel' }
        ];

        const calendarHTML = `
            <div class="calendar-header">
                <h3>${this.getMonthName(currentMonth)} ${currentYear}</h3>
                <div class="calendar-nav">
                    <button onclick="app.changeMonth(-1)">‹</button>
                    <button onclick="app.changeMonth(1)">›</button>
                </div>
            </div>
            <div class="calendar-grid">
                ${this.generateCalendarDays(currentYear, currentMonth, premieres)}
            </div>
        `;

        calendar.innerHTML = calendarHTML;
    }

    generateCalendarDays(year, month, premieres) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let html = '';
        const dayNames = ['Nie', 'Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob'];
        
        // Add day headers
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });

        // Generate calendar days
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = currentDate.getMonth() === month;
            const isToday = this.isToday(currentDate);
            const dateString = currentDate.toISOString().split('T')[0];
            
            const dayPremieres = premieres.filter(p => p.date === dateString);
            
            html += `
                <div class="calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}">
                    <div class="day-number">${currentDate.getDate()}</div>
                    ${dayPremieres.map(p => `<div class="premiere-item">${p.title}</div>`).join('')}
                </div>
            `;
        }

        return html;
    }

    loadCharts() {
        this.loadTypeChart();
        this.loadGenreChart();
        this.loadTimeChart();
    }

    loadTypeChart() {
        const ctx = document.getElementById('typeChart').getContext('2d');
        const movies = this.watchedMovies.filter(item => item.type === 'movie').length;
        const series = this.watchedMovies.filter(item => item.type === 'series').length;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Filmy', 'Seriale'],
                datasets: [{
                    data: [movies, series],
                    backgroundColor: ['#3498db', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    loadGenreChart() {
        const ctx = document.getElementById('genreChart').getContext('2d');
        const genres = {};
        
        this.watchedMovies.forEach(item => {
            genres[item.genre] = (genres[item.genre] || 0) + 1;
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(genres),
                datasets: [{
                    label: 'Liczba produkcji',
                    data: Object.values(genres),
                    backgroundColor: '#3498db'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    loadTimeChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');
        const monthlyData = {};
        
        this.watchedMovies.forEach(item => {
            const month = item.watchedDate.substring(0, 7);
            monthlyData[month] = (monthlyData[month] || 0) + 1;
        });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(monthlyData),
                datasets: [{
                    label: 'Obejrzane produkcje',
                    data: Object.values(monthlyData),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    generateYearOptions() {
        const yearFilter = document.getElementById('year-filter');
        const currentYear = new Date().getFullYear();
        
        for (let year = currentYear; year >= 1990; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        }
    }

    // Utility functions
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pl-PL');
    }

    getMonthName(month) {
        const months = [
            'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
            'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
        ];
        return months[month];
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    changeMonth(direction) {
        // Implementation for month navigation
        console.log('Change month:', direction);
    }

    filterMyList(status) {
        // Filter the list based on status
        this.displayMyList(status);
        console.log('Filtering list by status:', status);
    }

    changeViewMode(viewMode) {
        // Change between grid and list view
        const myListContainer = document.querySelector('.my-list-grid');
        const listItems = document.querySelectorAll('.list-item');
        
        if (myListContainer) {
            if (viewMode === 'list') {
                myListContainer.classList.add('my-list-list');
                myListContainer.classList.remove('my-list-grid');
                listItems.forEach(item => {
                    item.classList.add('list-item-list');
                    item.classList.remove('list-item-grid');
                });
            } else {
                myListContainer.classList.add('my-list-grid');
                myListContainer.classList.remove('my-list-list');
                listItems.forEach(item => {
                    item.classList.add('list-item-grid');
                    item.classList.remove('list-item-list');
                });
            }
        }
        console.log('Changing view mode to:', viewMode);
    }

    editItem(itemId) {
        // Find and edit item
        const item = this.watchedMovies.find(movie => movie.id === itemId);
        if (item) {
            console.log('Editing item:', item);
            // TODO: Implement edit modal/form that uses PUT /api/movies/{id}
            alert(`Edytowanie: ${item.title} - funkcja będzie dostępna wkrótce`);
        }
    }

    async deleteItem(itemId) {
        // Delete item from list
        const item = this.watchedMovies.find(movie => movie.id === itemId);
        if (item && confirm(`Czy na pewno chcesz usunąć "${item.title}" z listy?`)) {
            try {
                const response = await fetch(`/api/movies/${itemId}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    // Reload movies data to refresh the list
                    await this.loadMoviesData();
                    this.showNotification(`Usunięto "${item.title}" z listy`);
                } else {
                    throw new Error('Failed to delete movie');
                }
            } catch (error) {
                console.error('Error deleting movie:', error);
                this.showNotification('Błąd podczas usuwania filmu. Spróbuj ponownie.');
            }
        }
    }

    // Authentication methods
    async checkAuth() {
        this.authToken = localStorage.getItem('movieTrackerToken');
        if (this.authToken) {
            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    this.currentUser = data.user;
                } else {
                    localStorage.removeItem('movieTrackerToken');
                    this.authToken = null;
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('movieTrackerToken');
                this.authToken = null;
            }
        }
    }

    showAuthScreen() {
        document.body.innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <h2 id="auth-title">Zaloguj się do MovieTracker</h2>
                    <div id="auth-error" class="auth-error" style="display: none;"></div>
                    <form class="auth-form" id="auth-form">
                        <input type="text" id="nickname" placeholder="Nazwa użytkownika" class="auth-input" style="display: none;">
                        <input type="text" id="emailOrUsername" placeholder="Email lub nazwa użytkownika" class="auth-input" required>
                        <input type="password" id="password" placeholder="Hasło" class="auth-input" required>
                        <button type="submit" class="auth-btn" id="auth-submit">Zaloguj się</button>
                    </form>
                    <div class="auth-toggle">
                        <span id="auth-toggle-text">Nie masz konta?</span>
                        <a id="auth-toggle-link">Utwórz konto</a>
                    </div>
                </div>
            </div>
        `;

        this.bindAuthEvents();
    }

    bindAuthEvents() {
        const form = document.getElementById('auth-form');
        const toggleLink = document.getElementById('auth-toggle-link');
        let isLogin = true;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailOrUsername = document.getElementById('emailOrUsername').value;
            const password = document.getElementById('password').value;
            const nickname = document.getElementById('nickname').value;

            try {
                const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
                const body = isLogin ? { emailOrUsername, password } : { nickname, email: emailOrUsername, password };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const data = await response.json();

                if (response.ok) {
                    this.authToken = data.token;
                    this.currentUser = data.user;
                    localStorage.setItem('movieTrackerToken', this.authToken);
                    
                    // Reload page to show main app
                    location.reload();
                } else {
                    this.showAuthError(data.error);
                }
            } catch (error) {
                this.showAuthError('Błąd połączenia. Spróbuj ponownie.');
            }
        });

        toggleLink.addEventListener('click', () => {
            isLogin = !isLogin;
            const title = document.getElementById('auth-title');
            const submitBtn = document.getElementById('auth-submit');
            const toggleText = document.getElementById('auth-toggle-text');
            const nicknameInput = document.getElementById('nickname');
            const emailOrUsernameInput = document.getElementById('emailOrUsername');

            if (isLogin) {
                title.textContent = 'Zaloguj się do MovieTracker';
                submitBtn.textContent = 'Zaloguj się';
                toggleText.textContent = 'Nie masz konta?';
                toggleLink.textContent = 'Utwórz konto';
                nicknameInput.style.display = 'none';
                nicknameInput.required = false;
                emailOrUsernameInput.placeholder = 'Email lub nazwa użytkownika';
            } else {
                title.textContent = 'Utwórz konto MovieTracker';
                submitBtn.textContent = 'Zarejestruj się';
                toggleText.textContent = 'Masz już konto?';
                toggleLink.textContent = 'Zaloguj się';
                nicknameInput.style.display = 'block';
                nicknameInput.required = true;
                emailOrUsernameInput.placeholder = 'Adres email';
            }
        });
    }

    showAuthError(message) {
        const errorDiv = document.getElementById('auth-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        };
    }

    logout() {
        localStorage.removeItem('movieTrackerToken');
        location.reload();
    }

    // Admin Panel Methods
    bindAdminEvents() {
        // Tab switching
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchAdminTab(tab);
            });
        });

        // Add buttons
        document.getElementById('add-movie-btn').addEventListener('click', () => this.showAdminMovieModal());
        document.getElementById('add-challenge-btn').addEventListener('click', () => this.showAdminChallengeModal());
        document.getElementById('add-badge-btn').addEventListener('click', () => this.showAdminBadgeModal());

        // Bulk delete buttons
        document.getElementById('delete-selected-movies-btn').addEventListener('click', () => this.bulkDeleteMovies());
        document.getElementById('delete-selected-challenges-btn').addEventListener('click', () => this.bulkDeleteChallenges());
        document.getElementById('delete-selected-badges-btn').addEventListener('click', () => this.bulkDeleteBadges());

        // Select all checkboxes
        document.getElementById('select-all-movies').addEventListener('change', (e) => {
            document.querySelectorAll('.movie-checkbox').forEach(cb => cb.checked = e.target.checked);
            this.updateBulkDeleteButton('movies');
        });
        document.getElementById('select-all-challenges').addEventListener('change', (e) => {
            document.querySelectorAll('.challenge-checkbox').forEach(cb => cb.checked = e.target.checked);
            this.updateBulkDeleteButton('challenges');
        });
        document.getElementById('select-all-badges').addEventListener('change', (e) => {
            document.querySelectorAll('.badge-checkbox').forEach(cb => cb.checked = e.target.checked);
            this.updateBulkDeleteButton('badges');
        });

        // Modal close buttons
        document.querySelectorAll('#admin-movie-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAdminModal('admin-movie-modal'));
        });
        document.querySelectorAll('#admin-challenge-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAdminModal('admin-challenge-modal'));
        });
        document.querySelectorAll('#admin-badge-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAdminModal('admin-badge-modal'));
        });

        // Form submissions
        document.getElementById('admin-movie-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAdminMovie();
        });
        document.getElementById('admin-challenge-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAdminChallenge();
        });
        document.getElementById('admin-badge-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAdminBadge();
        });
    }

    switchAdminTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`admin-${tab}-tab`).classList.add('active');

        // Load data for the tab
        if (tab === 'movies') this.loadAdminMovies();
        else if (tab === 'challenges') this.loadAdminChallenges();
        else if (tab === 'badges') this.loadAdminBadges();
    }

    async loadAdminData() {
        // Load data for the currently active tab
        const activeTab = document.querySelector('.admin-tab-btn.active').dataset.tab;
        this.switchAdminTab(activeTab);
    }

    async loadAdminMovies() {
        try {
            const response = await fetch('/api/admin/movies', {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const movies = await response.json();
                this.displayAdminMovies(movies);
            }
        } catch (error) {
            console.error('Error loading admin movies:', error);
            this.showNotification('Błąd podczas ładowania filmów', 'error');
        }
    }

    displayAdminMovies(movies) {
        const tbody = document.getElementById('admin-movies-list');
        tbody.innerHTML = movies.map(movie => `
            <tr>
                <td><input type="checkbox" class="movie-checkbox" data-id="${movie.id}" onchange="app.updateBulkDeleteButton('movies')"></td>
                <td>${movie.id}</td>
                <td>${movie.title}</td>
                <td>${movie.media_type === 'movie' ? 'Film' : 'Serial'}</td>
                <td>${movie.year || '-'}</td>
                <td>${movie.genre || '-'}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="app.editAdminMovie(${movie.id})">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="action-btn btn-delete" onclick="app.deleteAdminMovie(${movie.id})">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async loadAdminChallenges() {
        try {
            const response = await fetch('/api/admin/challenges', {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const challenges = await response.json();
                this.displayAdminChallenges(challenges);
            }
        } catch (error) {
            console.error('Error loading admin challenges:', error);
            this.showNotification('Błąd podczas ładowania wyzwań', 'error');
        }
    }

    displayAdminChallenges(challenges) {
        const tbody = document.getElementById('admin-challenges-list');
        tbody.innerHTML = challenges.map(challenge => `
            <tr>
                <td><input type="checkbox" class="challenge-checkbox" data-id="${challenge.id}" onchange="app.updateBulkDeleteButton('challenges')"></td>
                <td>${challenge.id}</td>
                <td>${challenge.name}</td>
                <td>${challenge.type}</td>
                <td>${challenge.criteria_value || '-'}</td>
                <td>${challenge.target_count}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="app.editAdminChallenge(${challenge.id})">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="action-btn btn-delete" onclick="app.deleteAdminChallenge(${challenge.id})">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async loadAdminBadges() {
        try {
            const response = await fetch('/api/admin/badges', {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const badges = await response.json();
                this.displayAdminBadges(badges);
            }
        } catch (error) {
            console.error('Error loading admin badges:', error);
            this.showNotification('Błąd podczas ładowania odznak', 'error');
        }
    }

    displayAdminBadges(badges) {
        const tbody = document.getElementById('admin-badges-list');
        tbody.innerHTML = badges.map(badge => `
            <tr>
                <td><input type="checkbox" class="badge-checkbox" data-id="${badge.id}" onchange="app.updateBulkDeleteButton('badges')"></td>
                <td>${badge.id}</td>
                <td>${badge.name}</td>
                <td>${badge.description}</td>
                <td><i class="fas ${badge.image_url || 'fa-award'}"></i></td>
                <td>
                    <button class="action-btn btn-edit" onclick="app.editAdminBadge(${badge.id})">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="action-btn btn-delete" onclick="app.deleteAdminBadge(${badge.id})">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Movie CRUD
    showAdminMovieModal(movie = null) {
        const modal = document.getElementById('admin-movie-modal');
        const title = document.getElementById('admin-movie-modal-title');
        
        if (movie) {
            title.textContent = 'Edytuj film';
            document.getElementById('admin-movie-id').value = movie.id;
            document.getElementById('admin-movie-title').value = movie.title;
            document.getElementById('admin-movie-type').value = movie.media_type;
            document.getElementById('admin-movie-year').value = movie.year || '';
            document.getElementById('admin-movie-genre').value = movie.genre || '';
            document.getElementById('admin-movie-duration').value = movie.duration || '';
            document.getElementById('admin-movie-description').value = movie.description || '';
            document.getElementById('admin-movie-poster').value = movie.poster_url || '';
        } else {
            title.textContent = 'Dodaj film';
            document.getElementById('admin-movie-form').reset();
            document.getElementById('admin-movie-id').value = '';
        }
        
        modal.style.display = 'block';
    }

    async editAdminMovie(id) {
        try {
            const response = await fetch(`/api/admin/movies/${id}`, {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const movie = await response.json();
                this.showAdminMovieModal(movie);
            }
        } catch (error) {
            console.error('Error loading movie:', error);
            this.showNotification('Błąd podczas ładowania filmu', 'error');
        }
    }

    async saveAdminMovie() {
        const id = document.getElementById('admin-movie-id').value;
        const data = {
            title: document.getElementById('admin-movie-title').value,
            type: document.getElementById('admin-movie-type').value,
            year: parseInt(document.getElementById('admin-movie-year').value) || null,
            genre: document.getElementById('admin-movie-genre').value || null,
            duration: parseInt(document.getElementById('admin-movie-duration').value) || null,
            description: document.getElementById('admin-movie-description').value || null,
            poster: document.getElementById('admin-movie-poster').value || null
        };

        try {
            const url = id ? `/api/admin/movies/${id}` : '/api/admin/movies';
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification(id ? 'Film zaktualizowany' : 'Film dodany', 'success');
                this.closeAdminModal('admin-movie-modal');
                this.loadAdminMovies();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas zapisywania filmu', 'error');
            }
        } catch (error) {
            console.error('Error saving movie:', error);
            this.showNotification('Błąd podczas zapisywania filmu', 'error');
        }
    }

    async deleteAdminMovie(id) {
        if (!confirm('Czy na pewno chcesz usunąć ten film?')) return;

        try {
            const response = await fetch(`/api/admin/movies/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                this.showNotification('Film usunięty', 'success');
                this.loadAdminMovies();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas usuwania filmu', 'error');
            }
        } catch (error) {
            console.error('Error deleting movie:', error);
            this.showNotification('Błąd podczas usuwania filmu', 'error');
        }
    }

    // Challenge CRUD
    showAdminChallengeModal(challenge = null) {
        const modal = document.getElementById('admin-challenge-modal');
        const title = document.getElementById('admin-challenge-modal-title');
        
        if (challenge) {
            title.textContent = 'Edytuj wyzwanie';
            document.getElementById('admin-challenge-id').value = challenge.id;
            document.getElementById('admin-challenge-name').value = challenge.name;
            document.getElementById('admin-challenge-description').value = challenge.description || '';
            document.getElementById('admin-challenge-type').value = challenge.type;
            document.getElementById('admin-challenge-criteria').value = challenge.criteria_value || '';
            document.getElementById('admin-challenge-target').value = challenge.target_count;
            document.getElementById('admin-challenge-start').value = challenge.start_date ? challenge.start_date.split('T')[0] : '';
            document.getElementById('admin-challenge-end').value = challenge.end_date ? challenge.end_date.split('T')[0] : '';
            document.getElementById('admin-challenge-badge').value = challenge.badge_id || '';
        } else {
            title.textContent = 'Dodaj wyzwanie';
            document.getElementById('admin-challenge-form').reset();
            document.getElementById('admin-challenge-id').value = '';
        }
        
        modal.style.display = 'block';
    }

    async editAdminChallenge(id) {
        try {
            const response = await fetch(`/api/admin/challenges/${id}`, {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const challenge = await response.json();
                this.showAdminChallengeModal(challenge);
            }
        } catch (error) {
            console.error('Error loading challenge:', error);
            this.showNotification('Błąd podczas ładowania wyzwania', 'error');
        }
    }

    async saveAdminChallenge() {
        const id = document.getElementById('admin-challenge-id').value;
        const data = {
            name: document.getElementById('admin-challenge-name').value,
            description: document.getElementById('admin-challenge-description').value || null,
            type: document.getElementById('admin-challenge-type').value,
            criteria_value: document.getElementById('admin-challenge-criteria').value || null,
            target_count: parseInt(document.getElementById('admin-challenge-target').value),
            start_date: document.getElementById('admin-challenge-start').value || null,
            end_date: document.getElementById('admin-challenge-end').value || null,
            badge_id: parseInt(document.getElementById('admin-challenge-badge').value) || null
        };

        try {
            const url = id ? `/api/admin/challenges/${id}` : '/api/admin/challenges';
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification(id ? 'Wyzwanie zaktualizowane' : 'Wyzwanie dodane', 'success');
                this.closeAdminModal('admin-challenge-modal');
                this.loadAdminChallenges();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas zapisywania wyzwania', 'error');
            }
        } catch (error) {
            console.error('Error saving challenge:', error);
            this.showNotification('Błąd podczas zapisywania wyzwania', 'error');
        }
    }

    async deleteAdminChallenge(id) {
        if (!confirm('Czy na pewno chcesz usunąć to wyzwanie?')) return;

        try {
            const response = await fetch(`/api/admin/challenges/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                this.showNotification('Wyzwanie usunięte', 'success');
                this.loadAdminChallenges();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas usuwania wyzwania', 'error');
            }
        } catch (error) {
            console.error('Error deleting challenge:', error);
            this.showNotification('Błąd podczas usuwania wyzwania', 'error');
        }
    }

    // Badge CRUD
    showAdminBadgeModal(badge = null) {
        const modal = document.getElementById('admin-badge-modal');
        const title = document.getElementById('admin-badge-modal-title');
        
        if (badge) {
            title.textContent = 'Edytuj odznakę';
            document.getElementById('admin-badge-id').value = badge.id;
            document.getElementById('admin-badge-name').value = badge.name;
            document.getElementById('admin-badge-description').value = badge.description;
            document.getElementById('admin-badge-icon').value = badge.image_url || '';
        } else {
            title.textContent = 'Dodaj odznakę';
            document.getElementById('admin-badge-form').reset();
            document.getElementById('admin-badge-id').value = '';
        }
        
        modal.style.display = 'block';
    }

    async editAdminBadge(id) {
        try {
            const response = await fetch(`/api/admin/badges/${id}`, {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const badge = await response.json();
                this.showAdminBadgeModal(badge);
            }
        } catch (error) {
            console.error('Error loading badge:', error);
            this.showNotification('Błąd podczas ładowania odznaki', 'error');
        }
    }

    async saveAdminBadge() {
        const id = document.getElementById('admin-badge-id').value;
        const data = {
            name: document.getElementById('admin-badge-name').value,
            description: document.getElementById('admin-badge-description').value,
            image_url: document.getElementById('admin-badge-icon').value || null
        };

        try {
            const url = id ? `/api/admin/badges/${id}` : '/api/admin/badges';
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification(id ? 'Odznaka zaktualizowana' : 'Odznaka dodana', 'success');
                this.closeAdminModal('admin-badge-modal');
                this.loadAdminBadges();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas zapisywania odznaki', 'error');
            }
        } catch (error) {
            console.error('Error saving badge:', error);
            this.showNotification('Błąd podczas zapisywania odznaki', 'error');
        }
    }

    async deleteAdminBadge(id) {
        if (!confirm('Czy na pewno chcesz usunąć tę odznakę?')) return;

        try {
            const response = await fetch(`/api/admin/badges/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                this.showNotification('Odznaka usunięta', 'success');
                this.loadAdminBadges();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas usuwania odznaki', 'error');
            }
        } catch (error) {
            console.error('Error deleting badge:', error);
            this.showNotification('Błąd podczas usuwania odznaki', 'error');
        }
    }

    closeAdminModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // Admin password verification
    showAdminPasswordPrompt() {
        const modal = document.getElementById('admin-password-modal');
        const passwordInput = document.getElementById('admin-password-input');
        const errorDiv = document.getElementById('admin-password-error');
        
        // Clear previous input and errors
        passwordInput.value = '';
        errorDiv.style.display = 'none';
        
        // Show modal
        modal.style.display = 'block';
        
        // Focus on password input
        setTimeout(() => passwordInput.focus(), 100);
        
        // Setup form submission (remove old listeners first)
        const form = document.getElementById('admin-password-form');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-password-input').value;
            this.verifyAdminPassword(password);
        });
        
        // Setup close buttons
        modal.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });
    }

    async verifyAdminPassword(password) {
        const errorDiv = document.getElementById('admin-password-error');
        
        try {
            // Try to login with current user's email/nickname and provided password
            const loginData = {
                emailOrUsername: this.currentUser.email,
                password: password
            };

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            if (response.ok) {
                // Password is correct
                this.adminVerified = true;
                document.getElementById('admin-password-modal').style.display = 'none';
                this.showNotification('Dostęp przyznany', 'success');
                this.showSection('admin');
            } else {
                // Show error in modal
                errorDiv.textContent = 'Nieprawidłowe hasło';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Error verifying admin password:', error);
            errorDiv.textContent = 'Błąd podczas weryfikacji hasła';
            errorDiv.style.display = 'block';
        }
    }

    // Bulk delete functions
    updateBulkDeleteButton(type) {
        const checkboxes = document.querySelectorAll(`.${type.slice(0, -1)}-checkbox:checked`);
        const button = document.getElementById(`delete-selected-${type}-btn`);
        button.style.display = checkboxes.length > 0 ? 'inline-block' : 'none';
    }

    async bulkDeleteMovies() {
        const checkboxes = document.querySelectorAll('.movie-checkbox:checked');
        const ids = Array.from(checkboxes).map(cb => cb.dataset.id);
        
        if (ids.length === 0) return;
        
        if (!confirm(`Czy na pewno chcesz usunąć ${ids.length} film(ów)?`)) return;

        let successCount = 0;
        let errorCount = 0;

        for (const id of ids) {
            try {
                const response = await fetch(`/api/admin/movies/${id}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`Error deleting movie ${id}:`, error);
                errorCount++;
            }
        }

        this.showNotification(`Usunięto: ${successCount}, Błędy: ${errorCount}`, successCount > 0 ? 'success' : 'error');
        this.loadAdminMovies();
        document.getElementById('select-all-movies').checked = false;
        this.updateBulkDeleteButton('movies');
    }

    async bulkDeleteChallenges() {
        const checkboxes = document.querySelectorAll('.challenge-checkbox:checked');
        const ids = Array.from(checkboxes).map(cb => cb.dataset.id);
        
        if (ids.length === 0) return;
        
        if (!confirm(`Czy na pewno chcesz usunąć ${ids.length} wyzwań?`)) return;

        let successCount = 0;
        let errorCount = 0;

        for (const id of ids) {
            try {
                const response = await fetch(`/api/admin/challenges/${id}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`Error deleting challenge ${id}:`, error);
                errorCount++;
            }
        }

        this.showNotification(`Usunięto: ${successCount}, Błędy: ${errorCount}`, successCount > 0 ? 'success' : 'error');
        this.loadAdminChallenges();
        document.getElementById('select-all-challenges').checked = false;
        this.updateBulkDeleteButton('challenges');
    }

    async bulkDeleteBadges() {
        const checkboxes = document.querySelectorAll('.badge-checkbox:checked');
        const ids = Array.from(checkboxes).map(cb => cb.dataset.id);
        
        if (ids.length === 0) return;
        
        if (!confirm(`Czy na pewno chcesz usunąć ${ids.length} odznak(i)?`)) return;

        let successCount = 0;
        let errorCount = 0;

        for (const id of ids) {
            try {
                const response = await fetch(`/api/admin/badges/${id}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`Error deleting badge ${id}:`, error);
                errorCount++;
            }
        }

        this.showNotification(`Usunięto: ${successCount}, Błędy: ${errorCount}`, successCount > 0 ? 'success' : 'error');
        this.loadAdminBadges();
        document.getElementById('select-all-badges').checked = false;
        this.updateBulkDeleteButton('badges');
    }
    
}

// Initialize the app
const app = new MovieTracker();
