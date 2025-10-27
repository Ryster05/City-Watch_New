(function(){
  // User notifications UI helper
  // - Similar design to admin notifications but for user-specific notifications
  // - Shows badge with unread count
  // - View all toggle expands/collapses dropdown
  // - Mark as read on click
  // - Auto-polls every 30s
  
  const POLL_INTERVAL = 30000;
  const LIMIT = 50;
  const CACHE_KEY = '__userNotifications';
  const CACHE_TOTAL = '__userNotifTotal';

  function apiBase(){ return window.API_BASE || ((location.origin === 'null' || location.protocol === 'file:') ? 'http://localhost:3000' : ''); }
  function authHeader(){ const t = localStorage.getItem('cw_token'); return t ? { Authorization: 'Bearer '+t } : {}; }
  
  function timeAgo(iso){ if(!iso) return ''; const d=new Date(iso); const diff=(Date.now()-d.getTime())/1000; if(diff<60) return 'just now'; if(diff<3600) return Math.floor(diff/60)+'m'; if(diff<86400) return Math.floor(diff/3600)+'h'; return d.toLocaleDateString(); }

  async function fetchNotifications(){
    try {
      const res = await fetch(apiBase() + `/api/notifications?limit=${LIMIT}`, { headers: { ...authHeader() } });
      if(!res.ok) return { items: [], total: 0 };
      const data = await res.json();
      const items = data.notifications || data.items || data || [];
      const total = (typeof data.total === 'number') ? data.total : (Array.isArray(items) ? items.length : 0);
      return { items, total };
    } catch(e){ console.error('user-notifs fetch failed', e); return { items: [], total: 0 }; }
  }

  function findElements(){
    const btn = document.querySelector('#notification-bell');
    const dd = document.querySelector('#notification-dropdown');
    const badge = document.querySelector('#notification-count');
    const viewAll = document.querySelector('#notif-view-all') || document.querySelector('#notif-viewall');
    const list = dd && (dd.querySelector('#notification-list') || (function(){ const el = document.createElement('div'); el.id='notification-list'; dd.appendChild(el); return el; })());
    return { btn, dd, badge, viewAll, list };
  }

  function renderList(items, total, dd, showAll){
    if(!dd) return;
    const listWrap = dd.querySelector('#notif-list');
    if(!listWrap) return;
    
    listWrap.innerHTML = '';
    const toShow = showAll ? items : (items||[]).slice(0,5);
    if(!toShow || toShow.length===0){ listWrap.innerHTML = '<div style="padding:14px;color:#64748b;text-align:center">No notifications</div>'; }
    
    for(const n of toShow){
      const item = document.createElement('div');
      item.className = 'notif-item '+(n.read?'':'unread');
      item.style.display = 'flex';
      item.style.gap = '10px';
      item.style.padding = '10px';
      item.style.borderBottom = '1px solid #eef2f7';
      item.style.cursor = 'pointer';

      const icon = document.createElement('div');
      icon.className = 'notif-icon';
      icon.style.width = '36px';
      icon.style.height = '36px';
      icon.style.borderRadius = '50%';
      icon.style.display = 'flex';
      icon.style.alignItems = 'center';
      icon.style.justifyContent = 'center';
      icon.style.background = n.read ? '#f1f5f9' : '#eef2ff';
      icon.style.color = n.read ? '#64748b' : '#2563eb';
      icon.innerHTML = '<i class="bx bx-bell"></i>';

      const body = document.createElement('div');
      body.className = 'notif-body';
      body.style.flex = '1';
      body.innerHTML = `<div class="meta" style="color:#0f172a${n.read?';opacity:0.8':''}">${escapeHtml(n.message||'New notification')}</div>`;

      const time = document.createElement('div');
      time.className = 'notif-time';
      time.style.fontSize = '12px';
      time.style.color = '#64748b';
      time.textContent = timeAgo(n.createdAt);

      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(time);

      // Click handler to mark as read and optionally view report
      if(n.id || n._id){
        item.setAttribute('data-id', n.id || n._id);
        const reportId = n.reportId || (n.data && (n.data.reportId || n.data.id || n.data._id));
        if(reportId) item.setAttribute('data-report-id', reportId);

        item.addEventListener('click', async ()=>{
          const nid = item.getAttribute('data-id');
          try{
            if(nid){
              await fetch(apiBase() + `/api/notifications/${encodeURIComponent(nid)}`, { 
                method: 'PATCH', 
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({ read: true })
              }).catch(()=>{});
            }
          }catch(e){ console.error('Mark read error', e); }
          
          // Close dropdown
          if(dd){
            dd.classList.remove('active');
            dd.style.display = 'none';
          }

          // Refresh notifications
          await refresh();

          // If it has a report ID, redirect to the report tracking page
          const rid = item.getAttribute('data-report-id');
          if(rid){
            window.location.href = `CityWatch-Track.html?id=${encodeURIComponent(rid)}`;
          }
        });
      }

      listWrap.appendChild(item);
    }

    // Update View All button
    const viewAll = dd.querySelector('#notif-view-all');
    if(viewAll){
      if(total > 5){
        viewAll.style.display = 'inline';
        viewAll.textContent = showAll ? 'Show less' : `View all (${total})`;
        viewAll.setAttribute('data-expanded', ''+showAll);
      } else {
        viewAll.style.display = 'none';
      }
    }
  }

  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function refresh(){
    const { items, total } = await fetchNotifications();
    window[CACHE_KEY] = items || [];
    window[CACHE_TOTAL] = total || (items?items.length:0);
    
    const unread = (items||[]).filter(i=>!i.read).length;
    const { badge, dd } = findElements();
    
    if(badge){
      if(unread>0){
        badge.style.display = 'inline-block';
        badge.textContent = unread>99 ? '99+' : unread;
      } else {
        badge.style.display = 'none';
      }
    }

    if(dd){
      const expanded = dd.querySelector('#notif-view-all')?.getAttribute('data-expanded') === 'true';
      renderList(items, total, dd, expanded);
    }
  }

  // Initial wiring
  function init(){
    const { btn, dd } = findElements();
    if(!btn && !dd) return;

    // Ensure dropdown has container
    if(dd && !dd.querySelector('#notif-list')){
      const list = document.createElement('div');
      list.id = 'notif-list';
      list.style.maxHeight = '300px';
      list.style.overflowY = 'auto';
      dd.appendChild(list);

      const footer = document.createElement('div');
      footer.style.padding = '10px';
      footer.style.borderTop = '1px solid #eef2f7';
      footer.style.textAlign = 'center';

      const viewAll = document.createElement('a');
      viewAll.id = 'notif-view-all';
      viewAll.href = '#';
      viewAll.style.color = '#2563eb';
      viewAll.style.textDecoration = 'none';
      viewAll.style.fontWeight = '700';
      footer.appendChild(viewAll);

      dd.appendChild(footer);
    }

    // Toggle dropdown
    if(btn){
      btn.addEventListener('click', async (ev)=>{
        ev.stopPropagation();
        if(!dd) return;
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        if(dd.style.display === 'block'){
          await refresh();
        }
      });
    }

    // Close on outside click
    document.addEventListener('click', (e)=>{
      if(dd && !dd.contains(e.target) && e.target !== btn){
        dd.style.display = 'none';
      }
    });

    // View all toggle
    const viewAll = dd && dd.querySelector('#notif-view-all');
    if(viewAll){
      viewAll.addEventListener('click', async (ev)=>{
        ev.preventDefault();
        const expanded = viewAll.getAttribute('data-expanded') === 'true';
        const items = window[CACHE_KEY] || [];
        const total = window[CACHE_TOTAL] || items.length;
        
        if(!expanded){
          if(!items.length){
            await refresh();
          }
          dd.style.maxHeight = '420px';
          dd.style.overflowY = 'auto';
        } else {
          dd.style.maxHeight = '';
          dd.style.overflowY = '';
        }
        
        renderList(items, total, dd, !expanded);
      });
    }

    // Initial load & polling
    setTimeout(()=>{ refresh().catch(()=>{}); }, 200);
    setInterval(()=>{ refresh().catch(()=>{}); }, POLL_INTERVAL);
  }

  // Auto-init
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose refresh helper
  window.__userNotificationsRefresh = refresh;
})();