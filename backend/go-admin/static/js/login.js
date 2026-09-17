function handleLoginError() {
    const pwd = document.getElementById('password');
    const usr = document.getElementById('username');
    if (pwd) { pwd.value = ''; pwd.classList.add('input-error'); }
    if (usr) { usr.classList.add('input-error'); }
    [pwd, usr].forEach(el => {
        if (el) el.addEventListener('focus', () => el.classList.remove('input-error'), { once: true });
    });
    if (pwd) pwd.focus();
}
