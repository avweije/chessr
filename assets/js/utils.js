export class Utils {
  // the page loading overlay element
  static pageLoadingOverlay = null;

  // overlay show counter
  static showCounter = 0;

  // the error icon element
  static errorIconElement = null;

  static console = null;

  static {
    this.pageLoadingOverlay = document.getElementById("pageLoadingOverlay");
    this.errorIconElement = document.getElementById("errorIconElement");
  }

  static showLoading() {
    if (this.showCounter == 0) {
      this.pageLoadingOverlay.classList.remove("is-hidden");
    }

    this.showCounter++;
  }

  static hideLoading(force = false) {
    this.showCounter--;

    if (this.showCounter <= 0 || force) {
      this.pageLoadingOverlay.classList.add("is-hidden");
      this.showCounter = 0;
    }
  }

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

  static hideError() {
    this.errorIconElement.classList.add("fade");
  }

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

  static overrideConsole() {
    console.log("overrideConsole:");

    if (this.console !== null) {
      return;
    }

    this.console = { log: console.log };

    console.log = function () {
      // 1. Convert args to a normal array
      var args = Array.from(arguments);
      // OR you can use: Array.prototype.slice.call( arguments );

      // 2. Prepend log prefix log string
      //args.unshift(LOG_PREFIX + ": ");

      // add the group as 1st parameter
      args.unshift("console");

      // 3. Pass along arguments to console.log
      //Utils.console.log.apply(console, args);
      Utils.log.apply(Utils, args);
    };
  }

  static log(group) {
    //console.info("Utils.log:");
    //console.info("Group: " + group);
    //console.info(this);

    var args = Array.from(arguments);

    //this.console.log.apply(console, args);

    args.splice(0, 1);

    var groups = ["skip"];

    //if (groups.includes(group)) {
    this.console.log.apply(console, args);
    //}
  }
}

Utils.overrideConsole();
