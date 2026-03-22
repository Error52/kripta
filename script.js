const openButton = document.getElementById('openReport');
const dialog = document.getElementById('reportDialog');

if (openButton && dialog) {
  openButton.addEventListener('click', () => dialog.showModal());

  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'submit') {
      alert('Отчёт отправлен на модерацию. Награда будет выдана после проверки PoC.');
    }
  });
}

const ACCOUNTS_KEY = 'kino_accounts';
const CURRENT_USER_KEY = 'kino_current_user';
const COMMENTS_KEY = 'kino_comments';

const SQLI_PATTERN = /(--|;|\/\*|\*\/|\b(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP)\b)/i;

function normalizeInput(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function containsSqlPayload(value) {
  return SQLI_PATTERN.test(value);
}

function isSafeText(value, maxLength = 250) {
  const normalized = normalizeInput(value);
  if (!normalized || normalized.length > maxLength) return false;
  if (containsSqlPayload(normalized)) return false;
  return true;
}


function seedAdmin() {
  const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  if (!accounts.some((u) => u.username === 'kinoadmin')) {
    accounts.push({ username: 'kinoadmin', password: 'passAdminKino', role: 'admin' });
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
}

function setCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function renderAuthStatus() {
  const status = document.getElementById('authStatus');
  if (!status) return;

  const user = getCurrentUser();
  const overlay = document.getElementById('adminFlagOverlay');
  const gate = document.getElementById('authGate');

  if (user) {
    status.textContent = `Ты вошёл как ${user.username}${user.role === 'admin' ? ' (admin)' : ''}`;
    if (overlay && user.role === 'admin') overlay.hidden = false;
    if (gate) gate.hidden = true;
  } else {
    status.textContent = 'Ты не авторизован. Войди, чтобы оставлять комментарии.';
    if (overlay) overlay.hidden = true;
    if (gate) gate.hidden = false;
  }
}

function getAccounts() {
  return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getComments() {
  return JSON.parse(localStorage.getItem(COMMENTS_KEY) || '{}');
}

function saveComments(comments) {
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
}

function renderComments() {
  const allComments = getComments();
  document.querySelectorAll('.movie-card').forEach((card) => {
    const movieId = card.dataset.movieId;
    const container = card.querySelector('.comments');
    const comments = allComments[movieId] || [];

    if (!container) return;

    container.innerHTML = '';

    if (!comments.length) {
      const empty = document.createElement('div');
      empty.className = 'comment-item muted';
      empty.textContent = 'Комментариев пока нет.';
      container.appendChild(empty);
      return;
    }

    comments.forEach((item) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'comment-item';

      const author = document.createElement('strong');
      author.textContent = `${item.user}: `;

      const text = document.createElement('span');
      text.textContent = item.text;

      wrapper.appendChild(author);
      wrapper.appendChild(text);
      container.appendChild(wrapper);
    });
  });
}

function setupMoviePage() {
  const registerDialog = document.getElementById('registerDialog');
  const loginDialog = document.getElementById('loginDialog');
  const openRegister = document.getElementById('openRegister');
  const openLogin = document.getElementById('openLogin');
  const logoutBtn = document.getElementById('logoutBtn');
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');

  if (!registerDialog) return;

  seedAdmin();
  renderAuthStatus();
  renderComments();

  openRegister?.addEventListener('click', () => registerDialog.showModal());
  openLogin?.addEventListener('click', () => loginDialog.showModal());
  document.getElementById('gateRegister')?.addEventListener('click', () => registerDialog.showModal());
  document.getElementById('gateLogin')?.addEventListener('click', () => loginDialog.showModal());

  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    renderAuthStatus();
  });

  document.getElementById('closeFlag')?.addEventListener('click', () => {
    const overlay = document.getElementById('adminFlagOverlay');
    if (overlay) overlay.hidden = true;
  });

  registerDialog.addEventListener('close', () => {
    if (registerDialog.returnValue !== 'submit' || !registerForm) return;

    const formData = new FormData(registerForm);
    const username = normalizeInput(formData.get('username'));
    const password = normalizeInput(formData.get('password'));
    const accounts = getAccounts();

    if (!isSafeText(username, 40) || !isSafeText(password, 80)) {
      alert('Недопустимые символы в логине или пароле.');
      return;
    }

    if (accounts.some((u) => u.username === username)) {
      alert('Такой логин уже существует.');
      return;
    }

    accounts.push({ username, password, role: 'user' });
    saveAccounts(accounts);
    alert('Аккаунт создан. Теперь можно войти.');
    registerForm.reset();
  });

  loginDialog.addEventListener('close', () => {
    if (loginDialog.returnValue !== 'submit' || !loginForm) return;

    const formData = new FormData(loginForm);
    const username = normalizeInput(formData.get('username'));
    const password = normalizeInput(formData.get('password'));

    if (!isSafeText(username, 40) || !isSafeText(password, 80)) {
      alert('Недопустимые символы в логине или пароле.');
      return;
    }

    const account = getAccounts().find((u) => u.username === username && u.password === password);

    if (!account) {
      alert('Неверный логин или пароль.');
      return;
    }

    setCurrentUser(account);
    renderAuthStatus();
    loginForm.reset();
  });

  document.querySelectorAll('.comment-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const user = getCurrentUser();
      if (!user) {
        alert('Сначала войди в аккаунт, чтобы оставить комментарий.');
        return;
      }

      const input = form.querySelector('input[name="comment"]');
      const text = normalizeInput(input?.value);
      const movieId = form.closest('.movie-card')?.dataset.movieId;

      if (!isSafeText(text, 300) || !movieId) {
        alert('Комментарий содержит недопустимые символы.');
        return;
      }

      const comments = getComments();
      if (!comments[movieId]) comments[movieId] = [];
      comments[movieId].push({ user: user.username, text });
      saveComments(comments);
      form.reset();
      renderComments();
    });
  });
}

setupMoviePage();
