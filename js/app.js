// MovieTracker App with Cloudflare Workers Integration
class MovieTracker {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.watchedMovies = [];
        this.currentRating = 0;
        this.currentSection = 'dashboard';
        // For local development with wrangler dev, use http://localhost:8787
        // For production, use your Worker URL or empty string if serving from same origin
        this.apiUrl = window.location.hostname === 'localhost' && window.location.port !== '8787' 
            ? 'http://localhost:8787' 
            : '';
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.checkAuth();
        this.setupTheme();
        
        if (this.token) {
            await this.loadUserData();
            await this.loadWatchedMovies();
            this.updateStats();
            this.displayRecentActivity();
        }
        
        this.generateCalendar();
        this.generateYearOptions();
    }

    bindEvents() {
        // Check authentication on load
        if (!this.token) {
            window.location.href = 'login.html';
            return;
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
            });
        }

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);

                // Close mobile menu after click
                const navMenu = document.querySelector('.nav-menu');
                if (navMenu && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                }
            });
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Search functionality
        document.getElementById('search-btn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Filters
        document.getElementById('type-filter').addEventListener('change', () => {
            this.performSearch();
        });
        document.getElementById('genre-filter').addEventListener('change', () => {
            this.performSearch();
        });
        document.getElementById('year-filter').addEventListener('change', () => {
            this.performSearch();
        });

        // Modal events
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('movie-modal')) {
                this.closeModal();
            }
        });

        // Rating stars
        document.querySelectorAll('.stars i').forEach((star, index) => {
            star.addEventListener('click', () => {
                this.setRating(index + 1);
            });
            star.addEventListener('mouseenter', () => {
                this.highlightStars(index + 1);
            });
        });

        document.querySelector('.stars').addEventListener('mouseleave', () => {
            this.highlightStars(this.currentRating);
        });

        // Add to list button
        const addToListBtn = document.getElementById('add-to-list');
        if (addToListBtn) {
            addToListBtn.addEventListener('click', () => {
                this.addToWatched();
            });
        }

        // Mobile menu
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }
    }

    async checkAuth() {
        this.token = localStorage.getItem('token');
        if (this.token) {
            try {
                // Verify token by fetching user profile
                const response = await fetch(`${this.apiUrl}/api/user/profile`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
                
                if (!response.ok) {
                    // Token invalid, clear it
                    localStorage.removeItem('token');
                    this.token = null;
                }
            } catch (error) {
                console.error('Auth check error:', error);
                localStorage.removeItem('token');
                this.token = null;
            }
        }
    }

    async loadUserData() {
        try {
            const response = await fetch(`${this.apiUrl}/api/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.currentUser = await response.json();
                
                // Update UI with user data
                document.getElementById('username').textContent = this.currentUser.nickname || 'User';
                document.getElementById('profile-username').textContent = this.currentUser.nickname || 'User';
                document.getElementById('profile-email').textContent = this.currentUser.email;
                
                if (this.currentUser.avatar_url) {
                    document.getElementById('user-avatar').src = this.currentUser.avatar_url;
                }
            }
        } catch (error) {
            console.error('Load user data error:', error);
        }
    }

    async loadWatchedMovies() {
        try {
            const response = await fetch(`${this.apiUrl}/api/watched`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.watchedMovies = await response.json();
            }
        } catch (error) {
            console.error('Load watched movies error:', error);
            // Fallback to empty array
            this.watchedMovies = [];
        }
    }

    showSection(sectionName) {
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
        document.querySelector(`[href="#${sectionName}"]`)?.classList.add('active');

        // Load section-specific data
        if (sectionName === 'statistics' && this.token) {
            this.loadCharts();
        }
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.className = `${savedTheme}-theme`;
        
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = savedTheme;
        }
    }

    toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.body.className = `${newTheme}-theme`;
        localStorage.setItem('theme', newTheme);
        
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

        // Update backend if user is logged in
        if (this.token) {
            this.updateThemePreference(newTheme);
        }
    }

    async updateThemePreference(theme) {
        try {
            await fetch(`${this.apiUrl}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    nickname: this.currentUser.nickname,
                    description: this.currentUser.description,
                    theme_preference: theme
                })
            });
        } catch (error) {
            console.error('Update theme error:', error);
        }
    }

    displayRecentActivity() {
        const recentList = document.getElementById('recent-list');
        recentList.innerHTML = '';

        if (this.watchedMovies.length === 0) {
            recentList.innerHTML = '<p>Brak aktywności. Dodaj swój pierwszy film!</p>';
            return;
        }

        const recentItems = this.watchedMovies
            .sort((a, b) => new Date(b.watched_date) - new Date(a.watched_date))
            .slice(0, 5);

        recentItems.forEach(item => {
            if (!item.movie) return;
            
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <img src="${item.movie.poster_url || 'https://via.placeholder.com/200x300/888/fff?text=No+Image'}" 
                     alt="${item.movie.title}">
                <div class="activity-info">
                    <h4>${item.movie.title}</h4>
                    <p>Obejrzano: ${this.formatDate(item.watched_date)}</p>
                </div>
            `;
            recentList.appendChild(activityItem);
        });
    }

    updateStats() {
        const movies = this.watchedMovies.filter(item => item.movie && item.movie.type === 'movie');
        const series = this.watchedMovies.filter(item => item.movie && item.movie.type === 'series');
        
        document.getElementById('movies-count').textContent = movies.length;
        document.getElementById('series-count').textContent = series.length;
        
        // For hours, we'd need duration data - placeholder for now
        document.getElementById('hours-count').textContent = Math.round(this.watchedMovies.length * 2);
        
        // Calculate average rating from reviews
        if (this.token) {
            this.loadAverageRating();
        }
    }

    async loadAverageRating() {
        try {
            const response = await fetch(`${this.apiUrl}/api/user/statistics`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                document.getElementById('avg-rating').textContent = stats.average_rating.toFixed(1);
            }
        } catch (error) {
            console.error('Load rating error:', error);
        }
    }

    async performSearch() {
        const query = document.getElementById('search-input').value.toLowerCase();
        const typeFilter = document.getElementById('type-filter').value;
        const genreFilter = document.getElementById('genre-filter').value;
        const yearFilter = document.getElementById('year-filter').value;

        try {
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            if (typeFilter) params.append('type', typeFilter);
            if (genreFilter) params.append('genre', genreFilter);
            if (yearFilter) params.append('year', yearFilter);

            const response = await fetch(`${this.apiUrl}/api/movies/search?${params}`);
            
            if (response.ok) {
                const results = await response.json();
                this.displaySearchResults(results);
            }
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
                <img src="${item.poster_url || 'https://via.placeholder.com/200x300/888/fff?text=No+Image'}" 
                     alt="${item.title}">
                <div class="movie-card-content">
                    <h3>${item.title}</h3>
                    <p>${item.description || 'Brak opisu'}</p>
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
        
        document.getElementById('modal-poster').src = movie.poster_url || 'https://via.placeholder.com/200x300';
        document.getElementById('modal-title').textContent = movie.title;
        document.getElementById('modal-description').textContent = movie.description || 'Brak opisu';
        document.getElementById('modal-genre').textContent = movie.genre || '';
        
        if (movie.release_date) {
            const date = new Date(movie.release_date);
            document.getElementById('modal-year').textContent = date.getFullYear();
        }

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
        if (!this.token) {
            this.showNotification('Musisz być zalogowany, aby dodać film do listy!');
            return;
        }

        const modal = document.getElementById('movie-modal');
        const movie = modal.currentMovie;
        const reviewText = document.getElementById('review-text').value;

        try {
            // Add to watched list
            const watchedResponse = await fetch(`${this.apiUrl}/api/watched`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    movie_id: movie.id,
                    watched_date: new Date().toISOString()
                })
            });

            if (!watchedResponse.ok) {
                throw new Error('Failed to add to watched list');
            }

            // Add review if rating is provided
            if (this.currentRating > 0) {
                await fetch(`${this.apiUrl}/api/reviews`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({
                        movie_id: movie.id,
                        content: reviewText || null,
                        rating: this.currentRating
                    })
                });
            }

            // Reload data
            await this.loadWatchedMovies();
            this.updateStats();
            this.displayRecentActivity();
            this.closeModal();

            this.showNotification('Film został dodany do listy obejrzanych!');
        } catch (error) {
            console.error('Add to watched error:', error);
            this.showNotification('Wystąpił błąd podczas dodawania filmu.');
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

        const calendarHTML = `
            <div class="calendar-header">
                <h3>${this.getMonthName(currentMonth)} ${currentYear}</h3>
                <div class="calendar-nav">
                    <button onclick="app.changeMonth(-1)">‹</button>
                    <button onclick="app.changeMonth(1)">›</button>
                </div>
            </div>
            <div class="calendar-grid">
                ${this.generateCalendarDays(currentYear, currentMonth, [])}
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

    async loadCharts() {
        if (!this.token) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/user/statistics`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.loadTypeChart(stats.movies_count, stats.series_count);
                this.loadGenreChart(stats.genres);
                this.loadTimeChart();
            }
        } catch (error) {
            console.error('Load charts error:', error);
        }
    }

    loadTypeChart(moviesCount, seriesCount) {
        const ctx = document.getElementById('typeChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Filmy', 'Seriale'],
                datasets: [{
                    data: [moviesCount, seriesCount],
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

    loadGenreChart(genres) {
        const ctx = document.getElementById('genreChart').getContext('2d');
        
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
            const month = item.watched_date.substring(0, 7);
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
}

// Initialize the app
const app = new MovieTracker();
