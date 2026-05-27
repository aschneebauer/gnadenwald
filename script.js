document.addEventListener('DOMContentLoaded', () => {

  // ── Navbar scroll effect ──
  const navbar = document.getElementById('navbar');
  const handleScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ── Mobile Navigation ──
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.classList.toggle('active');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('active');
    });
  });

  // ── QR Code Generation ──
  // Zielt auf die zukünftige offizielle Adresse der Pilgerherberge.
  const PILGERHERBERGE_URL = 'https://www.psptirol.org/pilgerherberge';
  const qrContainer = document.getElementById('qrCode');
  if (qrContainer && typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: PILGERHERBERGE_URL + '#reservierung',
      width: 200,
      height: 200,
      colorDark: '#3D5137',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // ── OpenStreetMap (Leaflet) – Pilgerherberge St. Martin, Gnadenwald ──
  const mapEl = document.getElementById('osmMap');
  if (mapEl && typeof L !== 'undefined') {
    // Koordinaten Kloster St. Martin, Gnadenwald 1, 6069 Gnadenwald (Tirol)
    const POSITION = [47.32046118146713, 11.553020974829453];

    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende'
    });

    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
        maxNativeZoom: 18,
        attribution: 'Luftbild: Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      }
    );

    const map = L.map(mapEl, {
      center: POSITION,
      zoom: 14,
      scrollWheelZoom: false,
      layers: [osmLayer]
    });

    L.control.layers(
      { 'Karte': osmLayer, 'Satellit': satLayer },
      null,
      { position: 'topright', collapsed: false }
    ).addTo(map);

    const pilgerIcon = L.divIcon({
      className: 'pilger-marker',
      html: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" aria-hidden="true">' +
            '<path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="#5B7553" stroke="#3D5137" stroke-width="1.5"/>' +
            '<circle cx="18" cy="18" r="7" fill="#FFFFFF"/>' +
            '<path d="M18 13.5v9M13.5 18h9" stroke="#5B7553" stroke-width="2" stroke-linecap="round"/>' +
            '</svg>',
      iconSize: [36, 48],
      iconAnchor: [18, 46],
      popupAnchor: [0, -42]
    });

    L.marker(POSITION, { icon: pilgerIcon }).addTo(map)
      .bindPopup('<strong>PSP Pilgerherberge St. Martin</strong><br>Gnadenwald 1, 6069 Gnadenwald')
      .openPopup();

    mapEl.addEventListener('click', () => { map.scrollWheelZoom.enable(); });
    mapEl.addEventListener('mouseleave', () => { map.scrollWheelZoom.disable(); });
  }

  // ── Scroll Reveal Animation ──
  const revealElements = document.querySelectorAll(
    '.section-header, .about-image, .about-content, .room-card, ' +
    '.activity-card, .qr-card, .booking-form, .contact-card, .contact-map'
  );

  revealElements.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ── Booking Form ──
  const PILGERHERBERGE_EMAIL = 'pilgerherberge@psptirol.org';
  const MAX_PILGERPASS_BYTES = 8 * 1024 * 1024; // 8 MB

  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    const today = new Date().toISOString().split('T')[0];
    const checkinInput = document.getElementById('checkin');
    const checkoutInput = document.getElementById('checkout');
    const pilgerpassInput = document.getElementById('pilgerpass');
    const pilgerpassWrapper = pilgerpassInput ? pilgerpassInput.closest('.file-upload') : null;
    const pilgerpassFilename = document.getElementById('pilgerpassFilename');
    const pilgerpassPreview = document.getElementById('pilgerpassPreview');
    const pilgerpassPreviewImg = document.getElementById('pilgerpassPreviewImg');
    const pilgerpassRemove = document.getElementById('pilgerpassRemove');

    checkinInput.setAttribute('min', today);
    checkoutInput.setAttribute('min', today);

    checkinInput.addEventListener('change', () => {
      const nextDay = new Date(checkinInput.value);
      nextDay.setDate(nextDay.getDate() + 1);
      checkoutInput.setAttribute('min', nextDay.toISOString().split('T')[0]);
      if (checkoutInput.value && checkoutInput.value <= checkinInput.value) {
        checkoutInput.value = nextDay.toISOString().split('T')[0];
      }
    });

    function resetPilgerpass() {
      if (!pilgerpassInput) return;
      pilgerpassInput.value = '';
      if (pilgerpassPreviewImg.src) URL.revokeObjectURL(pilgerpassPreviewImg.src);
      pilgerpassPreviewImg.removeAttribute('src');
      pilgerpassPreview.hidden = true;
      pilgerpassFilename.textContent = 'Keine Datei ausgewählt';
      pilgerpassWrapper.classList.remove('has-file');
    }

    if (pilgerpassInput) {
      pilgerpassInput.addEventListener('change', () => {
        const file = pilgerpassInput.files && pilgerpassInput.files[0];
        if (!file) {
          resetPilgerpass();
          return;
        }
        if (file.size > MAX_PILGERPASS_BYTES) {
          showNotification('Das Foto ist zu groß (max. 8 MB). Bitte wählen Sie ein kleineres Bild.');
          resetPilgerpass();
          return;
        }
        if (pilgerpassPreviewImg.src) URL.revokeObjectURL(pilgerpassPreviewImg.src);
        pilgerpassPreviewImg.src = URL.createObjectURL(file);
        pilgerpassPreview.hidden = false;
        pilgerpassFilename.textContent = file.name;
        pilgerpassWrapper.classList.add('has-file');
      });
    }

    if (pilgerpassRemove) {
      pilgerpassRemove.addEventListener('click', resetPilgerpass);
    }

    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // HTML5-Validierung manuell auslösen (Form ist novalidate)
      if (!bookingForm.checkValidity()) {
        bookingForm.reportValidity();
        return;
      }

      const passFile = pilgerpassInput && pilgerpassInput.files && pilgerpassInput.files[0];
      if (!passFile) {
        showNotification('Bitte ein Foto Ihres Pilgerpasses hochladen.');
        return;
      }

      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gesendet …';

      try {
        const response = await fetch(bookingForm.action, {
          method: 'POST',
          body: new FormData(bookingForm),
          headers: { 'Accept': 'application/json' }
        });

        let result = null;
        try { result = await response.json(); } catch (_) { /* ignore */ }

        if (response.ok && result && result.ok) {
          bookingForm.reset();
          resetPilgerpass();
          showNotification(result.message || 'Vielen Dank! Ihre Anfrage wurde gesendet.');
        } else {
          const msg = (result && result.message)
            ? result.message
            : `Fehler beim Senden (Status ${response.status}). Bitte erneut versuchen oder direkt an ${PILGERHERBERGE_EMAIL} schreiben.`;
          showNotification(msg);
        }
      } catch (err) {
        showNotification(
          'Verbindungsfehler – die Anfrage konnte nicht gesendet werden. ' +
          'Bitte Internetverbindung prüfen oder direkt an ' + PILGERHERBERGE_EMAIL + ' schreiben.'
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // ── Notification Helper ──
  function showNotification(message) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: '#3D5137',
      color: '#fff',
      padding: '16px 28px',
      borderRadius: '12px',
      fontSize: '15px',
      fontFamily: "'Inter', sans-serif",
      boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      zIndex: '9999',
      animation: 'slideInNotif 0.4s ease',
      maxWidth: '360px'
    });

    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(10px)';
      notification.style.transition = 'all 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // ── Lightbox for gallery thumbnails ──
  document.querySelectorAll('.gallery-thumb img, .about-image > img').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.className = 'lightbox-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Bild vergrößert');

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'lightbox-close';
      closeBtn.setAttribute('aria-label', 'Schließen');
      closeBtn.innerHTML = '&times;';

      const fullImg = document.createElement('img');
      fullImg.className = 'lightbox-img';
      fullImg.src = img.src;
      fullImg.alt = img.alt || '';

      const frame = document.createElement('div');
      frame.className = 'lightbox-frame';

      const closeLightbox = () => {
        overlay.classList.add('is-closing');
        document.removeEventListener('keydown', onKeydown);
        setTimeout(() => overlay.remove(), 300);
      };

      const onKeydown = (e) => {
        if (e.key === 'Escape') closeLightbox();
      };

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
      });
      fullImg.addEventListener('click', (e) => e.stopPropagation());
      overlay.addEventListener('click', closeLightbox);
      document.addEventListener('keydown', onKeydown);

      frame.append(fullImg, closeBtn);
      overlay.append(frame);
      document.body.appendChild(overlay);
      closeBtn.focus();
    });
  });

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = navbar.offsetHeight + 20;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
});
