export class Utils {
  // the page loading overlay element
  static pageLoadingOverlay = null;

  // overlay show counter
  static showCounter = 0;

  // the error icon element
  static errorIconElement = null;

  static {
    this.pageLoadingOverlay = document.getElementById("pageLoadingOverlay");
    this.errorIconElement = document.getElementById("errorIconElement");
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
}
