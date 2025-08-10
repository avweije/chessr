import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

/**
 * Controller class for the homepage.
 */
class Home {
  boxedCardContainer = null;

  fields = {
    white: null,
    black: null,
    new: null,
    recommended: null,
    analysis: null,
  };

  statistics = [];

  abortController = null;
  abortSignal = null;

  constructor() {
    this.abortController = new AbortController();
    this.abortSignal = this.abortController.signal;

    // get the elements
    this.boxedCardContainer = document.getElementById("boxedCardContainer");

    this.fields.white = document.getElementById("statsWhiteField");
    this.fields.black = document.getElementById("statsBlackField");
    this.fields.new = document.getElementById("statsNewField");
    this.fields.recommended = document.getElementById("statsRecommendedField");
    this.fields.analysis = document.getElementById("statsAnalysisField");

    // add event listeners
    this.boxedCardContainer.children[0].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./repertoire";
    });
    this.boxedCardContainer.children[1].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./practice";
    });
    this.boxedCardContainer.children[2].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./analyse";
    });
    this.boxedCardContainer.children[3].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./roadmap";
    });
    this.boxedCardContainer.children[4].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./opponent";
    });
    this.boxedCardContainer.children[5].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./settings";
    });

    // get the repertoire statistics
    this.getStatistics();
  }

  // get the repertoire statistics
  getStatistics() {
    var url = "./api/statistics";

    //fetch(url, {..., signal: signal}).then(response => ...);
    fetch(url, {
      method: "GET",
      signal: this.abortSignal,
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // show the statistics
        this.onGetStatistics(response);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error:", error);
          // show the error icon
          Utils.showError();
        }
      });
  }

  // show the statistics
  onGetStatistics(stats, group = null) {
    // store the repertoire
    this.statistics = stats;

    // update the statistics fields
    if (stats.white > 0) {
      this.fields.white.children[0].innerHTML = stats.white;
    } else {
      this.fields.white.innerHTML = "No white moves yet";
    }
    if (stats.black > 0) {
      this.fields.black.children[0].innerHTML = stats.black;
    } else {
      this.fields.black.innerHTML = "No black moves yet";
    }
    if (stats.new > 0) {
      this.fields.new.children[0].innerHTML = stats.new;
    } else {
      this.fields.new.innerHTML = "No new moves";
    }
    if (stats.recommended > 0) {
      this.fields.recommended.children[0].innerHTML = stats.recommended;
    } else {
      this.fields.recommended.innerHTML = "No recommended moves";
    }
    if (stats.analysis > 0) {
      this.fields.analysis.children[0].innerHTML = stats.analysis;
      this.fields.analysis.innerHTML =
        this.fields.analysis.innerHTML +
        " line" +
        (stats.analysis > 1 ? "s" : "");
    } else {
      this.fields.analysis.innerHTML = "No analysed games at the moment";
    }

    // remove the skeleton pulse class
    this.fields.white.classList.remove("pulse-skeleton");
    this.fields.black.classList.remove("pulse-skeleton");
    this.fields.new.classList.remove("pulse-skeleton");
    this.fields.recommended.classList.remove("pulse-skeleton");
    this.fields.analysis.classList.remove("pulse-skeleton");
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  var home = new Home();
});
