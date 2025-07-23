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
        document.querySelector('.hamburger').addEventListener('click', () => {
            document.querySelector('.nav-menu').classList.toggle('active');
        });

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

       // Dodaj te metody do klasy MovieTracker

// My List functionality
showMyList(status = 'all') {
    const container = document.getElementById('my-list-content');
    const typeFilter = document.getElementById('list-type-filter').value;
    const genreFilter = document.getElementById('list-genre-filter').value;
    const sortBy = document.getElementById('list-sort').value;
    
    let filteredMovies = [...this.watchedMovies];
    
    // Filter by status
    if (status !== 'all') {
        filteredMovies = filteredMovies.filter(movie => movie.status === status);
    }
    
    // Filter by type
    if (typeFilter) {
        filteredMovies = filteredMovies.filter(movie => movie.type === typeFilter);
    }
    
    // Filter by genre
    if (genreFilter) {
        filteredMovies = filteredMovies.filter(movie => 
            movie.genre.toLowerCase().includes(genreFilter.toLowerCase())
        );
    }
    
    // Sort movies
    this.sortMovies(filteredMovies, sortBy);
    
    // Update stats
    this.updateListStats(filteredMovies);
    
    // Display movies
    this.displayMyList(filteredMovies);
}

sortMovies(movies, sortBy) {
    switch (sortBy) {
        case 'date-desc':
            movies.sort((a, b) => new Date(b.watchedDate) - new Date(a.watchedDate));
            break;
        case 'date-asc':
            movies.sort((a, b) => new Date(a.watchedDate) - new Date(b.watchedDate));
            break;
        case 'title-asc':
            movies.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            movies.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'rating-desc':
            movies.sort((a, b) => b.rating - a.rating);
            break;
        case 'rating-asc':
            movies.sort((a, b) => a.rating - b.rating);
            break;
    }
}

displayMyList(movies) {
    const container = document.getElementById('my-list-content');
    const isGridView = document.getElementById('grid-view').classList.contains('active');
    
    container.className = isGridView ? 'my-list-grid' : 'my-list-list';
    
    if (movies.length === 0) {
        container.innerHTML = `
            <div class="empty-list">
                <i class="fas fa-film"></i>
                <h3>Brak filmów w tej kategorii</h3>
                <p>Dodaj filmy lub seriale do swojej listy</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = movies.map(movie => `
        <div class="list-item ${isGridView ? 'list-item-grid' : 'list-item-list'}" 
             data-movie-id="${movie.id}">
            ${movie.status ? `<span class="status-badge status-${movie.status}">${this.getStatusText(movie.status)}</span>` : ''}
            <img src="${movie.poster}" alt="${movie.title}">
            <div class="list-item-content">
                <h3>${movie.title}</h3>
                <p>${movie.year} • ${movie.genre}</p>
                <div class="list-item-meta">
                    <div class="list-item-rating">
                        <span class="stars">${'★'.repeat(movie.rating)}${'☆'.repeat(5-movie.rating)}</span>
                        <span>${movie.rating}/5</span>
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="action-btn edit-btn" onclick="app.editListItem(${movie.id})">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="action-btn delete-btn" onclick="app.removeFromList(${movie.id})">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

updateListStats(movies) {
    const count = movies.length;
    const totalHours = Math.round(movies.reduce((total, movie) => total + (movie.duration || 0), 0) / 60);
    
    document.getElementById('list-count').textContent = `${count} ${count === 1 ? 'pozycja' : 'pozycji'}`;
    document.getElementById('list-hours').textContent = `${totalHours} ${totalHours === 1 ? 'godzina' : 'godzin'}`;
}

getStatusText(status) {
    const statusTexts = {
        'watched': 'Obejrzane',
        'watching': 'Oglądane',
        'planning': 'Planowane',
        'dropped': 'Porzucone'
    };
    return statusTexts[status] || status;
}

editListItem(movieId) {
    const movie = this.watchedMovies.find(m => m.id === movieId);
    if (movie) {
        this.openMovieModal(movie, true);
    }
}

removeFromList(movieId) {
    if (confirm('Czy na pewno chcesz usunąć ten film z listy?')) {
        this.watchedMovies = this.watchedMovies.filter(m => m.id !== movieId);
        this.updateStats();
        this.displayRecentActivity();
        this.showMyList(this.getCurrentListStatus());
        this.showNotification('Film został usunięty z listy');
    }
}

getCurrentListStatus() {
    const activeTab = document.querySelector('.tab-btn.active');
    return activeTab ? activeTab.dataset.status : 'all';
}

addToList() {
    const modal = document.getElementById('movie-modal');
    const movie = modal.currentMovie;
    const status = document.getElementById('movie-status').value;
    const reviewText = document.getElementById('review-text').value;
    
    if (!status) {
        alert('Proszę wybrać status filmu');
        return;
    }
    
    const existingIndex = this.watchedMovies.findIndex(m => m.id === movie.id);
    
    const watchedItem = {
        ...movie,
        status: status,
        rating: this.currentRating,
        review: reviewText,
        watchedDate: new Date().toISOString().split('T')[0],
        duration: movie.duration || 120
    };
    
    if (existingIndex >= 0) {
        this.watchedMovies[existingIndex] = watchedItem;
        this.showNotification('Film został zaktualizowany!');
    } else {
        this.watchedMovies.push(watchedItem);
        this.showNotification('Film został dodany do listy!');
    }
    
    this.updateStats();
    this.displayRecentActivity();
    
    if (this.currentSection === 'my-list') {
        this.showMyList(this.getCurrentListStatus());
    }
    
    this.closeModal();
}

// Rozszerz metodę openMovieModal
openMovieModal(movie, isEdit = false) {
    const modal = document.getElementById('movie-modal');
    
    document.getElementById('modal-poster').src = movie.poster;
    document.getElementById('modal-title').textContent = movie.title;
    document.getElementById('modal-description').textContent = movie.description;
    document.getElementById('modal-year').textContent = movie.year;
    document.getElementById('modal-genre').textContent = movie.genre;
    document.getElementById('modal-duration').textContent = movie.duration ? `${movie.duration} min` : '';
    
    // Set existing data if editing
    if (isEdit && movie.status) {
        document.getElementById('movie-status').value = movie.status;
        this.currentRating = movie.rating || 0;
        document.getElementById('review-text').value = movie.review || '';
        
        // Show update/remove buttons instead of add button
        document.getElementById('add-to-list').style.display = 'none';
        document.getElementById('update-item').style.display = 'inline-block';
        document.getElementById('remove-from-list').style.display = 'inline-block';
    } else {
        document.getElementById('movie-status').value = '';
        this.currentRating = 0;
        document.getElementById('review-text').value = '';
        
        // Show add button
        document.getElementById('add-to-list').style.display = 'inline-block';
        document.getElementById('update-item').style.display = 'none';
        document.getElementById('remove-from-list').style.display = 'none';
    }
    
    this.highlightStars(this.currentRating);
    
    modal.style.display = 'block';
    modal.currentMovie = movie;
}

// W metodzie bindEvents() dodaj nowe event listenery:
bindEventsAdditions() {
    // My List tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            this.showMyList(e.target.dataset.status);
        });
    });
    
    // List filters
    document.getElementById('list-type-filter').addEventListener('change', () => {
        this.showMyList(this.getCurrentListStatus());
    });
    
    document.getElementById('list-genre-filter').addEventListener('change', () => {
        this.showMyList(this.getCurrentListStatus());
    });
    
    document.getElementById('list-sort').addEventListener('change', () => {
        this.showMyList(this.getCurrentListStatus());
    });
    
    // View toggle buttons
    document.getElementById('grid-view').addEventListener('click', () => {
        document.getElementById('grid-view').classList.add('active');
        document.getElementById('list-view').classList.remove('active');
        this.showMyList(this.getCurrentListStatus());
    });
    
    document.getElementById('list-view').addEventListener('click', () => {
        document.getElementById('list-view').classList.add('active');
        document.getElementById('grid-view').classList.remove('active');
        this.showMyList(this.getCurrentListStatus());
    });
    
    // Modal buttons
    document.getElementById('add-to-list').addEventListener('click', () => {
        this.addToList();
    });
    
    document.getElementById('update-item').addEventListener('click', () => {
        this.addToList();
    });
    
    document.getElementById('remove-from-list').addEventListener('click', () => {
        const movieId = document.getElementById('movie-modal').currentMovie.id;
        this.closeModal();
        this.removeFromList(movieId);
    });
}

// Rozszerz metodę loadMockData o statusy
loadMockDataExtended() {
    this.watchedMovies = [
        {
            id: 1,
            title: 'Incepcja',
            type: 'movie',
            year: 2010,
            genre: 'Sci-Fi',
            rating: 5,
            status: 'watched',
            watchedDate: '2024-01-15',
            poster: 'https://via.placeholder.com/200x300/4CAF50/white?text=Incepcja',
            description: 'Film o snach w snach',
            duration: 148
        },
        {
            id: 2,
            title: 'Breaking Bad',
            type: 'series',
            year: 2008,
            genre: 'Dramat',
            rating: 5,
            status: 'watched',
            watchedDate: '2024-01-10',
            poster: 'https://via.placeholder.com/200x300/2196F3/white?text=Breaking+Bad',
            description: 'Serial o nauczycielu chemii który zostaje producentem narkotyków',
            duration: 2940
        },
        {
            id: 3,
            title: 'Paragraf 22',
            type: 'movie',
            year: 2019,
            genre: 'Komedia',
            rating: 4,
            status: 'watching',
            watchedDate: '2024-01-05',
            poster: 'https://via.placeholder.com/200x300/FF9800/white?text=Paragraf+22',
            description: 'Komedia o absurdach biurokracji',
            duration: 119
        }
    }
    
}

// Initialize the app
const app = new MovieTracker();
    ];
