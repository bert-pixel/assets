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

const MobMenu = () => {
  const mobMenu = document.querySelector(".js-mobnav");
  const backBtn = mobMenu.querySelector(".js-back");
  const toggles = mobMenu.querySelectorAll(".js-toggle");

  const closeSubnav = () => {
    mobMenu
      .querySelectorAll(".js-nav.open")
      .forEach((navItem) => navItem.classList.remove("open"));
  };

  backBtn.addEventListener("click", closeSubnav);

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      const subNav = toggle.closest(".js-container").querySelector(".js-nav");
      subNav.classList.toggle("open");
    });
  });
};

const LinkExpand = () => {
  document.querySelectorAll("a[type]").forEach((link) => {
    if (link.getAttribute("type") === "tel") {
      link.href = `tel:${link.href.replace("http://", "")}`;
    }
  });
};

const Filter = () => {
  console.log("FILTER ENABLED");
  const filters = document.querySelectorAll(".js-filter");

  filters.forEach((filter) => {
    const target = document.querySelector("#" + filter.dataset.for);
    const wiperSlides = target.querySelectorAll(".swiper-slide");
    let query = "";

    filter.addEventListener("input", () => {
      console.log(filter.value);
      query = filter.value;

      if (query.length === 0) {
        wiperSlides.forEach(
          (wiperSlide) => (wiperSlide.style.display = "block"),
        );
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
  window.addEventListener("scroll", ScrollToCss);
};

console.log("BUNDLE.JS LOADED");
init();
