// Aplikacja MovieTracker
class MovieTracker {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
        this.watchedMovies = [];
        this.currentRating = 0;
        this.currentSection = 'dashboard';
        this.adminVerified = false;
        this.currentView = 'grid'; // Śledź aktualny tryb widoku
        this.tokenCheckInterval = null; // Sprawdzacz wygaśnięcia tokenu
        this.init(); 
    }
    // ============= KONIEC KONSTRUKTORA I INIT =============

    async init() {
        // Sprawdź czy użytkownik jest zalogowany
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

        // Pokaż sekcję admina jeśli użytkownik jest adminem
        if (this.currentUser && this.currentUser.role === 'admin') {
            const adminSection = document.getElementById('admin');
            if (adminSection) adminSection.style.display = '';
        }
        
        // Włącz przejścia po załadowaniu strony, aby zapobiec przejściu motywu przy załadowaniu
        setTimeout(() => {
            document.body.classList.add('transitions-enabled');
        }, 100);
    }
    // ============= BIND EVENTS =============
    bindEvents() {
        // Nawigacja
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

        // Przełącznik motywu
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Przycisk wylogowania
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Wybór motywu w profilu
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                let theme = e.target.value;
                // Baza akceptuje tylko 'light' lub 'dark'
                if (theme === 'auto') {
                    // Wykryj preferencje systemowe
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    theme = prefersDark ? 'dark' : 'light';
                }
                this.changeTheme(theme);
            });
        }

        // Przesłanie awatara
        const avatarWrapper = document.getElementById('avatar-wrapper');
        const avatarUpload = document.getElementById('avatar-upload');
        if (avatarWrapper && avatarUpload) {
            avatarWrapper.addEventListener('click', () => {
                avatarUpload.click();
            });
            avatarUpload.addEventListener('change', (e) => {
                this.uploadAvatar(e.target.files[0]);
            });
        }

        // Funkcjonalność wyszukiwania
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }

        if (searchInput) {
            // Wyszukiwanie po naciśnięciu Enter
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });

            // Sugestie na żywo podczas pisania (z opóźnieniem)
            let liveSearchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(liveSearchTimeout);
                const query = e.target.value.trim();
                if (query.length < 1) {
                    const resultsContainer = document.getElementById('search-results');
                    if (resultsContainer) resultsContainer.innerHTML = '';
                    return;
                }

                liveSearchTimeout = setTimeout(() => {
                    // Wykonaj wyszukiwanie
                    this.performSearch();
                }, 250);
            });
        }

        // Filtry
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

        // Zdarzenia modalne - obsłuż przycisk zamykający w modalu filmu
        document.querySelectorAll('#movie-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('movie-modal');
            if (modal && e.target === modal) {
                this.closeModal();
            }
        });

        // Gwiazdki oceny
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

        // Przycisk dodawania do listy (zmienione z add-to-watched na add-to-list)
        const addToListBtn = document.getElementById('add-to-list');
        if (addToListBtn) {
            addToListBtn.addEventListener('click', () => {
                this.addToWatched();
            });
        }

        // Przycisk aktualizacji elementu
        const updateItemBtn = document.getElementById('update-item');
        if (updateItemBtn) {
            updateItemBtn.addEventListener('click', () => {
                this.updateMovieItem();
            });
        }

        // Przycisk usuwania z listy
        const removeFromListBtn = document.getElementById('remove-from-list');
        if (removeFromListBtn) {
            removeFromListBtn.addEventListener('click', () => {
                this.removeFromList();
            });
        }

        // Przyciski zakładek dla sekcji Moja Lista
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Usuń klasę active ze wszystkich przycisków zakładek
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                // Dodaj klasę active do klikniętego przycisku
                e.target.classList.add('active');
                
                // Filtruj listę na podstawie wybranej zakładki
                const status = e.target.dataset.status;
                this.filterMyList(status);
            });
        });

        // Przyciski sterowania widokiem (widok siatki/listy)
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const button = e.currentTarget;
                const viewMode = button.dataset.view;
                
                // Usuń klasę active ze wszystkich przycisków widoku
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                // Dodaj klasę active do klikniętego przycisku
                button.classList.add('active');
                
                // Zmień tryb widoku
                this.changeViewMode(viewMode);
            });
        });

        // Menu mobilne
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

        // Generuj opcje roku dla filtra
        this.generateYearOptions();
        
        // Event listenery dla profilu
        this.bindProfileEvents();
        
        // Kliknięcia elementów listy - deleguj do kontenera
        const myListContainer = document.getElementById('my-list-content');
        if (myListContainer) {
            myListContainer.addEventListener('click', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem) {
                    const itemId = parseInt(listItem.dataset.id);
                    // Zawsze otwieraj normalny modal edycji (również dla seriali)
                    this.editItem(itemId);
                }
            });
        }
        
        // Przyciski zakładek modalnych
        document.querySelectorAll('.modal-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchModalTab(tab);
            });
        });
        
        // Powiązania panelu admina (jeśli admin)
        if (this.currentUser && this.currentUser.role === 'admin') {
            this.bindAdminEvents();
        }
    }
    // ============= KONIEC BIND EVENTS =============

    showSection(sectionName) {
        // Panel admina wymaga weryfikacji hasła
        if (sectionName === 'admin' && !this.adminVerified) {
            this.showAdminPasswordPrompt();
            return;
        }

        // Ukryj wszystkie sekcje
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Pokaż wybraną sekcję (bezpiecznie — sprawdź istnienie)
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
        } else {
            console.warn('showSection: section not found:', sectionName);
        }

        // Zaktualizuj nawigację (bezpiecznie)
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const navLink = document.querySelector(`[href="#${sectionName}"]`);
        if (navLink) navLink.classList.add('active');

        // Ładuj dane specyficzne dla sekcji
        if (sectionName === 'statistics') {
            this.loadCharts();
        } else if (sectionName === 'my-list') {
            this.displayMyList();
        } else if (sectionName === 'profile') {
            this.loadProfileData();
        } else if (sectionName === 'challenges') {
            this.loadChallenges();
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
        
        // Motyw powinien być już ustawiony przez skrypt inline, po prostu zaktualizuj ikonę i wybór
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = actualTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
        
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = savedTheme; // Ustaw zapisaną opcję, nie rzeczywisty motyw
        }
        
        // Nasłuchuj zmian motywu systemowego gdy wybrano auto
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
        
        // Obsłuż automatyczny motyw na podstawie preferencji systemowych
        if (theme === 'auto') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        // Zaktualizuj zarówno klasę body jak i html dla spójności
        document.body.className = `${actualTheme}-theme transitions-enabled`;
        document.documentElement.className = `${actualTheme}-theme`;
        
        // Zapisz w localStorage (zapisz wybraną opcję, nie rzeczywisty motyw)
        localStorage.setItem('theme', theme);
        
        // Zaktualizuj ikonę przycisku przełączania motywu
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = actualTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
        
        // Zaktualizuj wybór motywu w profilu
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }
        
        console.log('Theme changed to:', theme, '(actual:', actualTheme + ')');

        // Zachowaj preferencję dla zalogowanych użytkowników
        if (this.authToken) {
            fetch('/api/auth/theme', {
                method: 'POST',
                headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme_preference: theme })
            }).then(async (res) => {
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    console.warn('Failed to persist theme preference:', err);
                    return;
                }
                const json = await res.json();
                if (json && json.user) {
                    this.currentUser = json.user; // zaktualizuj buforowanego użytkownika
                }
            }).catch(err => {
                console.warn('Error saving theme preference:', err);
            });
        }
    }

    loadUserData() {
        // Zaktualizuj interfejs danymi bieżącego użytkownika (załadowane z uwierzytelnienia)
        if (this.currentUser) {
            document.getElementById('username').textContent = this.currentUser.nickname;
            const profileUsername = document.getElementById('profile-username');
            const profileEmail = document.getElementById('profile-email');
            
            if (profileUsername) profileUsername.textContent = this.currentUser.nickname;
            if (profileEmail) profileEmail.textContent = this.currentUser.email;
            // Ustaw rok członkostwa na podstawie daty utworzenia konta (jeśli dostępna), inaczej użyj bieżącego roku
            const memberSinceEl = document.getElementById('member-since');
            if (memberSinceEl) {
                const rawDate = this.currentUser.created_at || this.currentUser.createdAt || this.currentUser.registered_at || this.currentUser.registeredAt || this.currentUser.joined_at || null;
                let year = null;
                if (rawDate) {
                    try {
                        // spróbuj znormalizować
                        year = this.normalizeYear(String(rawDate));
                    } catch (e) {
                        year = null;
                    }
                }
                if (!year) year = String(new Date().getFullYear());
                memberSinceEl.textContent = year;
            }
            
            // Załaduj awatar jeśli istnieje
            const userAvatar = document.getElementById('user-avatar');
            if (userAvatar && this.currentUser.avatar_url) {
                userAvatar.src = this.currentUser.avatar_url;
            }

            // Pokaż nawigację admina jeśli użytkownik jest adminem
            if (this.currentUser.role === 'admin') {
                const adminNavItem = document.getElementById('admin-nav-item');
                if (adminNavItem) adminNavItem.style.display = 'block';
            }
        }
    }

    async uploadAvatar(file) {
        if (!file) return;
        
        // Zweryfikuj typ pliku
        if (!file.type.startsWith('image/')) {
            alert('Proszę wybrać plik obrazu');
            return;
        }
        
        // Zweryfikuj rozmiar pliku (maks. 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Rozmiar pliku nie może przekraczać 2MB');
            return;
        }
        
        try {
            // Utwórz FormData
            const formData = new FormData();
            formData.append('avatar', file);
            
            const response = await fetch('/api/auth/avatar', {
                method: 'POST',
                headers: {
                    'Authorization': this.getAuthHeaders()['Authorization']
                    // Nie ustawiaj Content-Type - przeglądarka ustawi go z granicą dla FormData
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Nie udało się zaktualizować avatara');
            }
            
            const data = await response.json();
            
            // Zaktualizuj interfejs
            const userAvatar = document.getElementById('user-avatar');
            if (userAvatar) {
                userAvatar.src = data.avatar_url;
            }
            
            // Zaktualizuj bieżącego użytkownika
            this.currentUser.avatar_url = data.avatar_url;
            
            alert('Avatar został zaktualizowany!');
        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Błąd podczas przesyłania avatara: ' + error.message);
        }
    }

    // ============= FUNKCJE PROFILU =============

    bindProfileEvents() {
        // Zakładki profilu
        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.profileTab;
                this.switchProfileTab(tabName);
            });
        });

        // Przycisk dodawania znajomego
        const addFriendBtn = document.getElementById('add-friend-btn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', () => {
                this.openAddFriendModal();
            });
        }

        // Zamknięcie modalu (przycisk X) - dopasuj do rzeczywistej klasy w HTML
        const closeModalBtn = document.querySelector('#add-friend-modal .close');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeAddFriendModal();
            });
        }

        // Zamknięcie modalu przez kliknięcie tła
        const addFriendModal = document.getElementById('add-friend-modal');
        if (addFriendModal) {
            addFriendModal.addEventListener('click', (e) => {
                if (e.target === addFriendModal) {
                    this.closeAddFriendModal();
                }
            });
        }

        // Wyszukiwanie użytkowników (debounced)
        const userSearchInput = document.getElementById('friend-search-input');
        if (userSearchInput) {
            let searchTimeout;
            userSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                const resultsContainer = document.getElementById('friend-search-results');

                // Wyczyść wyniki jeśli zapytanie jest puste
                if (query.length < 2) {
                    if (resultsContainer) {
                        resultsContainer.innerHTML = '<p class="help-text">Wpisz co najmniej 2 znaki, aby wyszukać użytkowników.</p>';
                    }
                    return;
                }

                // Pokaż komunikat szukania
                if (resultsContainer) resultsContainer.innerHTML = '<p class="searching">Szukam...</p>';
                searchTimeout = setTimeout(() => {
                    this.searchUsers(query);
                }, 300);
            });
        }

        // Zobacz wszystkie odznaki
        const viewAllBadgesBtn = document.getElementById('view-all-badges');
        if (viewAllBadgesBtn) {
            viewAllBadgesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAllBadges();
            });
        }

        // Zmiana hasła
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                this.showChangePasswordModal();
            });
        }

        // Usunięcie konta
        const deleteAccountBtn = document.getElementById('delete-account-btn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                this.showDeleteAccountModal();
            });
        }
    }

    switchProfileTab(tabName) {
        // Usuń active ze wszystkich zakładek
        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.profile-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Aktywuj wybraną zakładkę
        const activeBtn = document.querySelector(`[data-profile-tab="${tabName}"]`);
        const activeContent = document.getElementById(`profile-${tabName}-tab`);
        
        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    async loadProfileData() {
        // Załaduj wszystkie dane profilu
        await Promise.all([
            this.loadBadges(),
            this.loadFriends(),
            this.loadFriendRequests()
        ]);
    }

    async loadChallenges() {
        try {
            const response = await fetch('/api/challenges', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Nie udało się załadować wyzwań');
            }

            const challenges = await response.json();
            this.displayChallenges(challenges);
        } catch (error) {
            console.error('Error loading challenges:', error);
            this.displayChallenges([]);
        }
    }

    displayChallenges(challenges) {
        const container = document.getElementById('challenges-container');
        if (!container) return;

        if (!Array.isArray(challenges) || challenges.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-flag" style="font-size:48px;color:#ccc;margin-bottom:12px"></i>
                    <h3>Brak aktywnych wyzwań</h3>
                    <p>Sprawdź ponownie później lub zobacz odznaki.</p>
                    <button class="btn btn-primary" onclick="app.showSection('badges-all')">Zobacz odznaki</button>
                </div>
            `;
            return;
        }

        container.innerHTML = challenges.map(ch => `
            <div class="challenge-card">
                <h3>${ch.title}</h3>
                <p class="challenge-desc">${ch.description || ''}</p>
                <div class="challenge-meta">
                    <span>${ch.type || ''}</span>
                    <span>Cel: ${ch.target_count || '-'}</span>
                    <span>${ch.start_date ? this.formatDate(ch.start_date) : ''} - ${ch.end_date ? this.formatDate(ch.end_date) : ''}</span>
                </div>
            </div>
        `).join('');
    }

    async showAllBadges() {
        this.showSection('badges-all');
        await this.loadAllBadges();
    }

    async loadAllBadges() {
        try {
            const response = await fetch('/api/badges', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Nie udało się załadować odznak');
            }

            const badges = await response.json();
            this.displayAllBadges(badges);
        } catch (error) {
            console.error('Error loading all badges:', error);
            this.displayAllBadges([]);
        }
    }

    displayAllBadges(badges) {
        const container = document.getElementById('all-badges-container');
        if (!container) return;

        // Zaktualizuj statystyki
        document.getElementById('total-badges-count').textContent = badges.length;
        document.getElementById('platinum-badges-count').textContent = 
            badges.filter(b => b.level === 'platinum').length;
        document.getElementById('gold-badges-count').textContent = 
            badges.filter(b => b.level === 'gold').length;
        document.getElementById('silver-badges-count').textContent = 
            badges.filter(b => b.level === 'silver').length;

        if (badges.length === 0) {
            container.innerHTML = `
                <div class="no-badges-message">
                    <i class="fas fa-award" style="font-size: 4rem; color: #ccc; margin-bottom: 1rem;"></i>
                    <h3>Nie masz jeszcze żadnych odznak</h3>
                    <p>Ukończ wyzwania, aby zdobyć odznaki!</p>
                    <button class="btn btn-primary" onclick="app.showSection('challenges')">
                        <i class="fas fa-trophy"></i> Zobacz wyzwania
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = badges.map(badge => `
            <div class="badge-item-full">
                <div class="badge-icon">
                    ${badge.image_url || badge.imageUrl 
                        ? `<img src="${badge.image_url || badge.imageUrl}" alt="${badge.name}">` 
                        : '<i class="fas fa-award"></i>'
                    }
                </div>
                <div class="badge-details">
                    <h4>${badge.name}</h4>
                    <span class="badge-level ${badge.level}">${this.getBadgeLevelText(badge.level)}</span>
                    ${badge.description ? `<p class="badge-description">${badge.description}</p>` : ''}
                    <span class="badge-earned-date">
                        <i class="fas fa-calendar"></i> Zdobyte: ${this.formatDate(badge.earned_at)}
                    </span>
                </div>
            </div>
        `).join('');
    }

    async loadBadges() {
        try {
            const response = await fetch('/api/badges?limit=6', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Nie udało się załadować odznak');
            }

            const badges = await response.json();
            this.displayBadges(badges);
        } catch (error) {
            console.error('Error loading badges:', error);
            this.displayBadges([]);
        }
    }

    displayBadges(badges) {
        const container = document.getElementById('badges-container');
        if (!container) return;

        if (badges.length === 0) {
            // Pokaż placeholder
            container.innerHTML = `
                <div class="badge-item badge-placeholder">
                    <i class="fas fa-award"></i>
                    <span>Zdobądź odznakę!</span>
                </div>
                <div class="badge-item badge-placeholder">
                    <i class="fas fa-award"></i>
                    <span>Zdobądź odznakę!</span>
                </div>
                <div class="badge-item badge-placeholder">
                    <i class="fas fa-award"></i>
                    <span>Zdobądź odznakę!</span>
                </div>
            `;
            return;
        }

        container.innerHTML = badges.map(badge => `
            <div class="badge-item">
                ${badge.image_url || badge.imageUrl 
                    ? `<img src="${badge.image_url || badge.imageUrl}" alt="${badge.name}">` 
                    : '<i class="fas fa-award"></i>'
                }
                <h4>${badge.name}</h4>
                <span class="badge-level ${badge.level}">${this.getBadgeLevelText(badge.level)}</span>
            </div>
        `).join('');
    }

    getBadgeLevelText(level) {
        const levels = {
            'silver': 'Srebrna',
            'gold': 'Złota',
            'platinum': 'Platynowa',
            'none': 'Podstawowa'
        };
        return levels[level] || level;
    }

    formatDate(dateString) {
        if (!dateString) return 'Nieznana data';
        const date = new Date(dateString);
        return date.toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Znormalizuj pole roku tak, aby zwracać tylko rok (lub oryginalny zakres),
    // zamiast pełnej daty typu 1985-01-01. Przydatne gdy backend zapisuje
    // release_date jako pełną datę, a w UI chcemy wyświetlać tylko rok.
    normalizeYear(value) {
        if (!value && value !== 0) return null;
        if (typeof value === 'number') return String(value);
        if (typeof value !== 'string') return null;

        const v = value.trim();
        if (v === '') return null;

        // Dokładny rok
        if (/^\d{4}$/.test(v)) return v;

        // Pełna data ISO YYYY-MM-DD -> zwróć rok
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.substr(0, 4);

        // Zakresy jak 2008-2013 lub 2025-teraz - zostaw bez zmian
        if (/^\d{4}-\d{4}$/.test(v) || /^\d{4}-\D+/.test(v)) return v;

        // Spróbuj sparsować jako data i wyciągnąć rok
        const d = new Date(v);
        if (!isNaN(d.getTime())) return String(d.getFullYear());

        // Wypatruj pierwszego wystąpienia czterech cyfr (fallback)
        const m = v.match(/\d{4}/);
        return m ? m[0] : v;
    }

    // Zwraca poprawny URL plakatu z obiektu (PRIORYTET: `poster_url` z bazy).
    // Jeśli brak, generuje placeholder używając placehold.co (z tytułem filmu).
    // Zapisuje znormalizowany URL do `item.poster` dla wygody frontendu.
    getPosterUrl(item) {
        const origin = window.location ? window.location.origin : '';
        if (!item) return this._generatePlaceholderUrl('Brak');

        let p = null;
        // Preferuj `poster_url` (pochodzące z bazy). Jeśli API zwraca `poster`, zaakceptuj je jako fallback.
        if (typeof item.poster_url === 'string' && item.poster_url.trim() !== '') {
            p = item.poster_url.trim();
        } else if (typeof item.poster === 'string' && item.poster.trim() !== '') {
            p = item.poster.trim();
        }

        if (!p) {
            // Użyj tytułu, jeśli dostępny, aby stworzyć czytelny placeholder
            const title = item.title ? String(item.title) : 'No Image';
            p = this._generatePlaceholderUrl(title);
        }

        if (p.startsWith('/')) p = origin + p;
        item.poster = p;
        return p;
    }

    _generatePlaceholderUrl(title) {
        const text = encodeURIComponent(title || 'No Image');
        // Rozmiar 300x450 — używany jako uniwersalny placeholder
        return `https://placehold.co/300x450/cccccc/000000/png?text=${text}`;
    }

    async loadFriends() {
        try {
            const response = await fetch('/api/friends?status=accepted', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Nie udało się załadować znajomych');
            }

            const friends = await response.json();
            this.displayFriends(friends);
            this.updateFriendsStats(friends.length);
        } catch (error) {
            console.error('Error loading friends:', error);
            this.displayFriends([]);
            this.updateFriendsStats(0);
        }
    }

    displayFriends(friends) {
        const container = document.getElementById('friends-list');
        if (!container) return;
        const headerAddBtn = document.getElementById('add-friend-btn');

        if (friends.length === 0) {
            // Ukryj przycisk dodawania w nagłówku, aby uniknąć duplikacji z akcją w stanie pustym
            if (headerAddBtn) headerAddBtn.style.display = 'none';

            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-friends"></i>
                    <p class="empty-state-text">Nie masz jeszcze znajomych</p>
                    <button class="btn btn-primary" onclick="document.getElementById('add-friend-btn').click()">
                        Dodaj znajomego
                    </button>
                </div>
            `;
            // wyśrodkuj zawartość kontenera
            container.classList.add('empty-center');
            return;
        }

        // W trakcie normalnego wyświetlania znajomych, pokaż przycisk dodawania w nagłówku
        if (headerAddBtn) headerAddBtn.style.display = '';
        container.classList.remove('empty-center');

        container.innerHTML = friends.map(friend => `
            <div class="friend-card">
                <img src="${friend.avatar_url || '/images/default-avatar.png'}" alt="${friend.nickname}">
                <div class="friend-info">
                    <h4>${friend.nickname}</h4>
                    <p>${friend.total_movies || 0} filmów</p>
                </div>
                <div class="friend-actions">
                    <button class="btn-icon" onclick="app.viewFriendProfile(${friend.user_id})" title="Zobacz profil">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="app.removeFriend(${friend.friendship_id})" title="Usuń znajomego">
                        <i class="fas fa-user-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateFriendsStats(count) {
        const statsCount = document.getElementById('friends-count');
        if (statsCount) {
            statsCount.textContent = count;
        }
    }

    async loadFriendRequests() {
        try {
            const response = await fetch('/api/friends?status=pending', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Nie udało się załadować zaproszeń');
            }

            const requests = await response.json();
            // Filtruj tylko zaproszenia otrzymane (nie wysłane)
            const receivedRequests = requests.filter(r => r.request_direction === 'received');
            
            // Zaktualizuj licznik
            const pendingCount = document.getElementById('pending-requests-count');
            if (pendingCount) {
                pendingCount.textContent = receivedRequests.length;
            }
            
            this.displayFriendRequests(receivedRequests);
        } catch (error) {
            console.error('Error loading friend requests:', error);
            this.displayFriendRequests([]);
        }
    }

    displayFriendRequests(requests) {
        const container = document.getElementById('friend-requests-list');
        const section = document.getElementById('friend-requests-section');
        
        if (!container) return;

        if (requests.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }

        if (section) section.style.display = 'block';

        container.innerHTML = requests.map(request => `
            <div class="friend-request-item">
                <img src="${request.avatar_url || '/images/default-avatar.png'}" alt="${request.nickname}">
                <div class="request-info">
                    <h4>${request.nickname}</h4>
                    <p>Wysłano ${this.formatDate(request.requested_at)}</p>
                </div>
                <div class="request-actions">
                    <button class="btn btn-primary btn-sm" onclick="app.acceptFriendRequest(${request.friendship_id})">
                        Akceptuj
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="app.rejectFriendRequest(${request.friendship_id})">
                        Odrzuć
                    </button>
                </div>
            </div>
        `).join('');
    }

    openAddFriendModal() {
        const modal = document.getElementById('add-friend-modal');
        if (modal) {
            // Użyj display block zamiast klasy, aby uniknąć konfliktów z animacjami
            modal.style.display = 'block';
            const searchInput = document.getElementById('friend-search-input');
            if (searchInput) searchInput.focus();
        }
    }

    closeAddFriendModal() {
        const modal = document.getElementById('add-friend-modal');
        if (modal) {
            modal.style.display = 'none';
            const searchInput = document.getElementById('friend-search-input');
            if (searchInput) searchInput.value = '';
            document.getElementById('friend-search-results').innerHTML = '';
        }
    }

    async searchUsers(query) {
        try {
            const resultsContainer = document.getElementById('friend-search-results');
            console.log('[searchUsers] Query:', query);
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`, {
                headers: this.getAuthHeaders()
            });
            console.log('[searchUsers] Response status:', response.status);

            if (!response.ok) {
                // Jeśli brak autoryzacji, pokaż przyjazny komunikat
                if (response.status === 401) {
                    if (resultsContainer) resultsContainer.innerHTML = '<p class="search-error">Wymagana autoryzacja — zaloguj się.</p>';
                    console.warn('[searchUsers] Unauthorized (401)');
                    return;
                }
                // Pokaż komunikat błędu w UI
                if (resultsContainer) resultsContainer.innerHTML = '<p class="search-error">Błąd wyszukiwania</p>';
                throw new Error('Nie udało się wyszukać użytkowników');
            }

            let data;
            try {
                data = await response.json();
            } catch (e) {
                console.warn('[searchUsers] Failed to parse JSON response', e);
                if (resultsContainer) resultsContainer.innerHTML = '<p class="search-error">Błąd odczytu odpowiedzi</p>';
                return;
            }
            console.log('[searchUsers] Response data:', data);
            // Obsłuż różne formaty odpowiedzi: tablica, { results: [] }, { users: [] }, { data: [] }
            let users = [];
            if (Array.isArray(data)) {
                users = data;
            } else if (Array.isArray(data.results)) {
                users = data.results;
            } else if (Array.isArray(data.users)) {
                users = data.users;
            } else if (Array.isArray(data.data)) {
                users = data.data;
            } else if (Array.isArray(data.items)) {
                users = data.items;
            } else {
                // próbuj znaleźć pierwszą tablicę wewnątrz obiektu
                for (const k of Object.keys(data || {})) {
                    if (Array.isArray(data[k])) {
                        users = data[k];
                        break;
                    }
                }
            }

            this.displaySearchResults(users || []);
        } catch (error) {
            console.error('Error searching users:', error);
            const resultsContainer = document.getElementById('friend-search-results');
            if (resultsContainer) resultsContainer.innerHTML = '<p class="search-error">Błąd wyszukiwania</p>';
        }
    }

    displaySearchResults(users) {
        const container = document.getElementById('friend-search-results');
        if (!container) return;
        // Upewnij się, że mamy tablicę
        if (!Array.isArray(users)) users = [];

        if (users.length === 0) {
            container.innerHTML = '<p class="no-results">Nie znaleziono użytkowników</p>';
            return;
        }

        container.innerHTML = users.map(user => {
            const avatar = user.avatar_url || user.avatar || user.avatarUrl || '/images/default-avatar.png';
            const nickname = user.nickname || user.name || user.login || 'Użytkownik';
            const total = user.total_movies || user.totalMovies || 0;
            const id = user.id || user.user_id || user.userId || user.uid || 0;
            const normalized = { ...user, id, avatar_url: avatar, nickname };
            return `
            <div class="user-search-item">
                <img src="${avatar}" alt="${nickname}">
                <div class="user-info">
                    <h4>${nickname}</h4>
                    <p>${total} filmów</p>
                </div>
                ${this.getFriendshipButton(normalized)}
            </div>
        `}).join('');
    }

    getFriendshipButton(user) {
        const status = user.friendship_status || user.friendshipStatus || null;
        if (status === 'accepted') {
            return '<span class="friendship-status accepted">Znajomy</span>';
        } else if (status === 'pending') {
            return '<span class="friendship-status pending">Oczekujące</span>';
        } else {
            return `<button class="btn btn-primary btn-sm" onclick="app.sendFriendRequest(${user.id})">Dodaj</button>`;
        }
    }

    async sendFriendRequest(userId) {
        try {
            const response = await fetch('/api/friends', {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friendId: userId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Nie udało się wysłać zaproszenia');
            }

            // Odśwież wyniki wyszukiwania
            const query = document.getElementById('friend-search-input').value;
            if (query) {
                await this.searchUsers(query);
            }

            alert('Zaproszenie zostało wysłane!');
        } catch (error) {
            console.error('Error sending friend request:', error);
            alert('Błąd: ' + error.message);
        }
    }

    async acceptFriendRequest(friendshipId) {
        try {
            const response = await fetch('/api/friends', {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    friendshipId: friendshipId,
                    action: 'accept'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Nie udało się zaakceptować zaproszenia');
            }

            // Odśwież listy
            await Promise.all([
                this.loadFriends(),
                this.loadFriendRequests()
            ]);

            alert('Zaproszenie zostało zaakceptowane!');
        } catch (error) {
            console.error('Error accepting friend request:', error);
            alert('Błąd: ' + error.message);
        }
    }

    async rejectFriendRequest(friendshipId) {
        try {
            const response = await fetch('/api/friends', {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    friendshipId: friendshipId,
                    action: 'reject'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Nie udało się odrzucić zaproszenia');
            }

            // Odśwież listę zaproszeń
            await this.loadFriendRequests();

            alert('Zaproszenie zostało odrzucone');
        } catch (error) {
            console.error('Error rejecting friend request:', error);
            alert('Błąd: ' + error.message);
        }
    }

    async removeFriend(friendshipId) {
        if (!confirm('Czy na pewno chcesz usunąć tego znajomego?')) {
            return;
        }

        try {
            const response = await fetch('/api/friends', {
                method: 'DELETE',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friendshipId: friendshipId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Nie udało się usunąć znajomego');
            }

            // Odśwież listę znajomych
            await this.loadFriends();

            alert('Znajomy został usunięty');
        } catch (error) {
            console.error('Error removing friend:', error);
            alert('Błąd: ' + error.message);
        }
    }

    viewFriendProfile(userId) {
        // TODO: Implementacja strony profilu znajomego
        alert(`Profil użytkownika #${userId} będzie dostępny wkrótce!`);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Dzisiaj';
        if (days === 1) return 'Wczoraj';
        if (days < 7) return `${days} dni temu`;
        if (days < 30) return `${Math.floor(days / 7)} tyg. temu`;
        if (days < 365) return `${Math.floor(days / 30)} mies. temu`;
        return date.toLocaleDateString('pl-PL');
    }

    showChangePasswordModal() {
        // Customowy modal do zmiany hasła
        const modalHtml = `
            <div class="modal active" id="change-password-modal">
                <div class="modal-content">
                    <h2>Zmiana hasła</h2>
                    <form id="change-password-form">
                        <div class="form-group">
                            <label>Obecne hasło</label>
                            <input type="password" id="current-password" required>
                        </div>
                        <div class="form-group">
                            <label>Nowe hasło</label>
                            <input type="password" id="new-password" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label>Potwierdź nowe hasło</label>
                            <input type="password" id="confirm-password" required minlength="6">
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" id="cancel-password-change">Anuluj</button>
                            <button type="submit" class="btn-primary">Zmień hasło</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('change-password-modal');
        const form = document.getElementById('change-password-form');
        const cancelBtn = document.getElementById('cancel-password-change');
        
        const closeModal = () => modal.remove();
        
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                this.showNotification('Hasła nie są identyczne!', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                this.showNotification('Nowe hasło musi mieć minimum 6 znaków!', 'error');
                return;
            }
            
            // Wywołanie API zmiany hasła
            const success = await this.changePassword(currentPassword, newPassword);
            if (success) {
                closeModal();
            }
        });
    }

    showDeleteAccountModal() {
        // Customowy modal do usuwania konta
        const modalHtml = `
            <div class="modal active" id="delete-account-modal">
                <div class="modal-content">
                    <h2 style="color: #dc3545;">⚠️ Usuń konto</h2>
                    <p><strong>UWAGA! Ta operacja jest nieodwracalna!</strong></p>
                    <p>Wszystkie Twoje dane, filmy, recenzje i postępy zostaną trwale usunięte.</p>
                    <form id="delete-account-form">
                        <div class="form-group">
                            <label>Aby potwierdzić, wpisz: <strong>USUN KONTO</strong></label>
                            <input type="text" id="delete-confirmation" required placeholder="USUN KONTO">
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" id="cancel-delete">Anuluj</button>
                            <button type="submit" class="btn-danger">Usuń konto</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('delete-account-modal');
        const form = document.getElementById('delete-account-form');
        const cancelBtn = document.getElementById('cancel-delete');
        
        const closeModal = () => modal.remove();
        
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const confirmation = document.getElementById('delete-confirmation').value;
            
            if (confirmation === 'USUN KONTO') {
                closeModal();
                this.deleteAccount();
            } else {
                this.showNotification('Nieprawidłowe potwierdzenie. Konto nie zostało usunięte.', 'error');
            }
        });
    }

    async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Nie udało się zmienić hasła');
            }

            this.showNotification('Hasło zostało zmienione pomyślnie!', 'success');
            return true;
        } catch (error) {
            console.error('Error changing password:', error);
            this.showNotification('Błąd: ' + error.message, 'error');
            return false;
        }
    }

    async deleteAccount() {
        try {
            const response = await fetch('/api/auth/delete', {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Nie udało się usunąć konta');
            }

            this.showNotification('Konto zostało usunięte. Żegnamy!', 'success');
            setTimeout(() => this.logout(), 1500);
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showNotification('Błąd podczas usuwania konta: ' + error.message, 'error');
        }
    }

    // ============= KONIEC FUNKCJI PROFILU =============


    async loadMoviesData() {
        try {
            // Załaduj WSZYSTKIE filmy (obejrzane, oglądane, planowane, porzucone)
            const response = await fetch('/api/movies?status=all', {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                this.watchedMovies = await response.json();
                // Znormalizuj pole `year` dla wygodnego wyświetlania w UI.
                this.watchedMovies = this.watchedMovies.map(item => {
                    const raw = item.year || item.release_date || item.releaseDate || null;
                    const normalized = this.normalizeYear(raw);
                    // Normalizuj też pole plakatu — użyj helpera, który obsługuje różne pola
                    const poster = this.getPosterUrl(item);

                    // Normalizuj pola seriali: liczba sezonów/odcinków, średnia długość odcinka
                    const avgEp = item.avg_episode_length || item.avgEpisodeLength || item.average_episode_length || item.episode_length || item.episodeLength || item.avgEpisodeMinutes || item.duration || null;
                    let totalEpisodes = item.totalEpisodes || item.total_episodes || item.episodesCount || item.episodes_total || null;
                    let totalSeasons = item.totalSeasons || item.total_seasons || null;

                    // Jeśli API zwraca strukturę seasons, policz odcinki
                    if ((!totalEpisodes || !totalSeasons) && Array.isArray(item.seasons)) {
                        totalSeasons = totalSeasons || item.seasons.length;
                        totalEpisodes = totalEpisodes || item.seasons.reduce((acc, s) => acc + (Array.isArray(s.episodes) ? s.episodes.length : 0), 0);
                    }

                    const watchedEpisodes = item.watchedEpisodes || item.watched_episodes || item.watched_count || item.watched || 0;

                    // Ustal ujednolicone pola na obiekcie
                    return {
                        ...item,
                        year: normalized || (item.year || raw),
                        poster,
                        avgEpisodeLength: avgEp ? Number(avgEp) : null,
                        totalEpisodes: totalEpisodes ? Number(totalEpisodes) : (item.totalEpisodes ? Number(item.totalEpisodes) : null),
                        totalSeasons: totalSeasons ? Number(totalSeasons) : (item.totalSeasons ? Number(item.totalSeasons) : null),
                        watchedEpisodes: Number(watchedEpisodes) || 0
                    };
                });
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
            // Usuń klasę siatki dla pustego stanu
            listContainer.classList.remove('my-list-grid');
            listContainer.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-film"></i>
                    <h3>Brak elementów</h3>
                    <p>Nie masz jeszcze żadnych filmów lub seriali w tej kategorii.</p>
                </div>
            `;
            return;
        }

        // Dodaj klasę siatki gdy są elementy
        listContainer.classList.add('my-list-grid');

        filteredItems.forEach(item => {
            const statusBadge = this.getStatusBadge(item.status || 'watched');
            const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
            // Upewnij się, że mamy poprawny URL plakatu — użyj helpera, który obsługuje różne pola
            const poster = this.getPosterUrl(item);

            // Dane serialu
            const seasons = item.totalSeasons || (Array.isArray(item.seasons) ? item.seasons.length : null);
            const episodes = item.totalEpisodes || (Array.isArray(item.seasons) ? item.seasons.reduce((acc, s) => acc + (Array.isArray(s.episodes) ? s.episodes.length : 0), 0) : null);
            const avg = item.avgEpisodeLength || item.avg_episode_length || item.duration || null;

            // Tekst z typem i dodatkowymi informacjami (minuty dla filmu, sezony/odcinki dla serialu)
            const typeInfo = item.type === 'movie'
                ? (item.duration ? `${item.duration} min` : 'Film')
                : `${seasons ? seasons + ' sez.' : 'Serial'} • ${episodes ? episodes + ' odc.' : ''}`;

            // Informacje o postępie dla seriali
            const progressInfo = item.type === 'series'
                ? `<p class="series-progress">
                       <i class="fas fa-tv"></i>
                       ${item.watchedEpisodes || 0}/${episodes || 0} odcinków (${item.progress || 0}%)
                       <div class="progress-bar">
                         <div class="progress-fill" style="width: ${item.progress || 0}%"></div>
                       </div>
                   </p>`
                : '';

            const viewClass = this.currentView === 'list' ? 'list-item-list' : 'list-item-grid';
            const listItemHtml = `
                <div class="list-item ${viewClass}" data-status="${item.status || 'watched'}" data-id="${item.id}" data-type="${item.type}">
                    ${statusBadge}
                    <img src="${poster}" alt="${item.title}" class="list-item-poster">
                    ${this.currentView === 'list' ? `
                    <div class="list-item-info">
                        <h3>${item.title}</h3>
                        <p>${item.year} • ${item.genre} • ${typeInfo}</p>
                        ${progressInfo}
                        <div class="list-item-rating">
                            <span class="stars">${stars}</span>
                            <span>${item.rating}/5</span>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            listContainer.innerHTML += listItemHtml;
        });

        // Zaktualizuj statystyki
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
            const poster = this.getPosterUrl(item);
            activityItem.innerHTML = `
                <img src="${poster}" alt="${item.title}">
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
        // Licz tylko filmy/seriale ze statusem 'watched'
        const movies = this.watchedMovies.filter(item => item.type === 'movie' && item.status === 'watched');
        const series = this.watchedMovies.filter(item => item.type === 'series' && item.status === 'watched');
        // Oblicz czas oglądania w minutach uwzględniając filmy i seriale
        let totalMinutes = 0;
        this.watchedMovies.forEach(item => {
            if (item.type === 'movie') {
                const dur = item.duration || item.runtime || item.durationMinutes || 0;
                totalMinutes += Number(dur) || 0;
            } else if (item.type === 'series') {
                const avg = item.avgEpisodeLength || item.avg_episode_length || item.duration || 0;
                const watched = item.watchedEpisodes || item.watched_episodes || item.watched_count || 0;
                if (watched && avg) {
                    totalMinutes += Number(avg) * Number(watched);
                } else if ((item.status === 'watched' || item.status === 'completed') && item.totalEpisodes && avg) {
                    totalMinutes += Number(avg) * Number(item.totalEpisodes);
                }
            }
        });
        const totalHours = Math.round(totalMinutes / 60);
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
            // Użyj API wyszukiwania
            const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`, {
                headers: this.getAuthHeaders()
            });
            let results = [];
            
            if (response.ok) {
                results = await response.json();
            } else {
                console.warn('Search API failed, showing empty results');
            }

            // Zastosuj lokalne filtry
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
            const poster = this.getPosterUrl(item);
            movieCard.innerHTML = `
                <img src="${poster}" alt="${item.title}">
                <div class="movie-card-content">
                    <h3>${item.title}</h3>
                    <p>${item.description || ''}</p>
                    <div class="movie-rating">
                        <span class="stars">${'★'.repeat(Math.floor(item.rating || 0))}${'☆'.repeat(5-Math.floor(item.rating || 0))}</span>
                        <span>${item.rating || 0}</span>
                    </div>
                </div>
            `;

            movieCard.addEventListener('click', () => {
                // Upewnij się, że obiekt ma pole poster ustawione (modal używa movie.poster)
                item.poster = this.getPosterUrl(item);
                this.openMovieModal(item);
            });

            resultsContainer.appendChild(movieCard);
        });
    }

    openMovieModal(movie, isEdit = false) {
        const modal = document.getElementById('movie-modal');
        // Upewnij się, że modal dostaje prawidłowy URL plakatu (schemat DB)
        const poster = this.getPosterUrl(movie);
        document.getElementById('modal-poster').src = poster;
        document.getElementById('modal-title').textContent = movie.title;
        document.getElementById('modal-description').textContent = movie.description || '';
        document.getElementById('modal-year').textContent = this.normalizeYear(movie.year || movie.release_date || movie.releaseDate) || (movie.year || '');
        document.getElementById('modal-genre').textContent = movie.genre;
        // Dla seriali pokaż sezony/odcinki i średnią długość odcinka zamiast pojedynczych minut
        const modalDurationEl = document.getElementById('modal-duration');
        if (movie.type === 'series') {
            const seasons = movie.totalSeasons || (Array.isArray(movie.seasons) ? movie.seasons.length : null);
            const episodes = movie.totalEpisodes || (Array.isArray(movie.seasons) ? movie.seasons.reduce((acc, s) => acc + (Array.isArray(s.episodes) ? s.episodes.length : 0), 0) : null);
            const avg = movie.avgEpisodeLength || movie.avg_episode_length || movie.duration || null;
            const avgText = avg ? ` • śr. odcinek: ${avg} min` : '';
            modalDurationEl.textContent = `${seasons ? seasons + ' sezon(y)' : 'Serial'} • ${episodes ? episodes + ' odc.' : ''}${avgText}`;
        } else {
            modalDurationEl.textContent = movie.duration ? `${movie.duration} min` : '';
        }

        // Ustaw status jeśli dostępny
        const statusSelect = document.getElementById('movie-status');
        if (statusSelect && movie.status) {
            statusSelect.value = movie.status;
        } else if (statusSelect) {
            statusSelect.value = '';
        }

        // Pokaż/ukryj zakładkę odcinków w zależności od typu
        const episodesTabBtn = document.getElementById('episodes-tab-btn');
        if (episodesTabBtn) {
            episodesTabBtn.style.display = movie.type === 'series' ? 'inline-block' : 'none';
        }

        // Ustaw ocenę i recenzję
        if (isEdit) {
            this.currentRating = movie.rating || 0;
            this.highlightStars(this.currentRating);
            document.getElementById('review-text').value = movie.review || '';
            
            // Pokaż przyciski aktualizacji i usuwania, ukryj przycisk dodawania
            document.getElementById('add-to-list').style.display = 'none';
            document.getElementById('update-item').style.display = 'inline-block';
            document.getElementById('remove-from-list').style.display = 'inline-block';
            
            // Przełącz na zakładkę edycji
            this.switchModalTab('edit');
        } else {
            // Zresetuj ocenę dla nowych elementów
            this.currentRating = 0;
            this.highlightStars(0);
            document.getElementById('review-text').value = '';
            
            // Pokaż przycisk dodawania, ukryj przyciski aktualizacji i usuwania
            document.getElementById('add-to-list').style.display = 'inline-block';
            document.getElementById('update-item').style.display = 'none';
            document.getElementById('remove-from-list').style.display = 'none';
            
            // Przełącz na zakładkę informacji
            this.switchModalTab('info');
        }

        modal.style.display = 'block';
        modal.currentMovie = movie;
        modal.isEditMode = isEdit;
        // ============= MODALE I OCENY =============
    }
    
    switchModalTab(tabName) {
        // Usuń klasę active ze wszystkich zakładek i zawartości
        document.querySelectorAll('.modal-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.modal-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Dodaj klasę active do wybranej zakładki i zawartości
        const tabBtn = document.querySelector(`.modal-tab-btn[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        // Jeśli przechodzi na zakładkę odcinków, załaduj odcinki
        if (tabName === 'episodes') {
            const modal = document.getElementById('movie-modal');
            const movie = modal.currentMovie;
            if (movie && movie.id) {
                // Upewnij się, że ID jest liczbą, a nie stringiem z prefiksem
                const seriesId = typeof movie.id === 'string' ? movie.id.replace(/^db_/, '') : movie.id;
                this.loadEpisodesIntoTab(seriesId);
            }
        }
    }

    showConfirm(message, title = 'Potwierdzenie') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const yesBtn = document.getElementById('confirm-yes');
            const noBtn = document.getElementById('confirm-no');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            modal.style.display = 'block';
            
            const handleYes = () => {
                modal.style.display = 'none';
                yesBtn.removeEventListener('click', handleYes);
                noBtn.removeEventListener('click', handleNo);
                resolve(true);
            };
            
            const handleNo = () => {
                modal.style.display = 'none';
                yesBtn.removeEventListener('click', handleYes);
                noBtn.removeEventListener('click', handleNo);
                resolve(false);
            };
            
            yesBtn.addEventListener('click', handleYes);
            noBtn.addEventListener('click', handleNo);
        });
    }

    closeModal() {
        document.getElementById('movie-modal').style.display = 'none';
    }
    // ============= KONIEC MODALI I OCENY =============

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
        const statusSelect = document.getElementById('movie-status');
        const selectedStatus = statusSelect ? statusSelect.value : 'watched';

        const movieData = {
            ...movie,
            rating: this.currentRating,
            review: reviewText,
            status: selectedStatus || 'watched',
            watchedDate: new Date().toISOString().split('T')[0]
        };

        try {
            const response = await fetch('/api/movies', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(movieData)
            });

            if (response.ok) {
                const result = await response.json();
                // Reload movies data to refresh the list
                await this.loadMoviesData();
                this.closeModal();
                
                // Jeśli to serial, od razu otwórz modal z zakładką odcinków
                if (movie.type === 'series' && result.id) {
                    // Poczekaj chwilę na załadowanie danych
                    setTimeout(() => {
                        const addedSeries = this.watchedMovies.find(m => m.id === result.id);
                        if (addedSeries) {
                            this.openModal(addedSeries, false);
                            // Przełącz na zakładkę odcinków
                            setTimeout(() => {
                                this.switchModalTab('episodes');
                                this.showNotification('Serial został dodany! Zaznacz obejrzane odcinki.');
                            }, 100);
                        }
                    }, 300);
                } else {
                    this.showNotification('Film został dodany do listy!');
                }
            } else {
                throw new Error('Failed to add movie');
            }
        } catch (error) {
            console.error('Error adding movie:', error);
            this.showNotification('Błąd podczas dodawania filmu. Spróbuj ponownie.');
        }
    }

    async updateMovieItem() {
        const modal = document.getElementById('movie-modal');
        const movie = modal.currentMovie;
        const reviewText = document.getElementById('review-text').value;
        const statusSelect = document.getElementById('movie-status');
        const selectedStatus = statusSelect ? statusSelect.value : movie.status || 'watched';

        if (!movie.id) {
            this.showNotification('Błąd: Brak identyfikatora filmu.');
            return;
        }

        const movieData = {
            rating: this.currentRating,
            review: reviewText,
            status: selectedStatus,
            watchedDate: movie.watchedDate || new Date().toISOString().split('T')[0]
        };

        try {
            const response = await fetch(`/api/movies/${movie.id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(movieData)
            });

            if (response.ok) {
                // Jeśli to serial i status zmieniono na 'watched', oznacz wszystkie odcinki jako obejrzane
                if (movie.type === 'series' && selectedStatus === 'watched') {
                    const loadingNotification = this.showNotification('Oznaczam wszystkie odcinki jako obejrzane...', 'info', false);
                    await this.markAllEpisodesAsWatched(movie.id);
                    // Usuń notyfikację ładowania
                    if (loadingNotification && loadingNotification.parentNode) {
                        loadingNotification.style.transform = 'translateX(400px)';
                        setTimeout(() => {
                            if (loadingNotification.parentNode) {
                                document.body.removeChild(loadingNotification);
                            }
                        }, 300);
                    }
                }
                
                // Przeładuj dane filmów, aby odświeżyć listę
                await this.loadMoviesData();
                this.closeModal();
                this.showNotification(movie.type === 'series' ? 'Serial został zaktualizowany!' : 'Film został zaktualizowany!');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update movie');
            }
        } catch (error) {
            console.error('Error updating movie:', error);
            this.showNotification('Błąd podczas aktualizacji filmu. Spróbuj ponownie.');
        }
    }

    // Funkcja do oznaczenia wszystkich odcinków serialu jako obejrzanych
    async markAllEpisodesAsWatched(seriesId) {
        try {
            // Pobierz wszystkie odcinki serialu
            const response = await fetch(`/api/series/${seriesId}/episodes`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to fetch episodes');
            }

            const data = await response.json();

            // Oznacz każdy nieobejrzany odcinek jako obejrzany
            for (const season of data.seasons) {
                for (const episode of season.episodes) {
                    // Sprawdź czy odcinek NIE jest już obejrzany
                    if (!episode.isWatched) {
                        await fetch(`/api/series/${seriesId}/episodes`, {
                            method: 'POST',
                            headers: this.getAuthHeaders(),
                            body: JSON.stringify({
                                episodeId: episode.id,
                                watched: true,
                                markPrevious: false
                            })
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error marking all episodes as watched:', error);
            // Nie pokazuj notyfikacji błędu - to operacja w tle
        }
    }

    async removeFromList() {
        const modal = document.getElementById('movie-modal');
        const movie = modal.currentMovie;

        if (!movie.id) {
            this.showNotification('Błąd: Brak identyfikatora filmu.');
            return;
        }

        if (!(await this.showConfirm(`Czy na pewno chcesz usunąć "${movie.title}" z listy?`, 'Potwierdzenie usunięcia'))) {
            return;
        }

        try {
            const response = await fetch(`/api/movies/${movie.id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                // Przeładuj dane filmów, aby odświeżyć listę
                await this.loadMoviesData();
                this.closeModal();
                this.showNotification(`Usunięto "${movie.title}" z listy`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete movie');
            }
        } catch (error) {
            console.error('Error deleting movie:', error);
            this.showNotification('Błąd podczas usuwania filmu. Spróbuj ponownie.');
        }
    }

    showNotification(message, type = 'success', autoHide = true) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        
        // Dodaj ikonę w zależności od typu
        let icon = '';
        let bgColor = 'var(--secondary-color)';
        
        if (type === 'info') {
            icon = '<i class="fas fa-spinner fa-spin"></i> ';
            bgColor = '#2196F3';
        } else if (type === 'error') {
            icon = '<i class="fas fa-exclamation-circle"></i> ';
            bgColor = '#f44336';
        } else {
            icon = '<i class="fas fa-check-circle"></i> ';
        }
        
        notification.innerHTML = icon + message;
        notification.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            background-color: ${bgColor};
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

        if (autoHide) {
            setTimeout(() => {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
        
        return notification; // Zwróć element, aby móc go usunąć ręcznie
    }

    generateCalendar() {
        const calendar = document.getElementById('calendar-container');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Mockowe nadchodzące premiery
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
        
        // Dodaj nagłówki dni
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });

        // Generuj dni kalendarza
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

    // Funkcje pomocnicze
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
        // Implementacja nawigacji po miesiącach
        console.log('Change month:', direction);
    }

    filterMyList(status) {
        // Filtruj listę na podstawie statusu
        this.displayMyList(status);
        console.log('Filtering list by status:', status);
    }

    changeViewMode(viewMode) {
        // Przełącz między widokiem siatki a widokiem listy
        this.currentView = viewMode;
        
        const myListContainer = document.getElementById('my-list-content');
        
        if (myListContainer) {
            if (viewMode === 'list') {
                myListContainer.classList.add('my-list-list');
                myListContainer.classList.remove('my-list-grid');
            } else {
                myListContainer.classList.add('my-list-grid');
                myListContainer.classList.remove('my-list-list');
            }
            
            // Przerysuj listę z nowym trybem widoku
            this.displayMyList();
        }
        
        console.log('Changed view mode to:', viewMode);
    }

    editItem(itemId) {
        // Znajdź i edytuj element
        const item = this.watchedMovies.find(movie => movie.id === itemId);
        if (item) {
            console.log('Editing item:', item);
            // Otwórz modal w trybie edycji
            this.openMovieModal(item, true);
        } else {
            console.error('Item not found:', itemId);
            this.showNotification('Nie znaleziono filmu do edycji.');
        }
    }

    async deleteItem(itemId) {
        // Usuń element z listy
        const item = this.watchedMovies.find(movie => movie.id === itemId);
        
        if (!item) {
            this.showNotification('Nie znaleziono filmu do usunięcia.');
            return;
        }

        if (!(await this.showConfirm(`Czy na pewno chcesz usunąć "${item.title}" z listy?`, 'Potwierdzenie usunięcia'))) {
            return;
        }

        try {
            const response = await fetch(`/api/movies/${itemId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                // Przeładuj dane filmów, aby odświeżyć listę
                await this.loadMoviesData();
                this.showNotification(`Usunięto "${item.title}" z listy`);
            } else {
                const errorData = await response.json();
                console.error('Delete error response:', errorData);
                throw new Error(errorData.error || 'Failed to delete movie');
            }
        } catch (error) {
            console.error('Error deleting movie:', error);
            this.showNotification('Błąd podczas usuwania filmu. Spróbuj ponownie.');
        }
    }

    async loadEpisodesIntoTab(seriesId) {
        const container = document.getElementById('series-seasons-container');
        container.innerHTML = '<p style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Ładowanie odcinków...</p>';
        
        try {
            const response = await fetch(`/api/series/${seriesId}/episodes`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to fetch episodes');
            }

            const data = await response.json();
            container.innerHTML = '';

            if (!data.seasons || data.seasons.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 20px;">Brak odcinków do wyświetlenia. Serial może nie być jeszcze skonfigurowany.</p>';
                return;
            }

            // Renderuj sezony
            data.seasons.forEach(season => {
                const watchedCount = season.episodes.filter(ep => ep.isWatched).length;
                const totalCount = season.episodes.length;
                
                const seasonDiv = document.createElement('div');
                seasonDiv.className = 'season-section';
                seasonDiv.innerHTML = `
                    <div class="season-header" onclick="this.nextElementSibling.classList.toggle('active')">
                        <h3>Sezon ${season.seasonNumber}</h3>
                        <span class="season-progress">${watchedCount}/${totalCount} odcinków</span>
                    </div>
                    <div class="season-episodes">
                        ${season.episodes.map(episode => `
                            <div class="episode-item ${episode.isWatched ? 'watched' : ''}" data-episode-id="${episode.id}">
                                <input type="checkbox" 
                                    class="episode-checkbox" 
                                    ${episode.isWatched ? 'checked' : ''}
                                    onchange="app.toggleEpisode(${seriesId}, ${episode.id}, ${season.seasonNumber}, ${episode.episodeNumber}, this.checked)">
                                <label class="episode-label">Odcinek ${episode.episodeNumber}</label>
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(seasonDiv);
            });
        } catch (error) {
            console.error('Error loading episodes:', error);
            container.innerHTML = '<p style="text-align: center; padding: 20px; color: #e74c3c;">Błąd podczas ładowania odcinków.</p>';
        }
    }

    // Funkcja openSeriesEpisodes usunięta - używamy zakładki odcinków w głównym modalu

    async toggleEpisode(seriesId, episodeId, seasonNumber, episodeNumber, isChecked) {
        try {
            // Jeśli użytkownik zaznacza odcinek jako obejrzany, upewnij się, że serial jest w liście
            if (isChecked) {
                const series = this.watchedMovies.find(m => m.id === seriesId);
                if (!series) {
                    // Serial nie jest jeszcze na liście - dodaj go jako 'watching'
                    const movieResponse = await fetch(`/api/movies/${seriesId}`, {
                        headers: this.getAuthHeaders()
                    });
                    
                    if (movieResponse.ok) {
                        const movieData = await movieResponse.json();
                        // Jeśli serial nie ma statusu, dodaj go jako 'watching'
                        if (!movieData.status || movieData.status === 'planning') {
                            await fetch(`/api/movies/${seriesId}`, {
                                method: 'PUT',
                                headers: {
                                    ...this.getAuthHeaders(),
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    status: 'watching',
                                    rating: movieData.rating || 0,
                                    review: movieData.review || ''
                                })
                            });
                        }
                    }
                }
            }
            
            const response = await fetch(`/api/series/${seriesId}/episodes`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    episodeId,
                    watched: isChecked
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update episode');
            }

            const data = await response.json();

            // Sprawdź czy były poprzednie nieobejrzane odcinki
            if (data.hasPreviousUnwatched && isChecked) {
                if (await this.showConfirm(`Odcinek ${episodeNumber} w sezonie ${seasonNumber} został zaznaczony. Czy oznaczyć poprzednie odcinki jako obejrzane?`, 'Zaznacz poprzednie odcinki')) {
                    // Oznacz poprzednie odcinki jako obejrzane
                    const markPreviousResponse = await fetch(`/api/series/${seriesId}/episodes`, {
                        method: 'POST',
                        headers: {
                            ...this.getAuthHeaders(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            episodeId,
                            watched: true,
                            markPrevious: true
                        })
                    });

                    if (markPreviousResponse.ok) {
                        // Przeładuj zakładkę odcinków
                        await this.loadEpisodesIntoTab(seriesId);
                        return; // Wyjdź z funkcji, ponieważ odcinki zostały już przeładowane
                    }
                }
            }

            // Zaktualizuj wyświetlanie elementu odcinka
            const episodeItem = document.querySelector(`.episode-item[data-episode-id="${episodeId}"]`);
            if (episodeItem) {
                if (isChecked) {
                    episodeItem.classList.add('watched');
                } else {
                    episodeItem.classList.remove('watched');
                }
                
                // Zaktualizuj licznik postępu sezonu
                const seasonSection = episodeItem.closest('.season-section');
                if (seasonSection) {
                    const checkboxes = seasonSection.querySelectorAll('.episode-checkbox');
                    const watchedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
                    const totalCount = checkboxes.length;
                    const progressSpan = seasonSection.querySelector('.season-progress');
                    if (progressSpan) {
                        progressSpan.textContent = `${watchedCount}/${totalCount} odcinków`;
                    }
                }
            }

            // Przeładuj dane filmów, aby zaktualizować postęp
            await this.loadMoviesData();
            
        } catch (error) {
            console.error('Error toggling episode:', error);
            this.showNotification('Błąd podczas aktualizacji odcinka.');
        }
    }

    // Metody uwierzytelniania
    async checkAuth() {
        this.authToken = localStorage.getItem('movieTrackerToken');
        if (this.authToken) {
            // Sprawdź czy token wygasł przed wykonaniem wywołania API
            if (this.isTokenExpired(this.authToken)) {
                console.log('Token expired, logging out...');
                this.logout();
                return;
            }
            
            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    this.currentUser = data.user;
                    // Uruchom sprawdzacz wygaśnięcia tokenu
                    this.startTokenExpirationChecker();
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

    isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token));
            return payload.exp < Date.now();
        } catch (e) {
            console.error('Invalid token format:', e);
            return true; // Traktuj nieprawidłowy token jako wygasły
        }
    }

    startTokenExpirationChecker() {
        // Sprawdzaj wygaśnięcie tokenu co 5 minut
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
        }
        
        this.tokenCheckInterval = setInterval(() => {
            if (this.isTokenExpired(this.authToken)) {
                clearInterval(this.tokenCheckInterval);
                alert('Twoja sesja wygasła. Zostaniesz wylogowany.');
                this.logout();
            }
        }, 5 * 60 * 1000); // Sprawdzaj co 5 minut
        
        // Sprawdź również 1 minutę przed wygaśnięciem, aby ostrzec użytkownika
        const token = this.authToken;
        try {
            const payload = JSON.parse(atob(token));
            const timeUntilExpiry = payload.exp - Date.now();
            const oneMinuteBeforeExpiry = timeUntilExpiry - (60 * 1000);
            
            if (oneMinuteBeforeExpiry > 0) {
                setTimeout(() => {
                    if (!this.isTokenExpired(this.authToken)) {
                        alert('Twoja sesja wygaśnie za minutę. Zapisz swoją pracę.');
                    }
                }, oneMinuteBeforeExpiry);
            }
        } catch (e) {
            console.error('Error setting expiration warning:', e);
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
        // Clear token check interval
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
        }
        localStorage.removeItem('movieTrackerToken');
        location.reload();
    }

    // Metody panelu admina
    bindAdminEvents() {
        // Przełączanie zakładek
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchAdminTab(tab);
            });
        });

        // Przyciski dodawania
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

        // Przyciski zamykania modalów
        document.querySelectorAll('#admin-movie-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAdminModal('admin-movie-modal'));
        });
        document.querySelectorAll('#admin-challenge-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAdminModal('admin-challenge-modal'));
        });
        document.querySelectorAll('#admin-badge-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAdminModal('admin-badge-modal'));
        });
        document.querySelectorAll('#admin-seasons-modal .close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAdminModal('admin-seasons-modal'));
        });

        // Obsługa formularzy
        document.getElementById('admin-movie-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAdminMovie();
        });
        
        document.getElementById('admin-seasons-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSeasonsConfig();
        });
        
        // Show/hide series fields based on type
        const adminMovieType = document.getElementById('admin-movie-type');
        if (adminMovieType) {
            adminMovieType.addEventListener('change', (e) => {
                const isSeries = e.target.value === 'series';
                const durationField = document.getElementById('duration-field');
                const durationLabel = document.getElementById('duration-label');
                
                document.getElementById('series-fields').style.display = isSeries ? 'block' : 'none';
                
                // Update duration field label based on type
                if (isSeries) {
                    durationLabel.textContent = 'Średni czas trwania odcinka (minuty):';
                } else {
                    durationLabel.textContent = 'Czas trwania (minuty):';
                }
            });
        }
        
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
                this.updateAdminCounts(movies);
                this.displayAdminMovies(movies);
            }
        } catch (error) {
            console.error('Error loading admin movies:', error);
            this.showNotification('Błąd podczas ładowania filmów', 'error');
        }
    }

    // Aktualizuje liczniki filmów i seriali w panelu admina
    updateAdminCounts(movies) {
        if (!Array.isArray(movies)) return;
        const moviesCount = movies.filter(m => ((m.media_type || m.type) === 'movie')).length;
        const seriesCount = movies.filter(m => ((m.media_type || m.type) === 'series')).length;

        const moviesEl = document.getElementById('admin-total-movies-count');
        const seriesEl = document.getElementById('admin-total-series-count');

        if (moviesEl) moviesEl.textContent = String(moviesCount);
        if (seriesEl) seriesEl.textContent = String(seriesCount);
    }

    displayAdminMovies(movies) {
        const tbody = document.getElementById('admin-movies-list');
        tbody.innerHTML = movies.map(movie => {
            const displayYear = this.normalizeYear(movie.release_date || movie.year || movie.releaseDate) || '-';
            return `
            <tr>
                <td><input type="checkbox" class="movie-checkbox" data-id="${movie.id}" onchange="app.updateBulkDeleteButton('movies')"></td>
                <td>${movie.id}</td>
                <td>${movie.title}</td>
                <td>${movie.media_type === 'movie' ? 'Film' : 'Serial'}</td>
                <td>${displayYear}</td>
                <td>${movie.genre || '-'}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="app.editAdminMovie(${movie.id})">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    ${movie.media_type === 'series' ? `
                    <button class="action-btn btn-edit" onclick="app.editSeriesSeasons(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')"
                            style="background: #2196F3;" title="Edytuj sezony">
                        <i class="fas fa-list-ol"></i> Sezony
                    </button>
                    ` : ''}
                    <button class="action-btn btn-delete" onclick="app.deleteAdminMovie(${movie.id})">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </td>
            </tr>
        `}).join('');
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
                <td>${challenge.title}</td>
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

    // CRUD filmów
    showAdminMovieModal(movie = null) {
        const modal = document.getElementById('admin-movie-modal');
        const title = document.getElementById('admin-movie-modal-title');
        
        if (movie) {
            title.textContent = 'Edytuj film';
            document.getElementById('admin-movie-id').value = movie.id;
            document.getElementById('admin-movie-title').value = movie.title;
            document.getElementById('admin-movie-type').value = movie.media_type;
            document.getElementById('admin-movie-year').value = this.normalizeYear(movie.year || movie.release_date || movie.releaseDate) || '';
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
            } else {
                const error = await response.json().catch(() => ({ error: 'Nieznany błąd' }));
                this.showNotification(error.error || 'Błąd podczas ładowania filmu', 'error');
            }
        } catch (error) {
            console.error('Error loading movie:', error);
            this.showNotification('Błąd podczas ładowania filmu', 'error');
        }
    }

    async saveAdminMovie() {
        const id = document.getElementById('admin-movie-id').value;
        const movieType = document.getElementById('admin-movie-type').value;
        
        const data = {
            title: document.getElementById('admin-movie-title').value,
            type: movieType,
            year: document.getElementById('admin-movie-year').value || null,
            genre: document.getElementById('admin-movie-genre').value || null,
            duration: parseInt(document.getElementById('admin-movie-duration').value) || null,
            description: document.getElementById('admin-movie-description').value || null,
            poster: document.getElementById('admin-movie-poster').value || null
        };

        // Add series-specific fields
        if (movieType === 'series') {
            data.totalSeasons = parseInt(document.getElementById('admin-series-seasons').value) || 1;
            // Nie wysyłamy episodesPerSeason - będziemy konfigurować osobno
        }

        try {
            const url = id ? `/api/admin/movies/${id}` : '/api/admin/movies';
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification(id ? 'Film/serial zaktualizowany' : 'Film/serial dodany', 'success');
                this.closeAdminModal('admin-movie-modal');
                
                // If it's a new series, open seasons config modal
                if (!id && movieType === 'series') {
                    const seriesId = result.id;
                    const seasonCount = data.totalSeasons;
                    this.showSeasonsConfigModal(seriesId, seasonCount, data.title);
                } else {
                    this.loadAdminMovies();
                }
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas zapisywania', 'error');
            }
        } catch (error) {
            console.error('Error saving movie:', error);
            this.showNotification('Błąd podczas zapisywania', 'error');
        }
    }

    async editSeriesSeasons(seriesId, seriesTitle) {
        try {
            // Pobierz dane serialu
            const movieResponse = await fetch(`/api/admin/movies/${seriesId}`, {
                headers: this.getAuthHeaders()
            });
            
            if (!movieResponse.ok) {
                throw new Error('Nie udało się pobrać danych serialu');
            }
            
            const movie = await movieResponse.json();
            
            // Pobierz istniejące sezony
            const seasonsResponse = await fetch(`/api/admin/movies/${seriesId}/seasons`, {
                headers: this.getAuthHeaders()
            });
            
            const existingSeasons = seasonsResponse.ok ? await seasonsResponse.json() : [];
            
            // Otwórz modal z pytaniem o liczbę sezonów
            const newSeasonCount = prompt(
                `Aktualnie: ${movie.total_seasons} sezonów\n\nPodaj nową liczbę sezonów (lub zostaw jak jest):`,
                movie.total_seasons
            );
            
            if (newSeasonCount === null) return; // Anulowano
            
            const seasonCount = parseInt(newSeasonCount) || movie.total_seasons;
            
            // Otwórz modal konfiguracji sezonów
            this.showSeasonsConfigModal(seriesId, seasonCount, seriesTitle, existingSeasons);
            
        } catch (error) {
            console.error('Error loading series seasons:', error);
            this.showNotification('Błąd podczas ładowania danych serialu', 'error');
        }
    }

    async deleteAdminMovie(id) {
        if (!(await this.showConfirm('Czy na pewno chcesz usunąć ten film?', 'Potwierdzenie usunięcia'))) return;

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

    // CRUD wyzwań
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
            } else {
                const error = await response.json().catch(() => ({ error: 'Nieznany błąd' }));
                this.showNotification(error.error || 'Błąd podczas ładowania wyzwania', 'error');
            }
        } catch (error) {
            console.error('Error loading challenge:', error);
            this.showNotification('Błąd podczas ładowania wyzwania', 'error');
        }
    }

    async saveAdminChallenge() {
        const id = document.getElementById('admin-challenge-id').value;
        // Funkcja pomocnicza do parsowania daty
        const parseDateInput = (raw) => {
            if (!raw) return null;
            const s = String(raw).trim();
            if (s === '') return null;

            // Jeśli już w formacie ISO
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

            // DD.MM.YYYY lub DD/MM/YYYY
            const dmy = s.match(/^(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})$/);
            if (dmy) {
                const day = dmy[1].padStart(2, '0');
                const month = dmy[2].padStart(2, '0');
                const year = dmy[3];
                return `${year}-${month}-${day}`;
            }

            // Próba parsowania daty jako fallback
            const parsed = new Date(s);
            if (!isNaN(parsed.getTime())) {
                const yyyy = parsed.getFullYear();
                const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                const dd = String(parsed.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }

            return null;
        };

        const rawName = document.getElementById('admin-challenge-name').value;
        const rawType = document.getElementById('admin-challenge-type').value;
        const rawTarget = document.getElementById('admin-challenge-target').value;
        const rawStart = document.getElementById('admin-challenge-start').value;
        const rawEnd = document.getElementById('admin-challenge-end').value;
        const rawBadge = document.getElementById('admin-challenge-badge').value;

        // Podstawowa walidacja po stronie klienta
        if (!rawName || rawName.trim().length === 0) {
            this.showNotification('Nazwa wyzwania jest wymagana', 'error');
            return;
        }

        if (!rawType || rawType.trim().length === 0) {
            this.showNotification('Typ wyzwania jest wymagany', 'error');
            return;
        }

        const targetCount = parseInt(rawTarget);
        if (isNaN(targetCount) || targetCount <= 0) {
            this.showNotification('Cel (liczba) musi być dodatnią liczbą', 'error');
            return;
        }

        const data = {
            title: rawName.trim(),
            description: document.getElementById('admin-challenge-description').value || null,
            type: rawType.trim(),
            criteria_value: document.getElementById('admin-challenge-criteria').value || null,
            target_count: targetCount,
            start_date: parseDateInput(rawStart),
            end_date: parseDateInput(rawEnd),
            badge_id: (rawBadge && rawBadge.trim() !== '') ? (parseInt(rawBadge) || null) : null
        };

        // Walidacja wymagalnych pól zgodnie ze schematem DB
        if (!data.start_date) {
            this.showNotification('Data rozpoczęcia jest wymagana (wprowadź w formacie DD.MM.RRRR lub RRRR-MM-DD)', 'error');
            return;
        }

        // Debug log danych wyzwania (wysyłany payload)
        console.log('Saving challenge payload (sent):', data);

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
                return;
            }

            // Sprób dokładnie przeanalizować odpowiedź błędu
            let errorBody = null;
            try {
                errorBody = await response.json();
            } catch (jsonErr) {
                try {
                    const text = await response.text();
                    errorBody = { text };
                } catch (txtErr) {
                    errorBody = { text: 'Unable to parse server response' };
                }
            }

            console.error('Error saving challenge, status:', response.status, 'body:', errorBody);
            const message = (errorBody && (errorBody.error || errorBody.message)) ? (errorBody.error || errorBody.message) : (errorBody.text || 'Błąd podczas zapisywania wyzwania');
            this.showNotification(`Błąd: ${message}`, 'error');

        } catch (error) {
            console.error('Błąd podczas zapisywania wyzwania (połączenie):', error);
            this.showNotification('Błąd podczas zapisywania wyzwania (połączenie)', 'error');
        }
    }

    async deleteAdminChallenge(id) {
        if (!(await this.showConfirm('Czy na pewno chcesz usunąć to wyzwanie?', 'Potwierdzenie usunięcia'))) return;

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

    // CRUD odznak
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
        
        // Dodaj pole uploadu obrazu
        const form = document.getElementById('admin-badge-form');
        if (form && !document.getElementById('admin-badge-file')) {
            const uploadGroup = document.createElement('div');
            uploadGroup.className = 'form-group';
            uploadGroup.innerHTML = `
                <label>Prześlij obraz odznaki (opcjonalnie)</label>
            `;
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.id = 'admin-badge-file';
            fileInput.className = 'form-control';
            uploadGroup.appendChild(fileInput);
            const hint = document.createElement('p');
            hint.className = 'form-hint';
            hint.textContent = 'Plik zostanie przesłany do R2 (binding: BADGES) i użyty jako URL odznaki.';
            uploadGroup.appendChild(hint);

            // Wstaw przed przyciskami formularza — bezpiecznie nawet gdy przycisk nie jest bezpośrednim dzieckiem formy
                const submitBtn = form.querySelector('[type="submit"]');
                if (submitBtn && submitBtn.parentNode) {
                    // Wstaw przed przyciskiem używając jego rodzica (działa, gdy przycisk jest zagnieżdżony)
                    submitBtn.parentNode.insertBefore(uploadGroup, submitBtn);
                } else {
                    // Fallback: dołącz na końcu formularza
                    form.appendChild(uploadGroup);
                }
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
            } else {
                const error = await response.json().catch(() => ({ error: 'Nieznany błąd' }));
                this.showNotification(error.error || 'Błąd podczas ładowania odznaki', 'error');
            }
        } catch (error) {
            console.error('Error loading badge:', error);
            this.showNotification('Błąd podczas ładowania odznaki', 'error');
        }
    }

    async saveAdminBadge() {
        const id = document.getElementById('admin-badge-id').value;
        // Pobierz podstawowe pola formularza
        const name = document.getElementById('admin-badge-name').value;
        const description = document.getElementById('admin-badge-description').value || null;
        let imageUrl = document.getElementById('admin-badge-icon').value || null; // pole z URL

        // Obsługa uploadu pliku (jeśli admin dostarczył plik)
        const fileInput = document.getElementById('admin-badge-file');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            try {
                const fd = new FormData();
                fd.append('badge', file);

                // Nie ustawiaj Content-Type dla FormData
                const headers = { ...this.getAuthHeaders() };
                if (headers['Content-Type']) delete headers['Content-Type'];

                // Wyślij plik do endpointu upload (backend musi to obsłużyć i zapisać do R2)
                const uploadResp = await fetch('/api/admin/badges/upload', {
                    method: 'POST',
                    headers,
                    body: fd
                });

                if (!uploadResp.ok) {
                    // Spróbuj odczytać odpowiedź, aby pokazać pomocny komunikat
                    let errText = 'Błąd podczas uploadu pliku';
                    try { const jb = await uploadResp.json(); errText = jb.error || jb.message || JSON.stringify(jb); } catch (e) {
                        try { errText = await uploadResp.text(); } catch (e2) {}
                    }
                    this.showNotification('Upload pliku nie powiódł się: ' + errText, 'error');
                    return; // przerwij zapisywanie odznaki
                }

                const uploadJson = await uploadResp.json();
                // Oczekujemy: { image_url: 'https://.../badge.png' }
                imageUrl = uploadJson.image_url || uploadJson.url || imageUrl;
                console.log('Upload badge response:', uploadJson);
            } catch (err) {
                console.error('Upload error:', err);
                this.showNotification('Błąd podczas wysyłania pliku', 'error');
                return;
            }
        }

        // Przygotuj payload i wyślij dane odznaki
        const data = { name: name, description: description, image_url: imageUrl };

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
                let errBody = null;
                try { errBody = await response.json(); } catch (e) { errBody = { text: await response.text().catch(()=>'') }; }
                console.error('Error saving badge:', response.status, errBody);
                const msg = (errBody && (errBody.error || errBody.message)) ? (errBody.error || errBody.message) : (errBody.text || 'Błąd podczas zapisywania odznaki');
                this.showNotification(msg, 'error');
            }
        } catch (error) {
            console.error('Error saving badge (network):', error);
            this.showNotification('Błąd podczas zapisywania odznaki (połączenie)', 'error');
        }
    }

    async deleteAdminBadge(id) {
        if (!(await this.showConfirm('Czy na pewno chcesz usunąć tę odznakę?', 'Potwierdzenie usunięcia'))) return;

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

    showSeasonsConfigModal(seriesId, seasonCount, seriesTitle, existingSeasons = null) {
        const modal = document.getElementById('admin-seasons-modal');
        const title = document.getElementById('admin-seasons-modal-title');
        const container = document.getElementById('seasons-config-container');
        
        title.textContent = `Konfiguracja sezonów - ${seriesTitle}`;
        document.getElementById('admin-seasons-series-id').value = seriesId;
        
        // Generate inputs for each season
        container.innerHTML = '';
        for (let i = 1; i <= seasonCount; i++) {
            const existingSeason = existingSeasons?.find(s => s.season_number === i);
            const episodeCount = existingSeason?.episode_count || 10;
            
            const seasonItem = document.createElement('div');
            seasonItem.className = 'season-config-item';
            seasonItem.innerHTML = `
                <label>Sezon ${i}:</label>
                <input type="number" 
                       class="season-episodes-input" 
                       data-season="${i}" 
                       min="1" 
                       value="${episodeCount}" 
                       placeholder="Liczba odcinków"
                       required>
            `;
            container.appendChild(seasonItem);
        }
        
        modal.style.display = 'block';
    }

    async saveSeasonsConfig() {
        const seriesId = document.getElementById('admin-seasons-series-id').value;
        const inputs = document.querySelectorAll('.season-episodes-input');
        
        const seasons = Array.from(inputs).map(input => ({
            seasonNumber: parseInt(input.dataset.season),
            episodeCount: parseInt(input.value) || 10
        }));
        
        try {
            const response = await fetch(`/api/admin/movies/${seriesId}/seasons`, {
                method: 'POST',
                headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ seasons })
            });
            
            if (response.ok) {
                this.showNotification('Sezony skonfigurowane pomyślnie', 'success');
                this.closeAdminModal('admin-seasons-modal');
                this.loadAdminMovies();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Błąd podczas zapisywania sezonów', 'error');
            }
        } catch (error) {
            console.error('Error saving seasons:', error);
            this.showNotification('Błąd podczas zapisywania sezonów', 'error');
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
        const selectAllCheckbox = document.getElementById(`select-all-${type}`);
        
        if (button) {
            button.style.display = checkboxes.length > 0 ? 'inline-block' : 'none';
        }
        
        // Update select-all checkbox state
        if (selectAllCheckbox) {
            const allCheckboxes = document.querySelectorAll(`.${type.slice(0, -1)}-checkbox`);
            selectAllCheckbox.checked = allCheckboxes.length > 0 && checkboxes.length === allCheckboxes.length;
        }
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
        await this.loadAdminMovies();
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
        await this.loadAdminChallenges();
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
        await this.loadAdminBadges();
        document.getElementById('select-all-badges').checked = false;
        this.updateBulkDeleteButton('badges');
    }
    
}

// Inicjalizacja aplikacji
const app = new MovieTracker();
