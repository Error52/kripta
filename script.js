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

const DATABASE_KEY = 'kino_database_v1';
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

function readDb() {
  const initial = {
    users: [{ username: 'kinoadmin', password: 'passAdminKino', role: 'admin' }],
    currentUser: null,
    comments: {}
  };

  const raw = localStorage.getItem(DATABASE_KEY);
  if (!raw) {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.users || !parsed.comments) return initial;
    if (!parsed.users.some((u) => u.username === 'kinoadmin')) {
      parsed.users.push({ username: 'kinoadmin', password: 'passAdminKino', role: 'admin' });
    }
    return parsed;
  } catch {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function writeDb(db) {
  localStorage.setItem(DATABASE_KEY, JSON.stringify(db));
}

function getCurrentUser() {
  return readDb().currentUser;
}

function setCurrentUser(user) {
  const db = readDb();
  db.currentUser = user;
  writeDb(db);
}

function renderAuthStatus() {
  const status = document.getElementById('authStatus');
  if (!status) return;

  const user = getCurrentUser();
  const overlay = document.getElementById('adminFlagOverlay');
  const gate = document.getElementById('authGate');
  const flagValue = document.getElementById('flagValue');
  const flag = ['flag', '{kin0_3z_f0r_bug_bounty}'].join('');

  if (user) {
    status.textContent = `Ты вошёл как ${user.username}${user.role === 'admin' ? ' (admin)' : ''}`;
    if (overlay && user.role === 'admin') overlay.hidden = false;
    if (flagValue) flagValue.textContent = user.role === 'admin' ? flag : '';
    if (gate) gate.hidden = true;
  } else {
    status.textContent = 'Ты не авторизован. Войди, чтобы оставлять комментарии.';
    if (overlay) overlay.hidden = true;
    if (flagValue) flagValue.textContent = '';
    if (gate) gate.hidden = false;
  }
}

function getAccounts() {
  return readDb().users;
}

function saveAccounts(accounts) {
  const db = readDb();
  db.users = accounts;
  writeDb(db);
}

function getComments() {
  return readDb().comments;
}

function saveComments(comments) {
  const db = readDb();
  db.comments = comments;
  writeDb(db);
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


function setupSearch() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('movieSearch');
  if (!form || !input) return;

  const params = new URLSearchParams(window.location.search);
  const initialQuery = normalizeInput(params.get('search'));
  input.value = initialQuery;

  const applyFilter = (query) => {
    const q = normalizeInput(query).toLowerCase();
    document.querySelectorAll('.movie-card').forEach((card) => {
      const title = (card.querySelector('h3')?.textContent || '').toLowerCase();
      card.hidden = q ? !title.includes(q) : false;
    });
  };

  applyFilter(initialQuery);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = normalizeInput(input.value);
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('search', query);
    } else {
      url.searchParams.delete('search');
    }
    window.history.replaceState({}, '', url);
    applyFilter(query);
  });
}

function setupMoviePage() {
  const registerDialog = document.getElementById('registerDialog');
  const loginDialog = document.getElementById('loginDialog');
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');

  if (!registerDialog) return;

  readDb();
  renderAuthStatus();
  renderComments();
  setupSearch();

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const dialogId = button.dataset.openDialog;
    if (dialogId) {
      const targetDialog = document.getElementById(dialogId);
      if (targetDialog && !targetDialog.open) targetDialog.showModal();
      return;
    }

    if (button.dataset.action === 'logout') {
      setCurrentUser(null);
      renderAuthStatus();
    }
  });

  document.getElementById('closeFlag')?.addEventListener('click', () => {
    const overlay = document.getElementById('adminFlagOverlay');
    if (overlay) overlay.hidden = true;
  });


  document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });

  registerForm?.addEventListener('submit', (event) => {
    event.preventDefault();

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
    registerDialog.close();
  });

  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();

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
    loginDialog.close();
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
  setupSearch();
    });
  });
}

setupMoviePage();
