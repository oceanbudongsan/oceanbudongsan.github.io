/**
 * OceanMotion - 오션부동산 인터랙티브 모션 & UI 애니메이션 라이브러리
 */

(function (window) {
  'use strict';

  class OceanMotionEngine {
    constructor() {
      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }

    setup() {
      this.initScrollReveal();
      this.initTiltCards();
      this.initCounters();
    }

    // 1. Scroll Reveal Observer
    initScrollReveal() {
      const revealElements = document.querySelectorAll('.oc-reveal, .oc-reveal-scale, .oc-reveal-left, .oc-reveal-right');
      if (!revealElements.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('oc-active');
              // 한번 등장 후 관찰 해제
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );

      revealElements.forEach((el) => observer.observe(el));
    }

    // 2. 3D Tilt Effect on Hover
    initTiltCards() {
      const cards = document.querySelectorAll('.oc-tilt-card');
      cards.forEach((card) => {
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -5;
          const rotateY = ((x - centerX) / centerX) * 5;

          card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
          card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
      });
    }

    // 3. Counter Animation (숫자 카운트업)
    initCounters() {
      const counters = document.querySelectorAll('[data-oc-counter]');
      if (!counters.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const target = parseInt(entry.target.getAttribute('data-oc-counter'), 10);
              this.animateCounter(entry.target, target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );

      counters.forEach((el) => observer.observe(el));
    }

    animateCounter(el, target, duration = 1200) {
      let start = 0;
      const stepTime = 20;
      const steps = duration / stepTime;
      const increment = target / steps;

      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          el.textContent = target.toLocaleString();
          clearInterval(timer);
        } else {
          el.textContent = Math.floor(start).toLocaleString();
        }
      }, stepTime);
    }

    // 4. Toast Notification
    showToast(message, type = 'info') {
      let container = document.getElementById('oc-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'oc-toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      let icon = 'info';
      if (type === 'success') icon = 'check_circle';
      if (type === 'error') icon = 'error';

      toast.className = 'oc-toast';
      toast.innerHTML = `
        <span class="material-symbols-outlined text-blue-400">${icon}</span>
        <span>${message}</span>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('oc-toast-out');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  window.OceanMotion = new OceanMotionEngine();
})(window);
