document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('login-form');
const errBox = document.getElementById('login-error');
const submitBtn = form.querySelector('.btn-submit');
const passInput = form.querySelector('input[name="password"]');
const eyeBtn = form.querySelector('.btn-eye');

// Si ya hay sesión, ir al dashboard
if (window.ComTec.Auth.isLogged()) {
  window.location.href = 'dashboard.html';
}

eyeBtn.addEventListener('click', () => {
  passInput.type = passInput.type === 'password' ? 'text' : 'password';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  try {
    const fd = new FormData(form);
    const data = await window.ComTec.API.post('/api/auth/login', {
      email: fd.get('email'),
      password: fd.get('password'),
    });
    window.ComTec.Auth.setSession(data.token, data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    errBox.textContent = err.message;
    errBox.hidden = false;
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
});
