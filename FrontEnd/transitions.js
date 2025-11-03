// Page transition functionality
function initPageTransitions() {
    // Create transition overlay if it doesn't exist
    if (!document.querySelector('.page-transition')) {
        const overlay = document.createElement('div');
        overlay.className = 'page-transition';
        document.body.appendChild(overlay);
    }

    // Add main-content class to main sections
    document.querySelectorAll('main, .hero, .getting-started').forEach(section => {
        if (!section.classList.contains('main-content')) {
            section.classList.add('main-content');
        }
    });

    // Add animated-list class to lists and grids
    document.querySelectorAll('.steps, .notification-list, .reports-list').forEach(list => {
        if (!list.classList.contains('animated-list')) {
            list.classList.add('animated-list');
        }
        // Add animation delay to children
        Array.from(list.children).forEach((item, index) => {
            item.style.animationDelay = `${index * 0.1}s`;
        });
    });

    // Handle all navigation links
    document.querySelectorAll('a').forEach(link => {
        // Only handle internal links
        if (link.href && link.href.startsWith(window.location.origin)) {
            link.addEventListener('click', handleNavigation);
        }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        handlePageTransition();
    });
}

function handleNavigation(e) {
    const href = e.currentTarget.href;
    if (href) {
        e.preventDefault();
        handlePageTransition(href);
    }
}

async function handlePageTransition(url) {
    // Fade out current content
    document.querySelectorAll('.main-content').forEach(content => {
        content.style.opacity = '0';
        content.style.transform = 'translateY(20px)';
    });
    
    // Short delay for fade out
    await new Promise(resolve => setTimeout(resolve, 300));

    // Navigate to new page
    if (url) {
        window.location.href = url;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initPageTransitions();
});

// Handle page visibility for smoother transitions
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        const overlay = document.querySelector('.page-transition');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
});