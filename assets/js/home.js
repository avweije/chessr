import { Utils } from "utils";

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

    // Get the elements
    this.getElements();

    // Add event listeners
    this.addListeners();

    // get the repertoire statistics
    this.getStatistics();
  }

  // Uses the data-element attribute to gather all the elements needed for this JS file
  getElements() {
    // Get the data-elements for reference
    this.elements = {};
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      this.elements[el.id] = el;
    });
  }

  // Add event listeners
  addListeners() {
        // Add event listeners
    this.elements.boxedCardRepertoire.addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./repertoire";
    });
    this.elements.boxedCardPractice.addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./practice";
    });
    this.elements.boxedCardAnalysis.addEventListener("click", () => {
      if (event.target.closest("a")) return;
      this.abortController.abort();
      window.location.href = "./analyse";
    });
    this.elements.boxedCardRoadmap.addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./roadmap";
    });
    this.elements.boxedCardOpponents.addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./opponent";
    });
    this.elements.boxedCardSettings.addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./settings";
    });
  }
  
  // get the repertoire statistics
  getStatistics() {
    const url = "/api/statistics";

    //fetch(url, {..., signal: signal}).then(response => ...);
    fetch(url, {
      method: "GET",
      signal: this.abortSignal,
    })
      .then((res) => res.json())
      .then((response) => {
        // show the statistics
        this.onGetStatistics(response);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error:", error);
          // show the error icon
          Utils.showError(error);
        }
      });
  }

  // show the statistics
  onGetStatistics(stats, group = null) {
    // store the repertoire
    this.statistics = stats;

    // update the statistics fields
    if (stats.white > 0) {
      this.elements.statsWhiteField.nextElementSibling.innerHTML = stats.white;
    } else {
      this.elements.statsWhiteField.nextElementSibling.innerHTML = "";
      this.elements.statsWhiteField.innerHTML = "No white moves yet";
    }
    if (stats.black > 0) {
      this.elements.statsBlackField.nextElementSibling.innerHTML = stats.black;
    } else {
      this.elements.statsBlackField.nextElementSibling.innerHTML = "";
      this.elements.statsBlackField.innerHTML = "No black moves yet";
    }
    if (stats.new > 0) {
      this.elements.statsNewField.nextElementSibling.innerHTML = stats.new;
    } else {
      this.elements.statsNewField.nextElementSibling.innerHTML = "";
      this.elements.statsNewField.innerHTML = "No new moves";
    }
    if (stats.recommended > 0) {
      this.elements.statsRecommendedField.nextElementSibling.innerHTML = stats.recommended;
    } else {
      this.elements.statsRecommendedField.nextElementSibling.innerHTML = "";
      this.elements.statsRecommendedField.innerHTML = "No recommended moves";
    }
    if (stats.analysis > 0) {
      this.elements.statsAnalysisField.nextElementSibling.innerHTML = stats.analysis + " line" + (stats.analysis === 1 ? "" : "s");
    } else {
      this.elements.statsAnalysisField.nextElementSibling.innerHTML = "";
      this.elements.statsAnalysisField.innerHTML = "No analysed games at the moment";
    }

    // remove the skeleton blocks, show the fields
    this.elements.statsWhiteField.parentNode.removeChild(this.elements.statsWhiteField.previousElementSibling);
    this.elements.statsBlackField.parentNode.removeChild(this.elements.statsBlackField.previousElementSibling);
    this.elements.statsNewField.parentNode.removeChild(this.elements.statsNewField.previousElementSibling);
    this.elements.statsRecommendedField.parentNode.removeChild(this.elements.statsRecommendedField.previousElementSibling);
    this.elements.statsAnalysisField.parentNode.removeChild(this.elements.statsAnalysisField.previousElementSibling);
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  const home = new Home();
});