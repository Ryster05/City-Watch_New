// Notification Bell Component
class NotificationBell {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.dropdownVisible = false;
        this.initializeUI();
        this.addEventListeners();
        this.fetchNotifications();
    }

    initializeUI() {
        // Create notification bell HTML
        const bellHTML = `
            <div class="notification-bell" id="notification-bell">
                <i class='bx bx-bell'></i>
                <span class="notification-count" id="notification-count">0</span>
                <div class="notification-dropdown" id="notification-dropdown">
                    <div class="dropdown-header">
                        <h3>Notifications</h3>
                        <a href="CityWatch-Admin-Notification.html">View All</a>
                    </div>
                    <div class="dropdown-list" id="notification-list">
                        <!-- Notifications will be loaded here -->
                    </div>
                </div>
            </div>
        `;

        // Insert the bell before the user avatar in the user menu
        const userMenu = document.querySelector('.user-menu');
        if (userMenu) {
            userMenu.insertAdjacentHTML('afterbegin', bellHTML);
        }
    }

    addEventListeners() {
        // Toggle dropdown on bell click
        const bell = document.getElementById('notification-bell');
        if (bell) {
            bell.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#notification-bell')) {
                this.hideDropdown();
            }
        });
    }

    async fetchNotifications() {
        try {
            const token = localStorage.getItem('cw_token');
            const API_BASE = window.location.origin === 'null' || window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
            const response = await fetch(`${API_BASE}/api/admin/notifications?limit=5`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch notifications');
            
            const data = await response.json();
            this.notifications = data.notifications || [];
            this.unreadCount = this.notifications.filter(n => !n.read).length;
            this.updateUI();
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    updateUI() {
        // Update notification count
        const countElement = document.getElementById('notification-count');
        if (countElement) {
            countElement.textContent = this.unreadCount;
            countElement.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }

        // Update dropdown list
        const listElement = document.getElementById('notification-list');
        if (listElement) {
            if (this.notifications.length === 0) {
                listElement.innerHTML = `
                    <div class="dropdown-empty">
                        No notifications
                    </div>
                `;
                return;
            }

            listElement.innerHTML = this.notifications.map(notification => {
                const unreadClass = notification.read ? '' : 'unread';
                const avatar = (notification.data && notification.data.reporter && notification.data.reporter.name)
                    ? this.escapeHtml(notification.data.reporter.name.charAt(0).toUpperCase())
                    : 'A';
                const time = this.timeAgo(notification.createdAt);
                const reportId = notification.reportId || (notification.data && (notification.data.reportId || notification.data.id || notification.data._id)) || '';

                return `
                    <div class="dropdown-item ${unreadClass}" data-id="${notification.id || notification._id}">
                        <div class="dropdown-item-avatar">${avatar}</div>
                        <div class="dropdown-item-content">
                            <div class="dropdown-item-message">${this.escapeHtml(notification.message)}</div>
                            <div class="dropdown-item-time">${time}</div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            listElement.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    if (id) {
                        this.markAsRead(id);
                    }
                });
            });
        }
    }

    toggleDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            this.dropdownVisible = !this.dropdownVisible;
            dropdown.classList.toggle('show', this.dropdownVisible);
            if (this.dropdownVisible) {
                this.fetchNotifications(); // Refresh notifications when opening
            }
        }
    }

    hideDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && this.dropdownVisible) {
            this.dropdownVisible = false;
            dropdown.classList.remove('show');
        }
    }

    async markAsRead(id) {
        try {
            const token = localStorage.getItem('cw_token');
            const API_BASE = window.location.origin === 'null' || window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
            const response = await fetch(`${API_BASE}/api/admin/notifications/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ read: true })
            });

            if (!response.ok) throw new Error('Failed to mark notification as read');

            // Update local state
            const notification = this.notifications.find(n => (n.id || n._id) === id);
            if (notification) {
                notification.read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateUI();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    timeAgo(iso) {
        if (!iso) return '';
        const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
        if (diff < 10) return 'just now';
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
        return new Date(iso).toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    startAutoRefresh() {
        // Refresh notifications every 30 seconds
        setInterval(() => this.fetchNotifications(), 30000);
    }
}

// Initialize the notification bell when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('cw_token') && localStorage.getItem('cw_user_role') === 'admin') {
        const notificationBell = new NotificationBell();
        notificationBell.startAutoRefresh();
    }
});