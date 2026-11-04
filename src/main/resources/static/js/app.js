document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const countGreenEl = document.getElementById('count-green');
    const countYellowEl = document.getElementById('count-yellow');
    const countRedEl = document.getElementById('count-red');
    const todayDisplayEl = document.getElementById('today-display');
    const shelvesContainerEl = document.getElementById('shelves-container');
    const btnAddShelf = document.getElementById('btn-add-shelf');

    // Modal Elements
    const itemModal = document.getElementById('item-modal');
    const itemForm = document.getElementById('item-form');
    const formShelfId = document.getElementById('form-shelf-id');
    const formItemName = document.getElementById('form-item-name');
    const formThawDays = document.getElementById('form-thaw-days');
    const formKeepDays = document.getElementById('form-keep-days');
    const formThawDate = document.getElementById('form-thaw-date');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalTitle = document.getElementById('modal-title');

    // Toast
    const toastEl = document.getElementById('toast');
    let toastTimeout = null;

    // State
    let draggedItemData = null; // { itemId, sourceShelfId, sourceIndex }
    let currentlySwipedCard = null; // currently open swipe card

    // 取得今天 YYYY-MM-DD
    function getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 格式化日期簡短顯示 (例: 2026-10-31 -> 10/31)
    function formatShortDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}`;
        }
        return dateStr;
    }

    const todayStr = getTodayString();
    todayDisplayEl.textContent = `今天：${todayStr}`;

    // 顯示 iOS 風格膠囊 Toast 訊息
    function showToast(message, type = 'info') {
        if (toastTimeout) clearTimeout(toastTimeout);
        toastEl.textContent = message;
        toastEl.className = `toast ${type}`;
        toastTimeout = setTimeout(() => {
            toastEl.className = 'toast hidden';
        }, 3200);
    }

    // 點擊空白處關閉已滑動打開的層架
    document.addEventListener('click', (e) => {
        if (currentlySwipedCard && !currentlySwipedCard.closest('.shelf-swipe-wrapper').contains(e.target)) {
            currentlySwipedCard.classList.remove('swiped-open');
            currentlySwipedCard = null;
        }
    });

    // 載入資料
    async function loadData() {
        try {
            const [shelvesRes, summaryRes] = await Promise.all([
                fetch('/api/shelves'),
                fetch('/api/status/summary')
            ]);

            if (!shelvesRes.ok || !summaryRes.ok) {
                throw new Error('伺服器連線異常，請確認後端是否運行');
            }

            const shelves = await shelvesRes.json();
            const summary = await summaryRes.json();

            renderSummary(summary);
            renderShelves(shelves);
        } catch (err) {
            console.error(err);
            shelvesContainerEl.innerHTML = `<div class="loading-state" style="color: var(--ios-red);">載入失敗：${err.message}</div>`;
        }
    }

    // 渲染頂部狀態統計
    function renderSummary(summary) {
        countGreenEl.textContent = summary.green || 0;
        countYellowEl.textContent = summary.yellow || 0;
        countRedEl.textContent = summary.red || 0;
    }

    // 渲染所有層架
    function renderShelves(shelves) {
        shelvesContainerEl.innerHTML = '';

        if (!shelves || shelves.length === 0) {
            shelvesContainerEl.innerHTML = '<div class="loading-state">目前尚無層架，請點擊下方虛擬方塊新增一層。</div>';
            return;
        }

        shelves.forEach((shelf, shelfIndex) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'shelf-swipe-wrapper';

            // 背後 iOS 紅色垃圾桶刪除按鈕
            const actions = document.createElement('div');
            actions.className = 'shelf-swipe-actions';
            actions.innerHTML = `
                <button type="button" class="shelf-delete-btn" title="刪除此層架">
                    <span class="trash-icon">🗑️</span>
                    <span>刪除</span>
                </button>
            `;

            // 前景層架卡片
            const card = document.createElement('div');
            card.className = 'shelf-card';
            card.dataset.shelfId = shelf.id;

            // 綁定向左滑動手勢
            setupShelfSwipe(card, wrapper, shelf);

            // 綁定垃圾桶刪除點擊
            const deleteBtn = actions.querySelector('.shelf-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteShelf(shelf.id, shelf.name, card);
            });

            // 層架頂部 Header
            const header = document.createElement('div');
            header.className = 'shelf-header';

            const titleArea = document.createElement('div');
            titleArea.className = 'shelf-title-area';

            const badge = document.createElement('span');
            badge.className = 'shelf-badge';
            badge.textContent = `第 ${shelfIndex + 1} 層`;

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'shelf-name-input';
            nameInput.value = shelf.name;
            nameInput.title = '點擊可編輯層架名稱，留空自動還原預設名稱';

            nameInput.addEventListener('blur', async () => {
                if (nameInput.value !== shelf.name) {
                    await updateShelfName(shelf.id, nameInput.value);
                }
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    nameInput.blur();
                }
            });

            const countSpan = document.createElement('span');
            countSpan.className = 'shelf-item-count';
            countSpan.textContent = `（${shelf.items.length} 品項）`;

            titleArea.appendChild(badge);
            titleArea.appendChild(nameInput);
            titleArea.appendChild(countSpan);

            const hintArea = document.createElement('div');
            hintArea.className = 'shelf-swipe-hint';
            hintArea.textContent = '👈 左滑刪除';

            header.appendChild(titleArea);
            header.appendChild(hintArea);
            card.appendChild(header);

            // 層架品項陳列區
            const rack = document.createElement('div');
            rack.className = 'shelf-items-rack';
            rack.dataset.shelfId = shelf.id;

            // 啟用拖曳放置
            setupRackDropZone(rack, shelf.id);

            // 渲染簡約品項卡片（解1放3）
            shelf.items.forEach((item, itemIndex) => {
                const itemCard = createSimplifiedItemCard(item, shelf.id, itemIndex);
                rack.appendChild(itemCard);
            });

            // 右側「+ 新增品項」虛擬方塊
            const addCard = document.createElement('div');
            addCard.className = 'add-item-card ios-tappable';
            addCard.title = `在「${shelf.name}」新增品項`;
            addCard.innerHTML = `
                <div class="add-item-icon">＋</div>
                <div class="add-item-text">新增品項</div>
            `;
            addCard.addEventListener('click', () => openAddItemModal(shelf.id, shelf.name));
            rack.appendChild(addCard);

            card.appendChild(rack);
            wrapper.appendChild(actions);
            wrapper.appendChild(card);
            shelvesContainerEl.appendChild(wrapper);
        });
    }

    // 建立 iOS 極簡風格品項卡片（核心：顯示「解1放3」）
    function createSimplifiedItemCard(item, shelfId, itemIndex) {
        const card = document.createElement('div');
        const colorClass = item.statusColor.toLowerCase();
        card.className = `item-card card-${colorClass} ios-tappable`;
        card.draggable = true;
        card.dataset.itemId = item.id;
        card.dataset.shelfId = shelfId;
        card.dataset.itemIndex = itemIndex;

        const pillClass = `pill-${colorClass}`;
        const shortDiscardDate = formatShortDate(item.discardDate);

        card.innerHTML = `
            <div>
                <div class="item-card-header">
                    <span class="item-name">${escapeHtml(item.name)}</span>
                    <button type="button" class="btn-delete ios-tappable" title="刪除品項">✕</button>
                </div>

                <!-- 簡潔規格與狀態：顯示「解1放3」與當前天數狀態 -->
                <div class="item-specs-row">
                    <span class="spec-badge">解${item.thawDays}放${item.keepDays}</span>
                    <span class="item-status-pill ${pillClass}">${item.statusText}</span>
                </div>

                <!-- 丟棄期限一目了然 -->
                <div class="item-discard-info">
                    <span>到期日</span>
                    <span class="discard-date">${shortDiscardDate}</span>
                </div>
            </div>

            <!-- iOS 換標按鈕 -->
            <div>
                <button type="button" class="btn-retag ios-tappable">換標（今日）</button>
            </div>
        `;

        // 綁定換標
        const retagBtn = card.querySelector('.btn-retag');
        retagBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRetag(item);
        });

        // 綁定刪除品項
        const deleteBtn = card.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteItem(item);
        });

        // 綁定品項拖曳
        card.addEventListener('dragstart', (e) => {
            draggedItemData = {
                itemId: item.id,
                sourceShelfId: shelfId,
                sourceIndex: itemIndex
            };
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            document.querySelectorAll('.shelf-items-rack').forEach(r => r.classList.remove('drag-over'));
        });

        return card;
    }

    // 設定 iOS 向左滑動手勢 (Swipe to Delete)
    function setupShelfSwipe(card, wrapper, shelf) {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isTouching = false;
        let isHorizontalSwipe = false;

        const handleStart = (clientX, clientY) => {
            // 如果點擊的是輸入框或按鈕，不觸發滑動
            startX = clientX;
            startY = clientY;
            currentX = clientX;
            isTouching = true;
            isHorizontalSwipe = false;

            if (currentlySwipedCard && currentlySwipedCard !== card) {
                currentlySwipedCard.classList.remove('swiped-open');
                currentlySwipedCard = null;
            }
        };

        const handleMove = (clientX, clientY) => {
            if (!isTouching) return;
            const diffX = clientX - startX;
            const diffY = clientY - startY;

            if (!isHorizontalSwipe) {
                if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
                    isHorizontalSwipe = true;
                } else if (Math.abs(diffY) > 10) {
                    isTouching = false;
                    return;
                }
            }

            if (isHorizontalSwipe) {
                currentX = clientX;
                // 由右向左滑為負值
                if (diffX < 0) {
                    const translateX = Math.max(-90, diffX);
                    card.style.transform = `translateX(${translateX}px)`;
                } else if (card.classList.contains('swiped-open')) {
                    // 若已展開，向右滑收回
                    const translateX = Math.min(0, -90 + diffX);
                    card.style.transform = `translateX(${translateX}px)`;
                }
            }
        };

        const handleEnd = () => {
            if (!isTouching) return;
            isTouching = false;
            card.style.transform = ''; // 清除 inline transform，交由 CSS class 控制

            const diffX = currentX - startX;
            if (diffX < -40) {
                // 成功展開向左滑動
                card.classList.add('swiped-open');
                currentlySwipedCard = card;
            } else {
                card.classList.remove('swiped-open');
                if (currentlySwipedCard === card) currentlySwipedCard = null;
            }
        };

        // 觸控事件 (Mobile Touch)
        card.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.closest('.item-card') || e.target.closest('.add-item-card')) return;
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!isTouching) return;
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        card.addEventListener('touchend', handleEnd);

        // 滑鼠事件 (Desktop Mouse Drag on Shelf Header)
        const header = card.querySelector('.shelf-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            handleStart(e.clientX, e.clientY);

            const onMouseMove = (moveEvent) => {
                handleMove(moveEvent.clientX, moveEvent.clientY);
            };

            const onMouseUp = () => {
                handleEnd();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // 刪除層架處理（含防護檢查）
    async function handleDeleteShelf(shelfId, shelfName, card) {
        if (!confirm(`確定要刪除「${shelfName}」嗎？\n注意：若該層仍有品項則無法刪除。`)) {
            card.classList.remove('swiped-open');
            return;
        }

        try {
            const res = await fetch(`/api/shelves/${shelfId}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || '刪除層架失敗');
            }

            showToast(`已成功刪除「${shelfName}」`, 'success');
            await loadData();
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
            card.classList.remove('swiped-open');
        }
    }

    // 設定品項拖曳放置區
    function setupRackDropZone(rack, shelfId) {
        rack.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            rack.classList.add('drag-over');
        });

        rack.addEventListener('dragleave', (e) => {
            if (!rack.contains(e.relatedTarget)) {
                rack.classList.remove('drag-over');
            }
        });

        rack.addEventListener('drop', async (e) => {
            e.preventDefault();
            rack.classList.remove('drag-over');

            if (!draggedItemData) return;

            const afterElement = getDragAfterElement(rack, e.clientX, e.clientY);
            let targetIndex;

            if (afterElement == null) {
                const itemCards = rack.querySelectorAll('.item-card:not(.dragging)');
                targetIndex = itemCards.length;
            } else {
                targetIndex = parseInt(afterElement.dataset.itemIndex, 10);
            }

            try {
                const res = await fetch('/api/items/move', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemId: draggedItemData.itemId,
                        targetShelfId: shelfId,
                        targetIndex: targetIndex
                    })
                });

                if (!res.ok) throw new Error('移動品項失敗');
                await loadData();
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
            } finally {
                draggedItemData = null;
            }
        });
    }

    function getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.item-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const inSameRow = (y >= box.top && y <= box.bottom);
            const offset = inSameRow ? (x - box.left - box.width / 2) : (y - box.top - box.height / 2);

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // 更新層架名稱
    async function updateShelfName(shelfId, newName) {
        try {
            const res = await fetch(`/api/shelves/${shelfId}/name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            if (!res.ok) throw new Error('更新層架名稱失敗');
            await loadData();
            showToast('已更新層架名稱', 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    }

    // 換標行為（更新為今日）
    async function handleRetag(item) {
        if (!confirm(`確定要將「${item.name}」換標為今日嗎？\n解凍日將更新為 ${todayStr}，並重新計算保存期限。`)) {
            return;
        }

        try {
            const res = await fetch(`/api/items/${item.id}/retag`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thawDate: todayStr })
            });

            if (!res.ok) throw new Error('換標失敗');
            await loadData();
            showToast(`已完成「${item.name}」換標！`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    }

    // 刪除品項
    async function handleDeleteItem(item) {
        if (!confirm(`確定要刪除品項「${item.name}」嗎？`)) {
            return;
        }

        try {
            const res = await fetch(`/api/items/${item.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('刪除失敗');
            await loadData();
            showToast(`已刪除「${item.name}」`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    }

    // 點擊最下方虛擬方塊「新增層架」
    if (btnAddShelf) {
        btnAddShelf.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/shelves', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ name: "" })
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || '新增層架失敗');
                }

                showToast('已成功新增一層層架！', 'success');
                await loadData();

                // 平滑捲動至新層架
                setTimeout(() => {
                    const allWrappers = document.querySelectorAll('.shelf-swipe-wrapper');
                    if (allWrappers.length > 0) {
                        allWrappers[allWrappers.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
            }
        });
    }

    // 打開新增品項視窗
    function openAddItemModal(shelfId, shelfName) {
        formShelfId.value = shelfId;
        modalTitle.textContent = `在「${shelfName}」新增品項`;
        itemForm.reset();
        formThawDays.value = 1;
        formKeepDays.value = 2;
        formThawDate.value = todayStr;
        itemModal.classList.remove('hidden');
        formItemName.focus();
    }

    function closeAddItemModal() {
        itemModal.classList.add('hidden');
    }

    modalCloseBtn.addEventListener('click', closeAddItemModal);
    modalCancelBtn.addEventListener('click', closeAddItemModal);

    itemModal.addEventListener('click', (e) => {
        if (e.target === itemModal) {
            closeAddItemModal();
        }
    });

    // 送出新增品項
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const shelfId = formShelfId.value;
        const name = formItemName.value.trim();
        const thawDays = parseInt(formThawDays.value, 10);
        const keepDays = parseInt(formKeepDays.value, 10);
        const thawDate = formThawDate.value;

        if (!name) {
            alert('請輸入品名');
            return;
        }

        try {
            const res = await fetch(`/api/shelves/${shelfId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    thawDays: thawDays,
                    keepDays: keepDays,
                    thawDate: thawDate
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || '新增品項失敗');
            }

            closeAddItemModal();
            await loadData();
            showToast(`已新增品項「${name}」！`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
        }
    });

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 啟動載入
    loadData();
});
