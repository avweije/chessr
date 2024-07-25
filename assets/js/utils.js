export class Utils {
  // the page loading overlay element
  static pageLoadingOverlay = null;

  // overlay show counter
  static showCounter = 0;

  static {
    console.log("Utils:static:init");
    console.log(this.pageLoadingOverlay);
    console.log(document.getElementById("pageLoadingOverlay"));

    this.pageLoadingOverlay = document.getElementById("pageLoadingOverlay");
  }

  static showLoading() {
    if (this.showCounter == 0) {
      this.pageLoadingOverlay.classList.remove("hidden");
    }

    this.showCounter++;
  }

  static hideLoading(force = false) {
    this.showCounter--;

    if (this.showCounter <= 0 || force) {
      this.pageLoadingOverlay.classList.add("hidden");
      this.showCounter = 0;
    }
  }
}
