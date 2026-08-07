/* ==========================================================================
   Waypost - site behaviour
   No scroll listeners: IntersectionObserver + CSS scroll-driven animation only.
   Every enhancement degrades to a working, visible page without JS.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;

  /* ----------------------------------------------------------------------
     Theme
     ---------------------------------------------------------------------- */

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    });
  }

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function initTheme() {
    applyTheme(currentTheme());

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('waypost-theme-v2', next); } catch (e) { /* storage blocked */ }

        if (document.startViewTransition && !reduceMotion.matches) {
          document.startViewTransition(function () { applyTheme(next); });
        } else {
          applyTheme(next);
        }
      });
    });
  }
  // Light is the default for every first visit, regardless of OS preference.
  // Dark is only ever reached through the toggle, and is then remembered.

  /* ----------------------------------------------------------------------
     Header: sticky state driven by a sentinel, never a scroll listener
     ---------------------------------------------------------------------- */

  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header || !('IntersectionObserver' in window)) return;

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);

    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { rootMargin: '0px' }).observe(sentinel);
  }

  /* ----------------------------------------------------------------------
     Mobile navigation panel
     ---------------------------------------------------------------------- */

  function initMobileNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var panel = document.getElementById('mobile-panel');
    if (!toggle || !panel) return;

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('is-locked', open);
      var icon = toggle.querySelector('i');
      if (icon) icon.className = open ? 'ph ph-x' : 'ph ph-list';
      if (open) {
        var first = panel.querySelector('a, button');
        if (first) first.focus();
      }
    }

    toggle.addEventListener('click', function () { setOpen(panel.hidden); });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });

    window.matchMedia('(min-width: 1080px)').addEventListener('change', function (e) {
      if (e.matches && !panel.hidden) setOpen(false);
    });
  }

  /* ----------------------------------------------------------------------
     Scroll reveals + number roll-ups
     ---------------------------------------------------------------------- */

  function initReveals() {
    var targets = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    var counters = document.querySelectorAll('[data-count-to]');
    if (!counters.length) return;

    function finalText(el) {
      var value = parseFloat(el.getAttribute('data-count-to'));
      var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
      return (el.getAttribute('data-count-prefix') || '') +
        value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
        (el.getAttribute('data-count-suffix') || '');
    }

    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      counters.forEach(function (el) { el.textContent = finalText(el); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);

        var target = parseFloat(el.getAttribute('data-count-to'));
        var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
        var prefix = el.getAttribute('data-count-prefix') || '';
        var suffix = el.getAttribute('data-count-suffix') || '';
        var duration = 1400;
        var start = null;

        function frame(now) {
          if (start === null) start = now;
          var p = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 4);
          el.textContent = prefix + (target * eased).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }) + suffix;
          if (p < 1) requestAnimationFrame(frame);
          else el.textContent = finalText(el);
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------------
     Destination rail: arrows + drag to pan
     ---------------------------------------------------------------------- */

  function initRails() {
    document.querySelectorAll('[data-rail]').forEach(function (rail) {
      var scope = rail.closest('section') || document;
      var prev = scope.querySelector('[data-rail-prev]');
      var next = scope.querySelector('[data-rail-next]');

      function step() {
        var card = rail.firstElementChild;
        if (!card) return 320;
        return card.getBoundingClientRect().width + 16;
      }

      function syncControls() {
        var max = rail.scrollWidth - rail.clientWidth - 2;
        if (prev) prev.disabled = rail.scrollLeft <= 2;
        if (next) next.disabled = rail.scrollLeft >= max;
      }

      if (prev) prev.addEventListener('click', function () {
        rail.scrollBy({ left: -step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      });
      if (next) next.addEventListener('click', function () {
        rail.scrollBy({ left: step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      });

      // scroll state read via a passive handler on the element itself, not the window
      rail.addEventListener('scroll', syncControls, { passive: true });
      syncControls();

      // Pointer drag to pan
      var down = false, startX = 0, startScroll = 0, moved = 0;

      rail.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return; // native touch scrolling is better
        down = true; moved = 0;
        startX = e.clientX;
        startScroll = rail.scrollLeft;
        rail.classList.add('is-dragging');
      });

      rail.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        moved = Math.abs(dx);
        rail.scrollLeft = startScroll - dx;
      });

      function endDrag() {
        if (!down) return;
        down = false;
        rail.classList.remove('is-dragging');
      }
      rail.addEventListener('pointerup', endDrag);
      rail.addEventListener('pointercancel', endDrag);
      rail.addEventListener('pointerleave', endDrag);

      // Suppress the click that ends a real drag
      rail.addEventListener('click', function (e) {
        if (moved > 8) { e.preventDefault(); e.stopPropagation(); moved = 0; }
      }, true);
    });
  }

  /* ----------------------------------------------------------------------
     Destination filtering
     ---------------------------------------------------------------------- */

  function initFilters() {
    var bar = document.querySelector('[data-filters]');
    if (!bar) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-region]'));
    var empty = document.querySelector('[data-empty-state]');
    var countEl = document.querySelector('[data-result-count]');

    function apply(region) {
      var shown = 0;
      cards.forEach(function (card) {
        var match = region === 'all' || card.getAttribute('data-region') === region;
        card.classList.toggle('is-hidden', !match);
        if (match) shown++;
      });
      if (empty) empty.classList.toggle('is-visible', shown === 0);
      if (countEl) countEl.textContent = shown === 1 ? '1 destination' : shown + ' destinations';
    }

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      bar.querySelectorAll('.filter-btn').forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      apply(btn.getAttribute('data-filter'));
    });

    apply('all');
  }

  /* ----------------------------------------------------------------------
     Pricing: monthly / yearly
     ---------------------------------------------------------------------- */

  function initBilling() {
    var group = document.querySelector('[data-billing]');
    if (!group) return;

    function apply(mode) {
      document.querySelectorAll('[data-price-monthly]').forEach(function (el) {
        el.textContent = el.getAttribute(mode === 'yearly' ? 'data-price-yearly' : 'data-price-monthly');
      });
      document.querySelectorAll('[data-billing-note]').forEach(function (el) {
        el.textContent = el.getAttribute(mode === 'yearly' ? 'data-note-yearly' : 'data-note-monthly') || '';
      });
      document.querySelectorAll('[data-per]').forEach(function (el) {
        el.textContent = mode === 'yearly' ? '/ month, billed yearly' : '/ month';
      });
    }

    group.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      group.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      apply(btn.getAttribute('data-billing-mode'));
    });

    apply('monthly');
  }

  /* ----------------------------------------------------------------------
     Forms: inline validation, busy state, success state
     ---------------------------------------------------------------------- */

  function initForms() {
    document.querySelectorAll('[data-validate]').forEach(function (form) {
      var status = form.querySelector('[data-form-status]');
      var submit = form.querySelector('[type="submit"]');

      function fieldOf(input) { return input.closest('.field') || input.closest('.checkbox-field'); }

      function validate(input) {
        var wrap = fieldOf(input);
        if (!wrap) return true;
        var errEl = wrap.querySelector('.error');
        var ok = input.checkValidity();
        wrap.classList.toggle('has-error', !ok);
        if (errEl && !ok) {
          errEl.textContent = input.validationMessage;
        }
        return ok;
      }

      form.querySelectorAll('input, textarea, select').forEach(function (input) {
        input.addEventListener('blur', function () { validate(input); });
        input.addEventListener('input', function () {
          var wrap = fieldOf(input);
          if (wrap && wrap.classList.contains('has-error')) validate(input);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var fields = Array.prototype.slice.call(form.querySelectorAll('input, textarea, select'));
        var firstBad = null;
        fields.forEach(function (input) {
          if (!validate(input) && !firstBad) firstBad = input;
        });

        if (firstBad) {
          if (status) {
            status.className = 'form-status form-status--err is-visible';
            status.innerHTML = '<i class="ph ph-warning-circle" aria-hidden="true"></i><span>Some details still need attention. Check the highlighted fields below.</span>';
          }
          firstBad.focus();
          return;
        }

        if (submit) {
          submit.setAttribute('aria-busy', 'true');
          submit.dataset.label = submit.textContent;
          submit.textContent = 'Sending';
        }

        // No backend is wired up in this build. Connect your form endpoint here.
        window.setTimeout(function () {
          if (submit) {
            submit.removeAttribute('aria-busy');
            submit.textContent = submit.dataset.label || 'Send message';
          }
          if (status) {
            status.className = 'form-status form-status--ok is-visible';
            status.innerHTML = '<i class="ph ph-check-circle" aria-hidden="true"></i><span>' +
              (form.getAttribute('data-success') || 'Thanks. We have your message and will reply within one business day.') +
              '</span>';
            status.setAttribute('tabindex', '-1');
            status.focus();
          }
          form.reset();
        }, 900);
      });
    });
  }

  /* ----------------------------------------------------------------------
     Magnetic primary CTA - pointer feedback on the single most important action
     ---------------------------------------------------------------------- */

  function initMagnetic() {
    if (reduceMotion.matches || !window.matchMedia('(pointer: fine)').matches) return;

    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var frame = null;

      el.addEventListener('pointermove', function (e) {
        if (frame) return;
        frame = requestAnimationFrame(function () {
          var r = el.getBoundingClientRect();
          var x = (e.clientX - (r.left + r.width / 2)) * 0.22;
          var y = (e.clientY - (r.top + r.height / 2)) * 0.32;
          el.style.transform = 'translate(' + x.toFixed(2) + 'px,' + (y - 1).toFixed(2) + 'px)';
          frame = null;
        });
      });

      el.addEventListener('pointerleave', function () {
        if (frame) { cancelAnimationFrame(frame); frame = null; }
        el.style.transform = '';
      });
    });
  }

  /* ----------------------------------------------------------------------
     Cookie notice
     ---------------------------------------------------------------------- */

  function initCookieNotice() {
    var notice = document.getElementById('cookie-notice');
    if (!notice) return;

    var stored = null;
    try { stored = localStorage.getItem('waypost-cookie-choice'); } catch (e) { /* ignore */ }
    if (stored) return;

    notice.hidden = false;

    notice.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie-choice]');
      if (!btn) return;
      try { localStorage.setItem('waypost-cookie-choice', btn.getAttribute('data-cookie-choice')); } catch (err) { /* ignore */ }
      notice.hidden = true;
    });
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */

  function boot() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });

    initTheme();
    initHeader();
    initMobileNav();
    initReveals();
    initCounters();
    initRails();
    initFilters();
    initBilling();
    initForms();
    initMagnetic();
    initCookieNotice();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
