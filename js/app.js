// MovieTracker App
class MovieTracker {
    constructor() {
        this.currentUser = null;
        this.watchedMovies = [];
        this.currentRating = 0;
        this.currentSection = 'dashboard';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadUserData();
        this.generateCalendar();
        this.loadMockData();
        this.updateStats();
        this.setupTheme();
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

        // Add to watched
        document.getElementById('add-to-watched').addEventListener('click', () => {
            this.addToWatched();
        });

        // Mobile menu
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // Generate year options for filter
        this.generateYearOptions();
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
        document.querySelector(`[href="#${sectionName}"]`).classList.add('active');

        // Load section-specific data
        if (sectionName === 'statistics') {
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
    }

    loadUserData() {
        // Mock user data - in real app, this would come from API
        this.currentUser = {
            id: 1,
            username: 'LyRooy',
            email: 'lyrooy@example.com',
            avatarUrl: 'images/default-avatar.png',
            memberSince: '2024',
            preferences: {
                emailNotifications: true,
                publicProfile: false,
                theme: 'light'
            }
        };

        // Update UI with user data
        document.getElementById('username').textContent = this.currentUser.username;
        document.getElementById('profile-username').textContent = this.currentUser.username;
        document.getElementById('profile-email').textContent = this.currentUser.email;
        document.getElementById('member-since').textContent = this.currentUser.memberSince;
        document.getElementById('user-avatar').src = this.currentUser.avatarUrl;
    }

    loadMockData() {
        // Mock watched movies data
        this.watchedMovies = [
            {
                id: 1,
                title: 'Incepcja',
                type: 'movie',
                year: 2010,
                genre: 'Sci-Fi',
                rating: 5,
                watchedDate: '2024-01-15',
                poster: 'https://via.placeholder.com/200x300/4CAF50/white?text=Incepcja',
                duration: 148
            },
            {
                id: 2,
                title: 'Breaking Bad',
                type: 'series',
                year: 2008,
                genre: 'Dramat',
                rating: 5,
                watchedDate: '2024-01-10',
                poster: 'https://via.placeholder.com/200x300/2196F3/white?text=Breaking+Bad',
                duration: 2940 // total minutes
            },
            {
                id: 3,
                title: 'Paragraf 22',
                type: 'movie',
                year: 2019,
                genre: 'Komedia',
                rating: 4,
                watchedDate: '2024-01-05',
                poster: 'https://via.placeholder.com/200x300/FF9800/white?text=Paragraf+22',
                duration: 119
            }
        ];

        this.displayRecentActivity();
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

    performSearch() {
        const query = document.getElementById('search-input').value.toLowerCase();
        const typeFilter = document.getElementById('type-filter').value;
        const genreFilter = document.getElementById('genre-filter').value;
        const yearFilter = document.getElementById('year-filter').value;

        // Mock search results - in real app, this would be API call
        const mockResults = [
            {
                id: 101,
                title: 'Matrix',
                type: 'movie',
                year: 1999,
                genre: 'sci-fi',
                poster: 'https://via.placeholder.com/200x300/9C27B0/white?text=Matrix',
                description: 'Programista komputerowy zostaje wciągnięty w rewolucję przeciwko maszynom.',
                rating: 4.5
            },
            {
                id: 102,
                title: 'Stranger Things',
                type: 'series',
                year: 2016,
                genre: 'horror',
                poster: 'https://via.placeholder.com/200x300/F44336/white?text=Stranger+Things',
                description: 'Grupa dzieci walczy z nadprzyrodzonymi siłami w małym miasteczku.',
                rating: 4.8
            },
            {
                id: 103,
                title: 'Avengers: Endgame',
                type: 'movie',
                year: 2019,
                genre: 'action',
                poster: 'https://via.placeholder.com/200x300/3F51B5/white?text=Endgame',
                description: 'Superbohaterowie próbują odwrócić skutki działań Thanosa.',
                rating: 4.7
            }
        ];

        let filteredResults = mockResults;

        // Apply filters
        if (query) {
            filteredResults = filteredResults.filter(item => 
                item.title.toLowerCase().includes(query)
            );
        }

        if (typeFilter) {
            filteredResults = filteredResults.filter(item => item.type === typeFilter);
        }

        if (genreFilter) {
            filteredResults = filteredResults.filter(item => item.genre === genreFilter);
        }

        if (yearFilter) {
            filteredResults = filteredResults.filter(item => item.year.toString() === yearFilter);
        }

        this.displaySearchResults(filteredResults);
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

    addToWatched() {
        const modal = document.getElementById('movie-modal');
        const movie = modal.currentMovie;
        const reviewText = document.getElementById('review-text').value;

        const watchedItem = {
            ...movie,
            rating: this.currentRating,
            review: reviewText,
            watchedDate: new Date().toISOString().split('T')[0],
            duration: movie.duration || 120
        };

        this.watchedMovies.push(watchedItem);
        this.updateStats();
        this.displayRecentActivity();
        this.closeModal();

        // Show success message
        this.showNotification('Film został dodany do listy obejrzanych!');
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
    
}

// Initialize the app
const app = new MovieTracker();
