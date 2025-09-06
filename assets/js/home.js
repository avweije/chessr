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

    // get the elements
    this.boxedCardContainer = document.getElementById("boxedCardContainer");

    if (!this.boxedCardContainer) { return; }

    this.fields.white = document.getElementById("statsWhiteField");
    this.fields.black = document.getElementById("statsBlackField");
    this.fields.new = document.getElementById("statsNewField");
    this.fields.recommended = document.getElementById("statsRecommendedField");
    this.fields.analysis = document.getElementById("statsAnalysisField");

    // Get the boxed cards
    const boxedCards = this.boxedCardContainer.getElementsByClassName("boxed-card");
    // add event listeners
    boxedCards[0].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./repertoire";
    });
    boxedCards[1].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./practice";
    });
    boxedCards[2].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./analyse";
    });
    boxedCards[3].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./roadmap";
    });
    boxedCards[4].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./opponent";
    });
    boxedCards[5].addEventListener("click", () => {
      this.abortController.abort();
      window.location.href = "./settings";
    });

    // get the repertoire statistics
    this.getStatistics();
  }

  getElements() {
    // Get the data-elements for reference
    this.elements = [];
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      this.elements[el.id] = el;
    });

    // get the elements
    this.tabs.buttons = document.getElementById("settingsTabButtons");
    this.tabs.account = document.getElementById("settingsTabAccount");
    this.tabs.board = document.getElementById("settingsTabBoard");
    this.tabs.engine = document.getElementById("settingsTabEngine");
    this.tabs.practice = document.getElementById("settingsTabPractice");

    console.log('getElements', this.elements);
  }
  
  // get the repertoire statistics
  getStatistics() {
    var url = "/api/statistics";

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

    console.log(this.fields.white, this.fields.white.nextElementSibling);

    // update the statistics fields
    if (stats.white > 0) {
      //this.fields.white.nextElementSibling.innerHTML = stats.white + " move" + (stats.white === 1 ? "" : "s");
      this.fields.white.nextElementSibling.innerHTML = stats.white;
    } else {
      this.fields.white.nextElementSibling.innerHTML = "";
      this.fields.white.innerHTML = "No white moves yet";
    }
    if (stats.black > 0) {
      //this.fields.black.nextElementSibling.innerHTML = stats.black + " move" + (stats.black === 1 ? "" : "s");
      this.fields.black.nextElementSibling.innerHTML = stats.black;
    } else {
      this.fields.black.nextElementSibling.innerHTML = "";
      this.fields.black.innerHTML = "No black moves yet";
    }
    if (stats.new > 0) {
      //this.fields.new.nextElementSibling.innerHTML = stats.new + " move" + (stats.new === 1 ? "" : "s");
      this.fields.new.nextElementSibling.innerHTML = stats.new;
    } else {
      this.fields.new.nextElementSibling.innerHTML = "";
      this.fields.new.innerHTML = "No new moves";
    }
    if (stats.recommended > 0) {
      //this.fields.recommended.nextElementSibling.innerHTML = stats.recommended + " move" + (stats.recommended === 1 ? "" : "s");
      this.fields.recommended.nextElementSibling.innerHTML = stats.recommended;
    } else {
      this.fields.recommended.nextElementSibling.innerHTML = "";
      this.fields.recommended.innerHTML = "No recommended moves";
    }
    if (stats.analysis > 0) {
      this.fields.analysis.nextElementSibling.innerHTML = stats.analysis + " line" + (stats.analysis === 1 ? "" : "s");
    } else {
      this.fields.analysis.nextElementSibling.innerHTML = "";
      this.fields.analysis.innerHTML = "No analysed games at the moment";
    }

    // remove the skeleton blocks, show the fields
    this.fields.white.parentNode.removeChild(this.fields.white.previousElementSibling);
    this.fields.black.parentNode.removeChild(this.fields.black.previousElementSibling);
    this.fields.new.parentNode.removeChild(this.fields.new.previousElementSibling);
    this.fields.recommended.parentNode.removeChild(this.fields.recommended.previousElementSibling);
    this.fields.analysis.parentNode.removeChild(this.fields.analysis.previousElementSibling);
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  var home = new Home();
});
