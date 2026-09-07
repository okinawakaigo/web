// 動き: スクロールで要素がふわっと現れる／トップ写真がゆっくり切り替わる（仕様書の上限2種類）
document.addEventListener("DOMContentLoaded", function () {
  var targets = document.querySelectorAll(".fade-in");

  if (!("IntersectionObserver" in window)) {
    targets.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  // トップ写真クロスフェード（§1のみ。複数枚ある場合だけ動く）
  var heroSlides = document.querySelectorAll(".hero-photo-slide");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (heroSlides.length > 1 && !reduceMotion) {
    var current = 0;
    setInterval(function () {
      heroSlides[current].classList.remove("is-active");
      current = (current + 1) % heroSlides.length;
      heroSlides[current].classList.add("is-active");
    }, 4000);
  }

  // ヘッダーのハンバーガーメニュー開閉
  var menuToggle = document.querySelector(".site-menu-toggle");
  var siteMenu = document.querySelector(".site-menu");

  if (menuToggle && siteMenu) {
    menuToggle.addEventListener("click", function () {
      var isOpen = siteMenu.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("menu-open", isOpen);
    });

    siteMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        siteMenu.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-open");
      });
    });
  }
});
