(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const themeFromUrl = urlParams.get('__user_theme__');
    
    if (themeFromUrl) {
        localStorage.setItem('admin_theme', themeFromUrl);
    }
    
    const userTheme = localStorage.getItem('admin_theme') || 'dark';
    
    // 1. Nakładamy motyw na główny tag <html> od razu, żeby zapobiec mignięciu na biało
    if (userTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
    }

    // 2. Czekamy na wyrenderowanie reszty strony, żeby bezpiecznie zmodyfikować <body>
    document.addEventListener("DOMContentLoaded", () => {
        const body = document.body;
        if (body) {
            if (userTheme === 'dark') {
                body.setAttribute('data-theme', 'dark');
                body.classList.add('dark-theme');
            } else {
                body.removeAttribute('data-theme');
                body.classList.remove('dark-theme');
            }
        }
    });
})();
