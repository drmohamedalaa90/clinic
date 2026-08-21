(() => {
  const w = window;
  const d = document;

  // =========================================================
  // CLINIC V57
  // 1) Prevent Friday old-week flash BEFORE the app paints.
  // 2) On Friday, make next Saturday week the first visible week.
  // 3) Keep exactly ONE extra-case + button, beside the day name.
  // =========================================================

  function cairoDateParts() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    }).formatToParts(new Date());

    const get = (type) =>
      parts.find((x) => x.type === type)?.value || '';

    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      weekday: get('weekday')
    };
  }

  function isFridayCairo() {
    return cairoDateParts().weekday === 'Fri';
  }

  // ---------------------------------------------------------
  // PRE-PAINT GUARD
  // This file should be loaded synchronously in <head>.
  // ---------------------------------------------------------
  if (isFridayCairo()) {
    d.documentElement.classList.add('v57-friday-preparing');

    const earlyStyle = d.createElement('style');
    earlyStyle.id = 'v57-early-style';
    earlyStyle.textContent = `
      html.v57-friday-preparing #mainContent {
        visibility: hidden !important;
      }

      html.v57-friday-preparing .main-content {
        visibility: hidden !important;
      }
    `;
    d.head.appendChild(earlyStyle);
  }

  function ready(fn) {
    if (d.readyState === 'loading') {
      d.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(() => {
    const C = w.Clinic;

    if (!C) {
      // Never leave the page hidden if Clinic failed to initialize.
      d.documentElement.classList.remove('v57-friday-preparing');
      return;
    }

    if (C.__v57Loaded) {
      d.documentElement.classList.remove('v57-friday-preparing');
      return;
    }

    C.__v57Loaded = true;

    function isAppointmentsPage() {
      return ['appointments', 'doctor-appointments'].includes(C.currentPage);
    }

    function addStyles() {
      if (d.getElementById('v57-style')) return;

      const s = d.createElement('style');
      s.id = 'v57-style';
      s.textContent = `
        .v57-day-name-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 8px !important;
          width: 100% !important;
        }

        .v57-day-plus {
          width: 28px;
          height: 28px;
          min-width: 28px;
          border: 1px solid #f59e0b;
          border-radius: 9px;
          background: #fff7ed;
          color: #b45309;
          display: inline-grid;
          place-items: center;
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          margin: 0;
          flex: 0 0 auto;
        }

        .v57-day-plus:hover {
          background: #ffedd5;
        }
      `;
      d.head.appendChild(s);
    }

    function dateObjFromCairoToday() {
      const p = cairoDateParts();
      return new Date(Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        12, 0, 0
      ));
    }

    function ymd(date) {
      return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
      ].join('-');
    }

    function nextSaturday(date) {
      const x = new Date(date);
      const add = (6 - x.getUTCDay() + 7) % 7 || 7;
      x.setUTCDate(x.getUTCDate() + add);
      return x;
    }

    function parseWeekTitle(text) {
      const m = String(text || '').match(
        /(\d{2})\/(\d{2})\/(\d{4})\s*[–-]\s*(\d{2})\/(\d{2})\/(\d{4})/
      );

      if (!m) return null;

      return {
        start: `${m[3]}-${m[2]}-${m[1]}`,
        end: `${m[6]}-${m[5]}-${m[4]}`
      };
    }

    function weekContainers() {
      const all = [...d.querySelectorAll('section,div,article')];
      const found = [];

      for (const el of all) {
        const txt = (el.textContent || '').trim();
        const parsed = parseWeekTitle(txt);

        if (!parsed) continue;

        const dates =
          txt.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [];

        if (dates.length < 7) continue;

        // Keep the smallest useful week container.
        const hasNestedWeek = [...el.children].some((child) => {
          const ct = (child.textContent || '').trim();
          const cp = parseWeekTitle(ct);
          const cd = ct.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [];
          return cp && cd.length >= 7;
        });

        if (hasNestedWeek) continue;

        found.push({
          el,
          ...parsed
        });
      }

      return found;
    }

    function revealPage() {
      d.documentElement.classList.remove('v57-friday-preparing');
    }

    function fridayShift() {
      if (!isFridayCairo()) {
        revealPage();
        return true;
      }

      // If a different page is open, reveal immediately.
      if (!isAppointmentsPage()) {
        revealPage();
        return true;
      }

      const target = ymd(
        nextSaturday(
          dateObjFromCairoToday()
        )
      );

      const weeks = weekContainers();

      if (!weeks.length) {
        return false;
      }

      const targetIndex =
        weeks.findIndex(
          (week) => week.start === target
        );

      if (targetIndex < 0) {
        return false;
      }

      // Prefer actual calendar jump control so state is truly updated.
      const jump =
        d.querySelector(
          '#jumpDate,' +
          '#calendarJumpDate,' +
          'input[data-jump-date][type="date"]'
        );

      if (
        jump &&
        jump.value !== target
      ) {
        jump.value = target;
        jump.dispatchEvent(
          new Event('change', {
            bubbles: true
          })
        );

        // Wait for rerender. Do not reveal the old week.
        return false;
      }

      const refreshedWeeks = weekContainers();

      const refreshedTargetIndex =
        refreshedWeeks.findIndex(
          (week) => week.start === target
        );

      if (refreshedTargetIndex < 0) {
        return false;
      }

      // Defensive fallback: hide any older week still rendered above it.
      refreshedWeeks.forEach((week, index) => {
        if (index < refreshedTargetIndex) {
          week.el.style.display = 'none';
          week.el.dataset.v57FridayHidden = '1';
        } else if (
          week.el.dataset.v57FridayHidden === '1'
        ) {
          week.el.style.display = '';
          delete week.el.dataset.v57FridayHidden;
        }
      });

      revealPage();
      return true;
    }

    function parseDayDate(node) {
      const direct =
        node.dataset?.date ||
        node.querySelector('[data-date]')?.dataset?.date;

      if (
        direct &&
        /^\d{4}-\d{2}-\d{2}$/.test(direct)
      ) {
        return direct;
      }

      const m =
        (node.textContent || '')
          .match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);

      if (!m) return null;

      return `${m[3]}-${m[2]}-${m[1]}`;
    }

    function openExtraCase(date) {
      if (
        typeof C.openExtraCaseModal === 'function'
      ) {
        C.openExtraCaseModal({ date });
        return;
      }

      const fallback =
        d.getElementById('v51ExtraCaseButton');

      if (fallback) {
        fallback.click();

        setTimeout(() => {
          const input =
            d.querySelector(
              '#v54Date,#v52Date,#v51ExtraDate'
            );

          if (input) {
            input.value = date;
            input.dispatchEvent(
              new Event('change', {
                bubbles: true
              })
            );
          }
        }, 60);

        return;
      }

      C.toast(
        C.lang === 'ar'
          ? 'تعذر فتح نافذة الحالة الإضافية.'
          : 'Could not open extra-case form.',
        'error'
      );
    }

    function removeLegacyDayPlus() {
      d.querySelectorAll(
        '.v53-day-extra-btn,' +
        '.v54-day-extra-btn,' +
        '.v54-day-extra-slot,' +
        '.v56-day-plus,' +
        '.v56-day-plus-wrap'
      ).forEach((el) => el.remove());
    }

    function findDayColumns() {
      const weekdayRe =
        /^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)$/i;

      const labels =
        [...d.querySelectorAll(
          'div,span,strong,h3,h4'
        )];

      const results = [];

      for (const label of labels) {
        const name =
          (label.textContent || '').trim();

        if (!weekdayRe.test(name)) continue;

        let col = label.parentElement;
        let hops = 0;

        while (col && hops < 6) {
          const text =
            (col.textContent || '').trim();

          const weekdayMatches =
            text.match(
              /\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\b/gi
            ) || [];

          const dates =
            text.match(
              /\b\d{2}\/\d{2}\/\d{4}\b/g
            ) || [];

          if (
            weekdayMatches.length === 1 &&
            dates.length >= 1
          ) {
            break;
          }

          col = col.parentElement;
          hops += 1;
        }

        if (!col) continue;

        const date = parseDayDate(col);
        if (!date) continue;

        if (
          !results.some(
            (item) => item.col === col
          )
        ) {
          results.push({
            col,
            label,
            date
          });
        }
      }

      return results;
    }

    function injectPlusBesideDayName() {
      if (!isAppointmentsPage()) return;

      removeLegacyDayPlus();

      const days = findDayColumns();

      for (const {
        col,
        label,
        date
      } of days) {
        // Exactly one icon per day.
        col
          .querySelectorAll('.v57-day-plus')
          .forEach((btn, index) => {
            if (index > 0) btn.remove();
          });

        if (
          col.querySelector('.v57-day-plus')
        ) {
          continue;
        }

        let row = label.parentElement;

        if (
          !row ||
          row === col ||
          (row.textContent || '')
            .match(/\d{2}:\d{2}/)
        ) {
          // Build a clean name row but keep the date below unchanged.
          row = d.createElement('div');
          row.className = 'v57-day-name-row';

          label.parentNode.insertBefore(
            row,
            label
          );

          row.appendChild(label);
        } else {
          row.classList.add(
            'v57-day-name-row'
          );
        }

        const btn =
          d.createElement('button');

        btn.type = 'button';
        btn.className = 'v57-day-plus';
        btn.dataset.date = date;
        btn.textContent = '＋';

        btn.title =
          C.lang === 'ar'
            ? 'إضافة حالة إضافية لهذا اليوم'
            : 'Add extra case for this day';

        btn.setAttribute(
          'aria-label',
          btn.title
        );

        btn.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            openExtraCase(date);
          }
        );

        row.appendChild(btn);
      }
    }

    function run() {
      addStyles();

      const shifted = fridayShift();

      if (shifted || !isFridayCairo()) {
        injectPlusBesideDayName();
      }
    }

    let timer = null;

    const observer =
      new MutationObserver(() => {
        clearTimeout(timer);

        timer = setTimeout(
          run,
          20
        );
      });

    observer.observe(
      d.body,
      {
        childList: true,
        subtree: true
      }
    );

    run();

    // Safety: never leave the page invisible indefinitely
    // if the appointments renderer fails.
    setTimeout(() => {
      revealPage();
      injectPlusBesideDayName();
    }, 2500);
  });
})();
