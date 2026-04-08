const state = {
  categories: [
    { category_id: 1, category_name: 'Напитки' },
    { category_id: 2, category_name: 'Салаты' },
    { category_id: 3, category_name: 'Горячее' }
  ],
  items: [
    { item_id: 1, category_id: 1, item_name: 'Кофе американо', price: 180, is_available: true },
    { item_id: 2, category_id: 1, item_name: 'Чай зелёный', price: 150, is_available: true },
    { item_id: 3, category_id: 2, item_name: 'Цезарь', price: 420, is_available: true },
    { item_id: 4, category_id: 3, item_name: 'Паста карбонара', price: 530, is_available: true },
    { item_id: 5, category_id: 3, item_name: 'Стейк', price: 1200, is_available: false }
  ],
  waiters: [
    { waiter_id: 1, first_name: 'Анна', last_name: 'Иванова', shift: 'morning' },
    { waiter_id: 2, first_name: 'Олег', last_name: 'Смирнов', shift: 'evening' }
  ],
  tables: Array.from({ length: 9 }, (_, i) => ({ table_id: i + 1, table_number: i + 1, seats: i % 2 ? 4 : 2, zone: i > 5 ? 'terrace' : 'main' })),
  orders: [],
  currentOrderId: null
};

const el = (id) => document.getElementById(id);

function renderTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      btn.classList.add('active');
      el(btn.dataset.tab).classList.add('active');
      renderAll();
    };
  });
}

function openOrderForTable(tableId, waiterId) {
  let order = state.orders.find((o) => o.table_id === tableId && o.status === 'open');
  if (!order) {
    order = {
      order_id: Date.now(),
      table_id: tableId,
      waiter_id: waiterId,
      order_date: new Date(),
      status: 'open',
      payment_method: null,
      items: []
    };
    state.orders.push(order);
  }
  state.currentOrderId = order.order_id;
}

function getCurrentOrder() {
  return state.orders.find((o) => o.order_id === state.currentOrderId && o.status === 'open');
}

function calcTotal(order) {
  return order.items.reduce((sum, it) => sum + it.quantity * it.item_price, 0);
}

function renderHall() {
  const grid = el('hallGrid');
  grid.innerHTML = '';
  state.tables.forEach((t) => {
    const busy = state.orders.some((o) => o.table_id === t.table_id && o.status === 'open');
    const card = document.createElement('button');
    card.className = `table-card ${busy ? 'busy' : 'free'}`;
    card.innerHTML = `<strong>Стол №${t.table_number}</strong><br>Мест: ${t.seats}<br>Зона: ${t.zone}`;
    card.onclick = () => showTableDialog(t.table_id);
    grid.appendChild(card);
  });
}

function showTableDialog(tableId) {
  const dlg = el('tableDialog');
  el('dialogTitle').textContent = `Столик #${tableId}`;
  const select = el('waiterSelect');
  select.innerHTML = state.waiters.map((w) => `<option value="${w.waiter_id}">${w.first_name} ${w.last_name}</option>`).join('');
  el('openOrderConfirm').onclick = (e) => {
    e.preventDefault();
    openOrderForTable(tableId, Number(select.value));
    dlg.close();
    document.querySelector('[data-tab="orders"]').click();
  };
  dlg.showModal();
}

function renderMenuFilters() {
  el('categoryFilter').innerHTML = '<option value="all">Все</option>' +
    state.categories.map((c) => `<option value="${c.category_id}">${c.category_name}</option>`).join('');
}

function addItemToOrder(itemId) {
  const order = getCurrentOrder();
  if (!order) return alert('Сначала откройте заказ со столика.');
  const item = state.items.find((i) => i.item_id === itemId);
  if (!item?.is_available) return alert('Блюдо недоступно.');
  const exists = order.items.find((i) => i.item_id === itemId);
  if (exists) {
    exists.quantity += 1;
  } else {
    order.items.push({ item_id: itemId, quantity: 1, item_price: item.price, notes: '' });
  }
  renderOrder();
  renderHall();
}

function renderMenuList() {
  const f = el('categoryFilter').value;
  const q = el('itemSearch').value.toLowerCase();
  const list = state.items.filter((i) => (f === 'all' || i.category_id === Number(f)) && i.item_name.toLowerCase().includes(q));
  el('menuList').innerHTML = list.map((i) => `<div>${i.item_name} — ${i.price} ₽ ${i.is_available ? '' : '(нет)'} <button onclick="addItemToOrder(${i.item_id})">+ В заказ</button></div>`).join('');
}

function renderOrder() {
  const order = getCurrentOrder();
  if (!order) {
    el('orderItems').innerHTML = 'Нет открытого заказа.';
    el('orderTotal').textContent = '0.00';
    return;
  }
  el('orderItems').innerHTML = order.items.map((oi) => {
    const it = state.items.find((x) => x.item_id === oi.item_id);
    return `<div>${it.item_name} x ${oi.quantity} = ${(oi.quantity * oi.item_price).toFixed(2)} ₽
      <input placeholder="примечание" value="${oi.notes}" onchange="updateNote(${oi.item_id}, this.value)">
      <button onclick="changeQty(${oi.item_id}, 1)">+</button>
      <button onclick="changeQty(${oi.item_id}, -1)">-</button>
    </div>`;
  }).join('') || 'Пусто';
  el('orderTotal').textContent = calcTotal(order).toFixed(2);
}

function changeQty(itemId, delta) {
  const order = getCurrentOrder();
  if (!order) return;
  const row = order.items.find((i) => i.item_id === itemId);
  row.quantity += delta;
  order.items = order.items.filter((i) => i.quantity > 0);
  renderOrder();
}

function updateNote(itemId, note) {
  const order = getCurrentOrder();
  if (!order) return;
  const row = order.items.find((i) => i.item_id === itemId);
  row.notes = note;
}

function closeOrder() {
  const order = getCurrentOrder();
  if (!order) return;
  if (!order.items.length) return alert('Нельзя закрыть пустой заказ.');
  order.status = 'paid';
  order.payment_method = el('paymentMethod').value;
  alert(`Заказ закрыт. Сумма: ${calcTotal(order).toFixed(2)} ₽`);
  state.currentOrderId = null;
  renderAll();
}

function renderCrud() {
  el('categoryList').innerHTML = state.categories.map((c) => `<li>${c.category_name}</li>`).join('');
  el('menuCrudList').innerHTML = state.items.map((i) => `<li>${i.item_name} — ${i.price} ₽ — ${i.is_available ? 'доступно' : 'нет'}</li>`).join('');
}

function renderReports() {
  const paid = state.orders.filter((o) => o.status === 'paid');
  const byWaiter = {};
  paid.forEach((o) => {
    const key = `${o.waiter_id}:${o.payment_method}`;
    byWaiter[key] = (byWaiter[key] || 0) + calcTotal(o);
  });
  el('shiftReport').textContent = Object.entries(byWaiter).map(([k, v]) => `waiter/payment ${k} => ${v.toFixed(2)}`).join('\n') || 'Нет данных';

  const dishStats = {};
  paid.forEach((o) => o.items.forEach((it) => {
    dishStats[it.item_id] = dishStats[it.item_id] || { qty: 0, sum: 0 };
    dishStats[it.item_id].qty += it.quantity;
    dishStats[it.item_id].sum += it.quantity * it.item_price;
  }));
  const top = Object.entries(dishStats)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 10)
    .map(([id, st]) => `${state.items.find((i) => i.item_id === Number(id)).item_name}: ${st.qty} шт, ${st.sum.toFixed(2)} ₽`);
  el('popularReport').textContent = top.join('\n') || 'Нет данных';

  const zone = {};
  paid.forEach((o) => {
    const table = state.tables.find((t) => t.table_id === o.table_id);
    const d = new Date(o.order_date).toLocaleDateString('ru-RU', { weekday: 'long' });
    const key = `${table.zone} / ${d}`;
    zone[key] = zone[key] || { sum: 0, cnt: 0 };
    zone[key].sum += calcTotal(o);
    zone[key].cnt += 1;
  });
  el('avgReport').textContent = Object.entries(zone).map(([k, v]) => `${k}: ${(v.sum / v.cnt).toFixed(2)} ₽`).join('\n') || 'Нет данных';
}

function renderAll() {
  renderHall();
  renderMenuFilters();
  renderMenuList();
  renderOrder();
  renderCrud();
  renderReports();
}

el('categoryFilter').addEventListener('change', renderMenuList);
el('itemSearch').addEventListener('input', renderMenuList);
el('closeOrderBtn').addEventListener('click', closeOrder);
el('calcReports').addEventListener('click', renderReports);
el('exportCsv').addEventListener('click', () => alert('Экспорт CSV: демо-режим.'));
el('printReceipt').addEventListener('click', () => window.print());
el('exitApp').addEventListener('click', () => alert('Закройте вкладку браузера.'));

renderTabs();
renderAll();

window.addItemToOrder = addItemToOrder;
window.changeQty = changeQty;
window.updateNote = updateNote;
