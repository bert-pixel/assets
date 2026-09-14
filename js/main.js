const ScrollToCss = () => {
  document.body.style.setProperty("--scroll", window.scrollY);
};

const Flipcards = () => {
  const flipcardRoots = document.querySelectorAll(".flipcards");

  flipcardRoots.forEach((flipcardRoot) => {
    const flipcards = flipcardRoot.querySelectorAll(".flipcard");

    flipcards.forEach((flipcard) => {
      const prevBtn = flipcard.querySelector(".js-prev a");
      const nextBtn = flipcard.querySelector(".js-next a");
      const flipcardHeader = flipcard.querySelector(".elementor-heading-title");
      const verticalHeader = flipcardHeader.cloneNode(true);
      verticalHeader.classList.add("flipcard__header--vertical");
      flipcard.appendChild(verticalHeader);

      verticalHeader.addEventListener("click", () => {
        flipcardRoot.querySelector(".flipcard.open").classList.remove("open");
        flipcard.classList.add("open");
      });

      if (prevBtn) {
        prevBtn.addEventListener("click", (event) => {
          flipcard.classList.remove("open");
          flipcard.previousElementSibling.classList.add("open");
          console.log(flipcard);
          event.preventDefault();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", (event) => {
          flipcard.classList.remove("open");
          flipcard.nextElementSibling.classList.add("open");
          console.log(flipcard);
          event.preventDefault();
        });
      }
    });
  });
};

const SearchMenu = () => {
  const searchToggle = document.querySelector(".js-search-main-toggle");
  const searchContainer = document.querySelector(".js-search-main-container");
  const searchOverlay = searchContainer.querySelector(".search-main__overlay");
  [searchToggle, searchOverlay].forEach((item) =>
    item.addEventListener("click", () => {
      searchContainer.classList.toggle("open");
    }),
  );
};

const MobMenu = () => {
  const mobMenu = document.querySelector(".js-mobnav");
  const backBtn = mobMenu.querySelector(".js-back");
  const searchBtn = mobMenu.querySelector(".js-search-toggle");
  const searchSubnav = mobMenu.querySelector(".js-nav-search");
  const toggles = mobMenu.querySelectorAll(".js-toggle");
  let prevSubnav = null;

  const closeSubnav = () => {
    mobMenu
      .querySelectorAll(".js-nav.open")
      .forEach((navItem) => navItem.classList.remove("open"));
  };

  // Bind events
  backBtn.addEventListener("click", closeSubnav);

  searchBtn.addEventListener("click", () => {
    searchSubnav.classList.toggle("open");
    console.log(searchSubnav);
  });

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      if (prevSubnav) prevSubnav.classList.remove("open");

      const subNav = toggle.closest(".js-container").querySelector(".js-nav");
      if (prevSubnav == subNav) {
        prevSubnav = null;
        return;
      }
      subNav.classList.toggle("open");

      // Only tag a card level nav for closing
      if (subNav.classList.contains("card__items")) prevSubnav = subNav;
    });
  });
};

const LinkExpand = () => {
  document.querySelectorAll("a[type]").forEach((link) => {
    if (link.getAttribute("type") === "tel") {
      link.href = `tel:${link.href.replace(/http:\/\/|%20|\//g, "")}`;
    }
  });
};

const Filter = () => {
  console.log("FILTER ENABLED");
  const filters = document.querySelectorAll(".js-filter");

  filters.forEach((filter) => {
    const target = document.querySelector("#" + filter.dataset.for);
    const clear = filter.closest(".filter").querySelector(".js-clear");
    const wiperSlides = target.querySelectorAll(".swiper-slide");

    const $swiper = jQuery(`#${filter.dataset.for} .swiper`);
    let swiperInstance = null;

    let query = "";

    const updateSwiper = () => {
      swiperInstance.update();
      swiperInstance.slideTo(0, 0);
    };

    const reset = () => {
      filter.value = "";
      filter.select();
      wiperSlides.forEach(
        (wiperSlide) => (wiperSlide.style.display = "block"),
        (clear.style.display = "none"),
      );
      updateSwiper();
    };

    // Listen to reset
    clear.addEventListener("click", () => {
      reset();
    });

    // Listen to input
    filter.addEventListener("input", () => {
      query = filter.value;

      // Initialize the swiperInstance once
      if (!swiperInstance) {
        swiperInstance = $swiper.data("swiper");
      }

      if (query.length === 0) {
        reset();
        return;
      }
      if (query.length < 3) return;
      const queryLowercase = query.toLowerCase();

      wiperSlides.forEach((wiperSlide) => {
        // Hide all slides first
        wiperSlide.style.display = "none";

        const match =
          wiperSlide
            .querySelector(".js-heading")
            .innerText.toLowerCase()
            .indexOf(queryLowercase) > -1;
        if (match) wiperSlide.style.display = "block";
      });

      clear.style.display = "block";
      updateSwiper();
    });
  });
};

const Toast = () => {
  const toasts = document.querySelectorAll(".toast");

  toasts.forEach((toast) => {
    const toastCloseBtn = toast.querySelector(".js-close");

    toastCloseBtn.addEventListener("click", () => {
      toast.classList.add("hidden");
    });
  });
};

// Bindings when popup opens
window.addEventListener("elementor/popup/show", (event) => {
  console.log("POPUP LOADED");
  MobMenu();
});

// When page is loaded
const init = () => {
  Flipcards();
  LinkExpand();
  Filter();
  SearchMenu();
  Toast();
  window.addEventListener("scroll", ScrollToCss);
};

console.log("BUNDLE.JS LOADED");
init();
