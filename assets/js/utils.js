/**
 * Helper functions, utilities.
 * 
 * - showLoading, hideLoading - keeps track of show count
 * - showError, hideError
 * - getAbbreviatedNumber
 * 
 */
export class Utils {
  // The page loading container
  static pageLoader = null;

  // Overlay show counter
  static showCounter = 0;

  // The error icon element
  static errorIconElement = null;

  static console = null;

  static {
    // Get the elements
    this.pageLoader = document.getElementById("pageLoader");
    this.errorIconElement = document.getElementById("errorIconElement");
  }

  // Shows a loader
  static showLoading() {
    if (this.showCounter == 0) {
      this.pageLoader && this.pageLoader.classList.remove("is-hidden");
    }

    this.showCounter++;
  }

  // Hides the loader
  static hideLoading(force = false) {
    this.showCounter--;

    if (this.showCounter <= 0 || force) {
      this.pageLoader && this.pageLoader.classList.add("is-hidden");
      this.showCounter = 0;
    }
  }

  // Fade the error icon to indicate something is wrong
  static showError() {
    // if already showing
    if (!this.errorIconElement.classList.contains("fade")) {
      return false;
    }

    // start fade-in and call fade-out after 5 seconds
    this.errorIconElement.classList.remove("fade");

    setTimeout(() => {
      this.hideError();
    }, 5000);
  }

  // Hide the error icon
  static hideError() {
    this.errorIconElement.classList.add("fade");
  }

  // Get a number as B+ (billion), M+ (million) or k+ (thousand)
  static getAbbreviatedNumber(number, abbrev = "") {
    if (isNaN(number)) {
      return "";
    }

    number = Math.abs(number);
    if (number < 100) {
      return number + abbrev;
    } else if (number < 501) {
      return "99" + (abbrev == "" ? "+" : abbrev);
    } else if (number < 1001 || abbrev == "B") {
      return "500" + (abbrev == "" ? "+" : abbrev);
    } else {
      number = Math.floor((number - 1) / 1000);
      return Utils.getAbbreviatedNumber(
        number,
        abbrev == "" ? "k+" : abbrev == "k+" ? "M+" : "B+"
      );
    }
  }

  // Get a human readable duration for a number of seconds (2h 14m 32s)
  static getDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds - h * 3600) / 60);
    const s = Math.floor(seconds - h * 3600 - m * 60);

    return (h > 0 ? h + "h " : "") + (h > 0 || m > 0 ? m + "m " : "") + s + "s";
  }
}

// TODO: Not happy with this, find or make something better..
//Utils.overrideConsole();
