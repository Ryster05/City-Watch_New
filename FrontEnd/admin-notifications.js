// Global state
let notifications = [];
let currentPage = 1;
const itemsPerPage = 25; // Show more items per page
let filters = {
    status: 'all',
    search: ''
};

// Fetch notifications from the server
async function fetchNotifications() {
    try {
        const token = localStorage.getItem('cw_token');
        const API_BASE = window.location.origin === 'null' || window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
        // Set a very high limit to get all notifications
        const response = await fetch(`${API_BASE}/api/admin/notifications?limit=999999`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch notifications');
        const data = await response.json();
        notifications = data.notifications || data || [];
        updateStats();
        renderNotifications();
    } catch (error) {
        console.error('Error fetching notifications:', error);
        
    }
}

// Update notification statistics
function updateStats() {
    const stats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.read).length,
        reports: notifications.filter(n => n.reportId).length
    };

    document.getElementById('total-count').textContent = stats.total;
    document.getElementById('unread-count').textContent = stats.unread;
    document.getElementById('today-count').textContent = stats.reports;

    // Update the stat labels
    document.querySelectorAll('.stat-label')[0].textContent = 'All Time Total';
    document.querySelectorAll('.stat-label')[1].textContent = 'Unread';
    document.querySelectorAll('.stat-label')[2].textContent = 'Report Related';
}

// Filter notifications based on current filters
function filterNotifications() {
    return notifications.filter(notification => {
        const matchesStatus = filters.status === 'all' || 
            (filters.status === 'read' ? notification.read : !notification.read);
        const matchesSearch = notification.message.toLowerCase().includes(filters.search.toLowerCase()) ||
            notification.title.toLowerCase().includes(filters.search.toLowerCase());
        
        return matchesStatus && matchesSearch;
    });
}

// Render notifications with pagination
function renderNotifications() {
    const filteredNotifications = filterNotifications();
    
    // Sort notifications by date (newest first)
    filteredNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageNotifications = filteredNotifications.slice(start, end);

    // Render notifications
    const container = document.getElementById('notification-list');
    if (!pageNotifications || pageNotifications.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #64748b;">No notifications found</div>';
        return;
    }

    container.innerHTML = pageNotifications.map(notification => {
        const unreadClass = notification.read ? '' : 'unread';
        const avatar = (notification.data && notification.data.reporter && notification.data.reporter.name) 
            ? escapeHtml(notification.data.reporter.name.charAt(0).toUpperCase()) 
            : 'A';
        const time = formatDate(notification.createdAt);
        const reportId = notification.reportId || (notification.data && (notification.data.reportId || notification.data.id || notification.data._id)) || '';
        
        return `
            <div class="notification-item ${unreadClass}" data-id="${notification.id || notification._id}">
                <div class="notification-avatar">${avatar}</div>
                <div class="notification-content">
                    <div class="notification-meta">
                        <div class="notification-message">${escapeHtml(notification.message)}</div>
                        <div class="notification-time">${time}</div>
                    </div>
                    ${reportId ? `
                        <div class="notification-actions">
                            <a href="CityWatch-Admin-Reports.html?openReport=${encodeURIComponent(reportId)}" class="notification-link">
                                View Report
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Update pagination
    renderPagination(totalPages);

    // Update counters
    document.querySelector('.showing-info').textContent = 
        `Showing ${start + 1}-${Math.min(end, filteredNotifications.length)} of ${filteredNotifications.length}`;
}

// Render pagination controls
function renderPagination(totalPages) {
    const pagination = document.querySelector('.pagination');
    let buttons = [
        `<button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Previous</button>`
    ];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            buttons.push(
                `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`
            );
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            buttons.push('<button disabled>...</button>');
        }
    }

    buttons.push(
        `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next</button>`
    );

    pagination.innerHTML = buttons.join('');
}

// Change current page
function changePage(page) {
    currentPage = page;
    renderNotifications();
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 1000 * 60) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 1000 * 60 * 60) { // Less than 1 hour
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 1000 * 60 * 60 * 24) { // Less than 24 hours
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < 1000 * 60 * 60 * 24 * 7) { // Less than 7 days
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = '#1e293b';
        toast.style.color = '#fff';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '6px';
        toast.style.zIndex = '1000';
        toast.style.transition = 'opacity 0.3s';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

async function markAllAsRead() {
    try {
        const token = localStorage.getItem('cw_token');
        const API_BASE = window.location.origin === 'null' || window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
        const res = await fetch(`${API_BASE}/api/admin/notifications/mark-all-read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            throw new Error('Failed to mark all as read');
        }

        // Refresh the list
        await fetchNotifications();
        showToast('All notifications marked as read');
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark all as read');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and is admin
    const token = localStorage.getItem('cw_token');
    const role = localStorage.getItem('cw_user_role');
    if (!token || role !== 'admin') {
        window.location.href = 'CityWatch-Login-New.html';
        return;
    }

    // Initialize filters
    document.getElementById('filter-status').addEventListener('change', e => {
        filters.status = e.target.value;
        currentPage = 1;
        renderNotifications();
    });

    document.getElementById('search-input').addEventListener('input', e => {
        filters.search = e.target.value;
        currentPage = 1;
        renderNotifications();
    });

    // Handle mark as read/unread
    document.getElementById('notification-list').addEventListener('click', async e => {
        const notificationItem = e.target.closest('.notification-item');
        if (!notificationItem) return;

        const notificationId = notificationItem.dataset.id;
        if (!notificationId) return;

        // If clicked on a link, don't mark as read
        if (e.target.closest('a')) return;

        const isRead = !notificationItem.classList.contains('unread');
        
        try {
            const token = localStorage.getItem('cw_token');
            const API_BASE = window.location.origin === 'null' || window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
            const res = await fetch(`${API_BASE}/api/admin/notifications/${notificationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ read: !isRead })
            });
            
            if (!res.ok) throw new Error('Failed to update notification');

            // Update local state
            const notification = notifications.find(n => (n.id || n._id) === notificationId);
            if (notification) {
                notification.read = !isRead;
                updateStats();
                renderNotifications();
            }
        } catch (error) {
            console.error('Error updating notification:', error);
        }
    });

    // Set up user info
    try {
        const user = JSON.parse(localStorage.getItem('cw_user') || '{}');
        const name = user.name || 'Admin';
        document.getElementById('user-name').textContent = name;
        document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
    } catch(e) {
        console.error('Error setting user info:', e);
    }

    // Initial load
    fetchNotifications();

    // Set up auto-refresh every 30 seconds
    setInterval(fetchNotifications, 30000);
});