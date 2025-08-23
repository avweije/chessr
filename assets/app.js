/*
 * Welcome to your app's main JavaScript file!
 *
 * This file will be included onto the page via the importmap() Twig function,
 * which should already be in your base.html.twig.
 */

if (
  localStorage.getItem("dark-mode") === "true" ||
  (!("dark-mode" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  // add dark class to html if dark mode is enabled (for our own css, change to theme-dark?)
  document.querySelector("html").classList.add("dark");
  // bulma uses data-theme attribute
  document.documentElement.setAttribute("data-theme", "dark");
} else {
  document.querySelector("html").classList.remove("dark");
  document.documentElement.setAttribute("data-theme", "light");
}

document.addEventListener("DOMContentLoaded", (event) => {
  const lightSwitches = document.querySelectorAll(".light-switch");

  if (lightSwitches.length > 0) {
    lightSwitches.forEach((lightSwitch, i) => {
      if (localStorage.getItem("dark-mode") === "true") {
        lightSwitch.checked = true;
      }
      lightSwitch.addEventListener("change", () => {
        const { checked } = lightSwitch;

        lightSwitches.forEach((el, n) => {
          if (n !== i) {
            el.checked = checked;
          }
        });

        if (lightSwitch.checked) {
          document.documentElement.classList.add("dark");
          document.documentElement.setAttribute("data-theme", "dark");
          localStorage.setItem("dark-mode", true);
        } else {
          document.documentElement.classList.remove("dark");
          document.documentElement.setAttribute("data-theme", "light");
          localStorage.setItem("dark-mode", false);
        }
      });
    });
  }
});
